const express = require('express');
const app = express();
const axios = require('axios').default;
const balancer = require('./balancer.js');
const simpleBalancer = new balancer.SimpleBalancer(+process.env.REFRESH_INTERVAL_SECONDS || 5);


const handler = function (req, res) {
  req.balancerRequestContext = simpleBalancer.createNewBalancerRequestContext();
  let responseSent = false;

  callBackend(req.balancerRequestContext.lastBackend);

  function callBackend(backend) {
    const {host, ...newHeadersRequest } = req.headers;
    axios({
      method: req.method,
      headers: newHeadersRequest,
      url: backend + req.url,
      data: req.body,
      responseType: 'stream',
      validateStatus: function (status) {
        return status < 500;
      },
    })
      .then(function (response) {
        req.balancerRequestContext.incrementExecutionCount();
        res.set('X-Origin', backend);
        const {host, ...newHeadersResponse } = response.headers;
        for (let header in newHeadersResponse) {
            res.setHeader(header, newHeadersResponse[header]);
        }
        res.statusCode = response.status;
        response.data.pipe(res);
      })
      .catch(function (error) {
        handleError(error);
      });

    function handleError(error) {
      req.balancerRequestContext.incrementExecutionCount();
      console.error("Error from lastBackend. Backend:", req.balancerRequestContext.lastBackend, "Error:", error.message);
      console.debug(error.stack);
      if (req.balancerRequestContext.hasRemainingBackendsToTry()) {
        callBackend(req.balancerRequestContext.removeLastBackendAndGetNew());
      } else {
        if (responseSent)
          return;
        let errorMessage = "No available backends! All backends: " + JSON.stringify(req.balancerRequestContext.backendsAll);
        req.balancerRequestContext.allFailed = true;
        console.error(errorMessage);
        res.status(500).json({error: errorMessage});
        responseSent = true;
      }
    }
  }
};

const profilerMiddleware = (req, res, next) => {
  const start = Date.now();
  // The 'finish' event comes from core Node.js, it means Node is done handing
  // off the response headers and body to the underlying OS.
  res.on('finish', () => {
    let allFailedMessage = '';
    if (req.balancerRequestContext.allFailed) {
      allFailedMessage = 'FAILED - ';
    }
    console.log(allFailedMessage + req.method, req.balancerRequestContext.lastBackend + req.url,
      '[Duration:', Date.now() - start, "ms,", 'Try count:', req.balancerRequestContext.executionCount.count+'].');
    if (Object.keys(req.body).length > 0)
      console.debug(req.body)
  });
  next();
};

app
  .use(express.json())
  .use(profilerMiddleware)
  .get('*', handler)
  .post('*', handler)
  .put('*', handler)
  .delete('*', handler)
  .listen(+process.env.PORT || 8080, () => {
    console.log('App started');
  });

