const express = require('express');
const request = require('request');

const servers = [
  'https://middleware-api-1.potres2020.repl.co', 'https://middleware-api-2.potres2020.repl.co'
];
let cur = 0;

const handler = (req, res) => {
  // Pipe the vanilla node HTTP request (a readable stream) into `request`
  // to the next server URL. Then, since `res` implements the writable stream
  // interface, you can just `pipe()` into `res`.
  res.set('X-Origin', servers[cur])
  req.pipe(request({ url: servers[cur] + req.url })).pipe(res);
  cur = (cur + 1) % servers.length;
};
const server = express()
  .get('*', handler)
  .post('*', handler)
  .put('*', handler)
  .delete('*', handler);

server.listen(8080);