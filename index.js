const express = require('express');
const app = express();
const axios = require('axios').default;
const balancer = require('./balancer.js')

let balancerRequestContext;

const handler = function (req, res) {
  balancerRequestContext = balancer.createNewBalancerRequestContext();
  let responseSent = false;

  callBackend(balancerRequestContext.lastBackend);

  function callBackend(backend) {
    function handleError(error) {
      balancerRequestContext.incrementExecutionCount();
      console.error("Error from lastBackend. Backend:", balancerRequestContext.lastBackend, "Error:", error.message);
      console.debug(error.stack);
      if (balancerRequestContext.hasRemainingBackendsToTry()) {
        callBackend(balancerRequestContext.removeLastBackendAndGetNew());
      } else {
        if (responseSent)
          return;
        let errorMessage = "No available backends! All backends: " + JSON.stringify(balancerRequestContext.backendsAll);
        balancerRequestContext.allFailed = true;
        console.error(errorMessage);
        res.status(500).json({error: errorMessage});
        responseSent = true;
      }
    }

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
        balancerRequestContext.incrementExecutionCount();
        res.set('X-Origin', backend);
        const {host, ...newHeadersResponse } = response.headers;
        res.headers = newHeadersResponse;
        response.data.pipe(res);
      })
      .catch(function (error) {
        handleError(error);
      });
  }
};

const profilerMiddleware = (req, res, next) => {
  const start = Date.now();
  // The 'finish' event comes from core Node.js, it means Node is done handing
  // off the response headers and body to the underlying OS.
  res.on('finish', () => {
    let allFailedMessage = '';
    if (balancerRequestContext.allFailed) {
      allFailedMessage = 'FAILED - ';
    }
    console.log(allFailedMessage + req.method, balancerRequestContext.lastBackend + req.url,
      '[Duration:', Date.now() - start, "ms,", 'Try count:', balancerRequestContext.executionCount.count+'].');
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
  .listen(8080, () => {
    console.log('App started');
  });

