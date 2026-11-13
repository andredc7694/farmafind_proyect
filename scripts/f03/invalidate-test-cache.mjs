/** TEST-only generation bump; never scans or deletes unrelated Redis keys. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createClient } from 'redis';
const state=JSON.parse(readFileSync(new URL('../../.cache/f03-fixture/state.local.json',import.meta.url),'utf8'));
assert.equal(state.kind,'F03_TEST_ONLY');
const client=createClient({url:state.redisUrl}); client.on('error',()=>undefined);
try { await client.connect(); await client.incr('farmafind:f03:v1:generation'); console.log('Generación F03 TEST incrementada.'); }
finally { if(client.isOpen) await client.quit(); }
