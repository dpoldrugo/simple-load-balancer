const schedule = require('node-schedule');
const axios = require('axios').default;
const P2cBalancer = require("load-balancers").P2cBalancer;

class SimpleBalancer {

  // list of backends
  backends = [
    // see remote-config-example.json for example values under property backends
    // 'http://127.0.0.1:3000'
  ];

  P2cBalancer;

  constructor(refreshIntervalSeconds) {
    if (!process.env.REMOTE_CONFIG_URL) {
      throw new Error('ENV variable REMOTE_CONFIG_URL is not defined!')
    }
    this.refreshIntervalSeconds = refreshIntervalSeconds;
    getRemoteConfig().then(value => { validateAndChangeBackends(value, this) });
    scheduleRefresh(this);
  }

  createNewBalancerRequestContext() {
    return new BalancerRequestContext(this.backends[this.P2cBalancer.pick()], this.backends);
  }
}

function scheduleRefresh(balancer) {
  this.job = schedule.scheduleJob('*/' + balancer.refreshIntervalSeconds + ' * * * * *', function(fireDate){
    getRemoteConfig().then( value => {
      validateAndChangeBackends(value, balancer);
    } ).catch(reason => {
      console.error("Error getting backends from REMOTE_CONFIG_URL (" + process.env.REMOTE_CONFIG_URL+"). Reason: " + reason)
    });

  });
}

function validateAndChangeBackends(newConfigResponse, balancer) {
  if (!newConfigResponse.backends) {
    console.warn("Corrupt format in REMOTE_CONFIG_URL, fix it. Backends will stay the same. REMOTE_CONFIG_URL=" + process.env.REMOTE_CONFIG_URL);
    console.info("Using old backends:", balancer.backends);
    return false;
  }
  if (JSON.stringify(newConfigResponse.backends) !== JSON.stringify(balancer.backends)) {
    console.log("Balancer configuration change from REMOTE_CONFIG_URL:", process.env.REMOTE_CONFIG_URL)
    console.log("Old backends:", balancer.backends);
    console.log("New backends:", newConfigResponse.backends)
    balancer.backends = newConfigResponse.backends;
    balancer.P2cBalancer = new P2cBalancer(balancer.backends.length);
  }
  return true;
}
async function getRemoteConfig() {
  return axios.get(process.env.REMOTE_CONFIG_URL).then(value => value.data);
}

class BalancerRequestContext {
  constructor(lastBackend, backends) {
    this.executionCount = new ExecutionCount();
    this.lastBackend = lastBackend;
    this.backends = backends;
    this.backendsAll = backends;
    this.allFailed = false;
  }

  incrementExecutionCount() {
    this.executionCount.count++;
  }

  hasRemainingBackendsToTry() {
    return this.executionCount.count < this.backends.length;
  }

  removeLastBackendAndGetNew() {
    this.backends = this.backends.filter(value => value !== this.lastBackend);
    let backendIdxToUse = this.executionCount.count % this.backends.length;
    this.lastBackend = this.backends[backendIdxToUse];
    return this.lastBackend;
  }
}

class ExecutionCount {
    count = 0;
}

module.exports = {
  SimpleBalancer
}