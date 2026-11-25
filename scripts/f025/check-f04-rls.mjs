/** Run F04 PostgreSQL regression only against the marked F02.5 TEST cluster. */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { Client } from 'pg';
import { assertF025EphemeralDatabase, assertF025ConnectedTarget } from './test-env.mjs';

const root=fileURLToPath(new URL('../../',import.meta.url));
const local=path.join(root,'.cache/f025-docker');
const database=JSON.parse(readFileSync(path.join(local,'state.local.json'),'utf8')).database;
const secret=readFileSync(path.join(local,'postgres-password.txt'),'utf8').trim();
const url=new URL(`postgresql://127.0.0.1:55431/${database}`);
url.username='f01_migrator';url.password=secret;
assertF025EphemeralDatabase(url.toString(),{migration:true});
const client=new Client({connectionString:url.toString()});
await client.connect();
try { await assertF025ConnectedTarget(client,database); }
finally { await client.end(); }
const result=spawnSync(process.execPath,['node_modules/vitest/vitest.mjs','run',
  'backend/tests/reservations/migrations.test.ts','backend/tests/reservations/reservations.rls.test.ts','backend/tests/reservations/f041-ops.rls.test.ts','backend/tests/reservations/f081-summary.rls.test.ts','backend/tests/reservations/f012-worker-delegation.rls.test.ts'],
  {cwd:root,env:{...process.env,F01_TEST_DATABASE_URL:url.toString()},stdio:'inherit'});
process.exitCode=result.status??1;
