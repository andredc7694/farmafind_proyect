/** Read-only guard for the isolated manual TEST slot before human walkthrough. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Client} from 'pg';
import {assertF025EphemeralDatabase,assertF025ConnectedTarget} from './test-env.mjs';

const local=new URL('../../.cache/f025-docker/',import.meta.url);
const state=JSON.parse(readFileSync(new URL('state.manual.local.json',local),'utf8'));
const catalog=JSON.parse(readFileSync(new URL('catalog-fixture.manual.local.json',local),'utf8'));
assert.equal(catalog.database,state.database);
const secret=readFileSync(new URL('postgres-password.txt',local),'utf8').trim();
const url=new URL(`postgresql://127.0.0.1:55431/${state.database}`);
url.username='f01_migrator';url.password=secret;
assertF025EphemeralDatabase(url.toString(),{migration:true});
const client=new Client({connectionString:url.toString()});
await client.connect();
try{
  await assertF025ConnectedTarget(client,state.database);
  const result=await client.query(`SELECT
    (SELECT count(*)::int FROM f01.farmacia_referencia) AS pharmacies,
    (SELECT count(*)::int FROM f02.inventario) AS inventory,
    (SELECT count(*)::int FROM f02.medicamento WHERE id=$1) AS catalog_reference`,[catalog.id]);
  const values=result.rows[0];
  assert.equal(values.pharmacies,0,'El slot manual ya contiene farmacias: no declarar vacio');
  assert.equal(values.inventory,0,'El slot manual ya contiene inventario: no declarar vacio');
  assert.equal(values.catalog_reference,1);
  console.log(JSON.stringify({kind:'F025_MANUAL_SLOT_READ_ONLY',pharmacies:values.pharmacies,
    inventory:values.inventory,catalogReferences:values.catalog_reference}));
}finally{await client.end();}
