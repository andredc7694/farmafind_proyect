/** F07 p95 with exactly 200 fictional public candidates in an isolated TEST database. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import os from 'node:os';
import { performance } from 'node:perf_hooks';
import { Client } from 'pg';
import { ListNearbyPharmacies } from '../../backend/dist/modules/busqueda/application/list-nearby-pharmacies.js';
import { PgPublicOfferRepository } from '../../backend/dist/modules/busqueda/infrastructure/public-offer-repository.js';
import { assertF07EphemeralDatabase } from './fixtures.mjs';

const state=JSON.parse(readFileSync(new URL('../../.cache/f07-fixture/state.local.json',import.meta.url),'utf8'));
assert.equal(state.kind,'F07_TEST_ONLY');
assert.equal(assertF07EphemeralDatabase(state.runtimeUrl).pathname,`/${state.database}`);
const secret=readFileSync(new URL('../../.cache/f01-docker/postgres-password.txt',import.meta.url),'utf8').trim();
assert.match(secret,/^[a-f0-9]{64}$/i);
const url=new URL(state.runtimeUrl);url.username='f01_migrator';url.password=secret;
const admin=new Client({connectionString:url.toString()});
const runtime=new Client({connectionString:state.runtimeUrl});
const added=[];
await admin.connect();await runtime.connect();
try {
  const existing=Number((await runtime.query('SELECT count(*)::int AS count FROM f07.list_public_pharmacies(NULL)')).rows[0].count);
  assert.equal(existing,5,'F07: fixture base inesperado');
  const needed=200-existing;
  const proposer=state.identities['alfa-proposer'].userId;
  const reviewer=state.identities['alfa-reviewer'].userId;
  for(let index=0;index<needed;index++) {
    const id=(await admin.query('INSERT INTO f01.farmacia_referencia(nombre_publico) VALUES($1) RETURNING id',
      [`F07 Carga Ficticia ${String(index).padStart(3,'0')}`])).rows[0].id;
    added.push(id);
    await admin.query(`INSERT INTO f03.farmacia_publica
      (farmacia_id,direccion_texto,ciudad,latitud,longitud,fuente,estado_ubicacion,
       propuesta_por,revisada_por,fecha_verificacion)
      VALUES($1,$2,'lima',$3,$4,'Fixture de carga F07','PUBLICADA_VERIFICADA',$5,$6,now())`,
      [id,`Calle Ficticia ${index}`,-12.05+(index%20)*0.001,-77.04+(index%10)*0.001,proposer,reviewer]);
  }
  const count=Number((await runtime.query('SELECT count(*)::int AS count FROM f07.list_public_pharmacies(NULL)')).rows[0].count);
  assert.equal(count,200,'F07: no hay 200 candidatas TEST');
  const query={kind:'proximity',latitude:-12.05,longitude:-77.04,radiusKm:50,term:null,
    minimumPrice:null,maximumPrice:null,page:1,pageSize:20};
  const useCase=new ListNearbyPharmacies(new PgPublicOfferRepository(runtime));
  const samples=[];
  for(let index=0;index<35;index++) {
    const start=performance.now();const result=await useCase.execute(query);
    const elapsed=performance.now()-start;
    assert.equal(result.farmacias.length,20);
    if(index>=5)samples.push(elapsed);
  }
  samples.sort((a,b)=>a-b);
  const p95=samples[Math.ceil(samples.length*0.95)-1];
  console.log(JSON.stringify({kind:'F07_TEST_ONLY',candidateCount:count,samples:samples.length,
    p95Milliseconds:Number(p95.toFixed(2)),thresholdMilliseconds:2000,pass:p95<=2000,
    node:process.version,platform:os.platform(),release:os.release(),cpuCount:os.cpus().length}));
  if(p95>2000)process.exitCode=1;
} finally {
  for(const id of added.reverse()) {
    await admin.query('DELETE FROM f03.farmacia_publica WHERE farmacia_id=$1',[id]);
    await admin.query('DELETE FROM f01.farmacia_referencia WHERE id=$1',[id]);
  }
  await runtime.end();await admin.end();
}
