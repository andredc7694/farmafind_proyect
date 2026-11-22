/** Local F03 TEST entry point. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Pool } from 'pg';
import { createLocalIdentityApp } from '../../backend/dist/identity-app.js';
import { validateLocalIdentityRuntime } from '../../backend/dist/config/identity-runtime.js';
import { loadSearchConfig } from '../../backend/dist/config/search.js';

const state=JSON.parse(readFileSync(new URL('../../.cache/f03-fixture/state.local.json',import.meta.url),'utf8'));
assert.equal(state.kind,'F03_TEST_ONLY'); assert.match(state.database,/^farmafind_f01_test_[a-f0-9]{12}$/);
const origin='http://127.0.0.1:5173';
const identity=validateLocalIdentityRuntime({ APP_MODE:'identity',HOST:'127.0.0.1',PORT:'3000',F01_AUTH_DATABASE_URL:state.authUrl,
  F01_DATABASE_URL:state.runtimeUrl,F01_CSRF_KEY_HEX:state.csrfKey,F01_ABUSE_KEY_HEX:state.abuseKey,F01_ALLOWED_ORIGIN:origin,
  F01_CSRF_TRUSTED_ORIGIN:origin,F01_COOKIE_SECURE:'false',F01_ALLOW_HTTP_LOOPBACK:'true' });
const search=loadSearchConfig({ SEARCH_REDIS_URL:state.redisUrl,SEARCH_CACHE_TTL_SECONDS:'60',SEARCH_CACHE_TIMEOUT_MS:'150',SEARCH_CANDIDATE_LIMIT:'200' });
const composed=await createLocalIdentityApp({...identity,search},url=>new Pool({connectionString:url,max:4}));
const server=composed.app.listen(3000,'127.0.0.1',()=>console.log('F03 API TEST: http://127.0.0.1:3000/api/v1/busquedas?q=paracetamol'));
let closing=false; const stop=()=>{ if(closing)return; closing=true; server.close(()=>void composed.close()); };
process.on('SIGINT',stop); process.on('SIGTERM',stop);
