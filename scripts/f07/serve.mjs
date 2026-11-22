/** Launch F01–F03 plus F07 public API only against a marked isolated TEST database. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Pool } from 'pg';
import { createLocalIdentityApp } from '../../backend/dist/identity-app.js';
import { validateLocalIdentityRuntime } from '../../backend/dist/config/identity-runtime.js';
import { loadSearchConfig } from '../../backend/dist/config/search.js';
import { assertF07EphemeralDatabase } from './fixtures.mjs';

const state=JSON.parse(readFileSync(new URL('../../.cache/f07-fixture/state.local.json',import.meta.url),'utf8'));
assert.equal(state.kind,'F07_TEST_ONLY');
for (const value of [state.authUrl,state.runtimeUrl]) {
  const url=assertF07EphemeralDatabase(value);
  assert.equal(url.pathname,`/${state.database}`);
}
const redisSecret=readFileSync(new URL('../../.cache/f03-docker/redis-password.txt',import.meta.url),'utf8').trim();
assert.match(redisSecret,/^[a-f0-9]{64}$/i);
const redisUrl=new URL('redis://127.0.0.1:56379/0'); redisUrl.password=redisSecret;
const port=Number(process.env.FARMAFIND_F07_API_PORT ?? '3000');
assert(Number.isInteger(port) && port>=1024 && port<=65535,'Puerto API local inválido');
const origin='http://127.0.0.1:5173';
const identity=validateLocalIdentityRuntime({APP_MODE:'identity',HOST:'127.0.0.1',PORT:String(port),
  F01_AUTH_DATABASE_URL:state.authUrl,F01_DATABASE_URL:state.runtimeUrl,
  F01_CSRF_KEY_HEX:state.csrfKey,F01_ABUSE_KEY_HEX:state.abuseKey,F01_ALLOWED_ORIGIN:origin,
  F01_CSRF_TRUSTED_ORIGIN:origin,F01_COOKIE_SECURE:'false',F01_ALLOW_HTTP_LOOPBACK:'true'});
const search=loadSearchConfig({SEARCH_REDIS_URL:redisUrl.toString(),SEARCH_CACHE_TTL_SECONDS:'60',
  SEARCH_CACHE_TIMEOUT_MS:'150',SEARCH_CANDIDATE_LIMIT:'200'});
const composed=await createLocalIdentityApp({...identity,search,geolocationTest:true},url=>new Pool({connectionString:url,max:4}));
const server=composed.app.listen(port,'127.0.0.1',()=>console.log(`F07 API TEST: http://127.0.0.1:${port}/api/v1/geolocalizacion/farmacias?ciudad=lima`));
let closing=false;
const stop=()=>{if(closing)return;closing=true;server.close(()=>void composed.close());};
process.on('SIGINT',stop);process.on('SIGTERM',stop);
server.on('error',async error=>{console.error(`F07 API TEST: no se pudo iniciar (${error.code || 'error'})`);await composed.close();process.exitCode=1;});
