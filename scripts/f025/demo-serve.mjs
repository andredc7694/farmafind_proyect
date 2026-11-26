/** One integrated local TEST API. No migrations or fixture writes on startup. */
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {Pool} from 'pg';
import {createLocalIdentityApp} from '../../backend/dist/identity-app.js';
import {validateLocalIdentityRuntime} from '../../backend/dist/config/identity-runtime.js';
import {loadReservationConfig} from '../../backend/dist/config/reservations.js';
import {assertF025EphemeralDatabase,F025_CLUSTER_NAME,F025_TEST_MARKER} from './test-env.mjs';
import {localStateName} from './demo-slot.mjs';

const directory=new URL('../../.cache/f025-docker/',import.meta.url);
const state=JSON.parse(readFileSync(new URL(localStateName('demo.local.json'),directory),'utf8'));
assert.equal(state.kind,'F025_TEST_DEMO_ONLY');
for(const value of Object.values(state.roles))
  assert.equal(assertF025EphemeralDatabase(value),state.database);
const preflight=new Pool({connectionString:state.roles.runtime,max:1});
try{
  const rows=(await preflight.query(`SELECT current_setting('cluster_name') AS cluster,
    (SELECT description FROM pg_shdescription WHERE objoid=(SELECT oid FROM pg_database
      WHERE datname=current_database())) AS marker`)).rows;
  assert.equal(rows[0].cluster,F025_CLUSTER_NAME);assert.equal(rows[0].marker,F025_TEST_MARKER);
}finally{await preflight.end();}
const origin='http://127.0.0.1:5173';
const config=validateLocalIdentityRuntime({APP_MODE:'identity',HOST:'127.0.0.1',PORT:'3000',
  F01_AUTH_DATABASE_URL:state.roles.auth,F01_DATABASE_URL:state.roles.runtime,
  F01_CSRF_KEY_HEX:state.csrfKey,F01_ABUSE_KEY_HEX:state.abuseKey,
  F01_ALLOWED_ORIGIN:origin,F01_CSRF_TRUSTED_ORIGIN:origin,
  F01_COOKIE_SECURE:'false',F01_ALLOW_HTTP_LOOPBACK:'true'});
let search;
const redisSecretFile=new URL('../../.cache/f03-docker/redis-password.txt',import.meta.url);
if(existsSync(redisSecretFile)){
  const password=readFileSync(redisSecretFile,'utf8').trim();
  assert.match(password,/^[a-f0-9]{64}$/);
  const redis=new URL('redis://127.0.0.1:56379/0');redis.password=password;
  search={redisUrl:redis.toString(),cacheTimeoutMs:150,cacheTtlSeconds:60,candidateLimit:200};
}
delete process.env.FARMAFIND_AI_PROVIDER;
const composed=await createLocalIdentityApp({...config,pharmaciesTest:true,
  reservations:loadReservationConfig(process.env),search,geolocationTest:search?true:undefined,
  // F071-FR-016: sugerencia de dirección encendida en TEST/DEMO; FARMAFIND_ADDRESS_SUGGESTIONS=off la apaga.
  addressSuggestions:search&&process.env.FARMAFIND_ADDRESS_SUGGESTIONS!=='off'?'nominatim':undefined},
  url=>new Pool({connectionString:url,max:6}));
const server=composed.app.listen(3000,'127.0.0.1',
  ()=>console.log('F02.5 TEST API: http://127.0.0.1:3000/health'));
let stopping=false;
function stop(){if(stopping)return;stopping=true;server.close(()=>void composed.close());}
process.on('SIGINT',stop);process.on('SIGTERM',stop);
server.on('error',async error=>{console.error(`F02.5 API: ${error.code||'error'}`);
  await composed.close();process.exitCode=1;});
