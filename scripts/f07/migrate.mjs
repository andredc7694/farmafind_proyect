/** Apply only pending F07 migrations to the marked isolated local TEST database. */
import { readFileSync } from 'node:fs';
import { Client } from 'pg';
import { migrateF07TestDatabase } from '../../backend/dist/modules/busqueda/infrastructure/migrate.js';
import { assertF07EphemeralDatabase } from './fixtures.mjs';

const state=JSON.parse(readFileSync(new URL('../../.cache/f07-fixture/state.local.json',import.meta.url),'utf8'));
if (state.kind!=='F07_TEST_ONLY') throw new Error('F07: estado local TEST inválido');
const secret=readFileSync(new URL('../../.cache/f01-docker/postgres-password.txt',import.meta.url),'utf8').trim();
if (!/^[a-f0-9]{64}$/i.test(secret)) throw new Error('F07: secreto local inválido');
const url=new URL('postgresql://127.0.0.1:55431/farmafind_f01_test');
url.username='f01_migrator'; url.password=secret; url.pathname=`/${state.database}`;
assertF07EphemeralDatabase(url.toString());
const connect=async text=>{const client=new Client({connectionString:text}); await client.connect(); return client;};
const applied=await migrateF07TestDatabase(url.toString(),connect);
console.log(`F07 TEST: ${applied.length} migraciones nuevas aplicadas: ${applied.join(', ') || 'ninguna'}.`);
