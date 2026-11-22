import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer, connect } from 'node:net';
import { resolve } from 'node:path';

assert.equal(process.platform,'linux','Playwright F07 exige Linux oficialmente compatible');
assert.equal(process.env.F07_E2E_CONTAINER,'1','Contenedor F07 TEST explícito requerido');
const servers=[];
async function bridge(port) {
  const server=createServer(browser=>{
    const host=connect({host:'host.docker.internal',port});
    browser.on('error',()=>host.destroy()); host.on('error',()=>browser.destroy());
    browser.pipe(host); host.pipe(browser);
  });
  await new Promise((resolveListen,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolveListen);});
  servers.push(server);
}
try {
  await bridge(3000); await bridge(5173);
  const child=spawn(process.execPath,[resolve('node_modules/@playwright/test/cli.js'),'test',
    'frontend/tests/geolocation/nearby.spec.js','--output=/tmp/f07-playwright-results'],
  {cwd:'/work',env:process.env,stdio:'inherit'});
  process.exitCode=await new Promise((resolveExit,reject)=>{
    child.once('error',reject);child.once('exit',code=>resolveExit(code ?? 1));
  });
} finally {await Promise.all(servers.map(server=>new Promise(resolveClose=>server.close(resolveClose))));}
