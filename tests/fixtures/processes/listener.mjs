import http from 'node:http';
const port = Number(process.argv[2]);
const mode = process.argv[3] || 'wrong-identity';
http.createServer((_req, res) => {
  if (mode === 'hang') return;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify({ service: 'fixture-wrong-identity', status: 'ok', mode: 'bootstrap' }));
}).listen(port, '127.0.0.1');
