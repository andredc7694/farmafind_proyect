/** Run F04 browser acceptance only inside the approved Linux Playwright image. */
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createServer,connect} from 'node:net';
import {resolve} from 'node:path';

assert.equal(process.platform,'linux','F04: ejecutar solo dentro de Linux compatible');
assert.equal(process.env.F04_E2E_CONTAINER,'1','F04: contenedor de prueba explicito requerido');
const servers=[];
async function bridge(port){const server=createServer(browser=>{const host=connect({host:'host.docker.internal',port});browser.on('error',()=>host.destroy());host.on('error',()=>browser.destroy());browser.pipe(host);host.pipe(browser);});await new Promise((ok,fail)=>{server.once('error',fail);server.listen(port,'127.0.0.1',ok);});servers.push(server);}
try{
  await bridge(5173);
  const child=spawn(process.execPath,[resolve('node_modules/@playwright/test/cli.js'),'test','frontend/tests/reservations/f04.spec.js','--output=/tmp/f04-playwright-results'],{cwd:'/work',env:process.env,stdio:'inherit'});
  process.exitCode=await new Promise((ok,fail)=>{child.once('error',fail);child.once('exit',code=>ok(code??1));});
}finally{await Promise.all(servers.map(server=>new Promise(close=>server.close(close))));}
