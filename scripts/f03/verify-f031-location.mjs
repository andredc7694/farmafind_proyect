/** F03.1 T012: `farmacia.ubicacion` con PostgreSQL real, en la base TEST efímera del fixture F07
 *  (.cache/f07-fixture/state.local.json). Nunca farmafind_f01_test ni la DEMO. Todo se revierte. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Client } from 'pg';
import { assertF07EphemeralDatabase } from '../f07/fixtures.mjs';
import { PgPublicOfferRepository } from '../../backend/dist/modules/busqueda/infrastructure/public-offer-repository.js';
import { parsePublicQuery } from '../../backend/dist/modules/busqueda/domain/public-query.js';
import { searchTerms } from '../../backend/dist/modules/busqueda/domain/search-terms.js';

const state = JSON.parse(readFileSync(new URL('../../.cache/f07-fixture/state.local.json', import.meta.url), 'utf8'));
assert.equal(state.kind, 'F07_TEST_ONLY');
for (const forbidden of ['farmafind_f01_test', 'farmafind_f01_test_d0570879cf41']) assert.notEqual(state.database, forbidden);
const secretFile = process.env.F031_SECRET_FILE ?? new URL('../../.cache/f025-docker/postgres-password.txt', import.meta.url);
const url = new URL(`postgresql://127.0.0.1:55431/${state.database}`); url.username = 'f01_migrator';
url.password = readFileSync(secretFile, 'utf8').trim();
assertF07EphemeralDatabase(url.toString());
const client = new Client({ connectionString: url.toString() }); await client.connect();
const ids = state.pharmacyIds; const results = {}; let passed = 0;
const ok = (name, condition) => { assert.ok(condition, name); results[name] = 'OK'; passed++; };
try {
  await client.query('BEGIN');
  const marker = (await client.query(`SELECT shobj_description(oid,'pg_database') AS m FROM pg_database WHERE datname=current_database()`)).rows[0].m;
  assert.equal(marker, 'FarmaFind F07 TEST efimera');
  const product = (await client.query(`SELECT id FROM f02.medicamento WHERE nombre='producto ficticio a'`)).rows[0].id;
  for (const key of ['gamma-sur', 'delta-arequipa'])
    await client.query(`INSERT INTO f02.inventario(farmacia_id,medicamento_id,precio_centavos,cantidad_fisica,cantidad_comprometida,ultima_revision_at)
      VALUES($1,$2,1500,10,0,now()) ON CONFLICT DO NOTHING`, [ids[key], product]);
  // alfa-norte: coordenadas guardadas pero PENDIENTE; beta-centro: RECHAZADA; delta: farmacia INACTIVA.
  await client.query(`UPDATE f03.farmacia_publica SET estado_ubicacion='PENDIENTE' WHERE farmacia_id=$1`, [ids['alfa-norte']]);
  await client.query(`UPDATE f03.farmacia_publica SET estado_ubicacion='RECHAZADA' WHERE farmacia_id=$1`, [ids['beta-centro']]);
  await client.query(`UPDATE f01.farmacia_referencia SET estado='INACTIVA' WHERE id=$1`, [ids['delta-arequipa']]);
  const stored = (await client.query(`SELECT count(*)::int AS n FROM f03.farmacia_publica WHERE farmacia_id=$1 AND latitud IS NOT NULL`, [ids['alfa-norte']])).rows[0].n;
  ok('fixture: alfa-norte conserva coordenadas guardadas', stored === 1);
  await client.query('SET LOCAL ROLE f01_runtime');
  const query = parsePublicQuery({ q: 'producto ficticio' });
  // F03.2: el repositorio recibe las palabras y devuelve { offer, matches }.
  const byPharmacy = matched => Object.fromEntries(matched.map(({ offer }) => [offer.farmacia.id, offer.farmacia.ubicacion]));
  const terms = searchTerms(query.term);
  const on = byPharmacy(await new PgPublicOfferRepository(client, { exposeVerifiedLocation: true }).search(terms, query, 200));
  ok('verificada (alfa-centro) trae coordenadas', on[ids['alfa-centro']] && Number.isFinite(on[ids['alfa-centro']].latitud));
  ok('verificada (gamma-sur) trae coordenadas', on[ids['gamma-sur']] && Number.isFinite(on[ids['gamma-sur']].longitud));
  ok('PENDIENTE con coordenadas guardadas → null', Object.hasOwn(on, ids['alfa-norte']) && on[ids['alfa-norte']] === null);
  ok('RECHAZADA → null', Object.hasOwn(on, ids['beta-centro']) && on[ids['beta-centro']] === null);
  ok('farmacia INACTIVA no aparece', !Object.hasOwn(on, ids['delta-arequipa']));
  ok('solo las claves aprobadas', Object.values(on).every(value => value === null || Object.keys(value).sort().join() === 'latitud,longitud'));
  const off = byPharmacy(await new PgPublicOfferRepository(client).search(terms, query, 200));
  ok('opción apagada (sin F07) → todo null', Object.keys(off).length === Object.keys(on).length && Object.values(off).every(value => value === null));
  console.log(JSON.stringify({ database: state.database, passed, results, rolledBack: true }, null, 1));
} finally { await client.query('ROLLBACK').catch(() => undefined); await client.end(); }
