/** Print only non-sensitive TEST cache counters. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createClient } from 'redis';
const state=JSON.parse(readFileSync(new URL('../../.cache/f03-fixture/state.local.json',import.meta.url),'utf8'));
assert.equal(state.kind,'F03_TEST_ONLY'); const client=createClient({url:state.redisUrl}); client.on('error',()=>undefined);
try { await client.connect(); const info=await client.info('stats');
  const value=name=>Number(info.match(new RegExp(`^${name}:(\\d+)$`,'m'))?.[1]??0);
  console.log(JSON.stringify({keyspaceHits:value('keyspace_hits'),keyspaceMisses:value('keyspace_misses')}));
} finally {if(client.isOpen)await client.quit();}
