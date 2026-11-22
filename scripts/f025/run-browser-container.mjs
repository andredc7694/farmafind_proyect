/** Bridge TEST loopback services into the already cached official Playwright Linux image. */
import assert from 'node:assert/strict';
import {createServer,connect} from 'node:net';
import {spawn} from 'node:child_process';
import {resolve} from 'node:path';

assert.equal(process.platform,'linux');
assert.equal(process.env.F025_E2E_CONTAINER,'1');
const servers=[];
async function bridge(port){
  const server=createServer(browser=>{
    const host=connect({host:'host.docker.internal',port});
    browser.on('error',()=>host.destroy());host.on('error',()=>browser.destroy());
    browser.pipe(host);host.pipe(browser);
  });
  await new Promise((done,fail)=>{server.once('error',fail);server.listen(port,'127.0.0.1',done);});
  servers.push(server);
}
try{
  await bridge(3000);await bridge(5173);
  const suite=process.env.F025_BROWSER_PUBLIC==='1'
    ? 'scripts/f025/browser-public.mjs'
    : process.env.F025_BROWSER_MANUAL_SMOKE==='1'
      ? 'scripts/f025/browser-manual-smoke.mjs' : 'scripts/f025/browser-five.mjs';
  const child=spawn(process.execPath,[resolve(suite)],
    {cwd:'/work',env:process.env,stdio:'inherit'});
  process.exitCode=await new Promise((done,fail)=>{
    child.once('error',fail);child.once('exit',code=>done(code??1));
  });
}finally{await Promise.all(servers.map(server=>new Promise(done=>server.close(done))));}
