const Database = require("@replit/database");
const db = new Database(process.env.REPLIT_DB_URL);

console.log("DB url: " + db.key)

// list of backends
let backends = [
  //'https://currently-down.potres2020.repl.co',
  'https://middleware-api-1.potres2020.repl.co',
  'https://middleware-api-2.potres2020.repl.co'
];

initDb();

const P2cBalancer = require("load-balancers").P2cBalancer;

// Initializes the Power of 2 Choices (P2c) Balancer with backends.
const balancer = new P2cBalancer(backends.length);

function createNewBalancerRequestContext() {
  return new BalancerRequestContext(backends[balancer.pick()], backends);
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
    return this.executionCount.count < backends.length;
  }

  removeLastBackendAndGetNew() {
    this.backends = this.backends.filter(value => value !== this.lastBackend);
    let backendIdxToUse = this.executionCount.count % this.backends.length;
    this.lastBackend = this.backends[backendIdxToUse];
    return this.lastBackend;
  }
}

class ExecutionCount {
  constructor() {
    this.count = 0;
  }
}

async function initDb() {
  //await clearDb();
  await initalizeDbIfNeeded();
}

async function clearDb() {
  console.log("Deleting DB.");
  await db.empty();
}

async function initalizeDbIfNeeded() {
  db.get("backends").then(value => {
    if (value != undefined) {
      backends = value
      console.log("Backends from DB: " + JSON.stringify(value))
    }
    else {
      db.set("backends", backends);
      console.log("Adding initial backends DB: " + JSON.stringify(backends))
    }
  });
}

module.exports = {
  createNewBalancerRequestContext
}