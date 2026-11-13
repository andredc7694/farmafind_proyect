/** Run k6 against an already-running local F03 API. No workspace or secrets enter the container. */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const script=path.join(fileURLToPath(new URL('../../',import.meta.url)),'tests/load/f03-search.js');
const result=spawnSync('docker',['run','--rm','--add-host=host.docker.internal:host-gateway','-v',`${script}:/script.js:ro`,
  'grafana/k6:1.8.2','run','/script.js'],{stdio:'inherit'});
process.exitCode=result.status??1;
