/** Run k6 against a supervised local F03 API. No workspace or secrets enter the container. */
import { mkdtempSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { ensureFree, launch, stop } from '../f00/process-supervisor.mjs';
import { waitForHttp } from '../f00/http-checks.mjs';

const root=fileURLToPath(new URL('../../',import.meta.url));
const script=path.join(root,'tests/load/f03-search.js');
const logDir=mkdtempSync(path.join(tmpdir(),'farmafind f03 load '));
let api;
try {
  const verified=spawnSync(process.execPath,['scripts/f03/fixture.mjs','verify'],{cwd:root,stdio:'inherit'});
  if(verified.status!==0) process.exit(verified.status??1);
  await ensureFree(3000);
  api=launch({id:'f03-load-api',args:[path.join(root,'scripts/f03/start.mjs')],logDir});
  await waitForHttp('http://127.0.0.1:3000/health',api,60000);
  const result=spawnSync('docker',['run','--rm','--add-host=host.docker.internal:host-gateway','-v',`${script}:/script.js:ro`,
    'grafana/k6:1.8.2','run','/script.js'],{cwd:root,stdio:'inherit',shell:false});
  if(result.error) throw result.error;
  process.exitCode=result.status??1;
} finally {
  if(api) await stop(api);
  await ensureFree(3000);
  if(!logDir.startsWith(path.join(tmpdir(),'farmafind f03 load '))) throw new Error('Ruta temporal F03 insegura');
  rmSync(logDir,{recursive:true,force:true});
}
