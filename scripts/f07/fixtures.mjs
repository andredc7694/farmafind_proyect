/** F07 TEST/DEMO data only. This module never connects to a database by itself. */
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const F07_TEST_PHARMACIES = Object.freeze([
  { key: 'alfa-centro', name: 'Farmacia Alfa Centro', city: 'lima', address: 'Av. Ficticia 100, Lima', latitude: -12.0464, longitude: -77.0428 },
  { key: 'alfa-norte', name: 'Farmacia Alfa Norte', city: 'lima', address: 'Jr. Ejemplo 200, Lima', latitude: -12.0340, longitude: -77.0520 },
  { key: 'beta-centro', name: 'Farmacia Beta Centro', city: 'lima', address: 'Calle Demo 300, Lima', latitude: -12.0600, longitude: -77.0500 },
  { key: 'gamma-sur', name: 'Farmacia Gamma Sur', city: 'lima', address: 'Av. Prueba 400, Lima', latitude: -12.1000, longitude: -77.0600 },
  { key: 'delta-arequipa', name: 'Farmacia Delta Arequipa', city: 'arequipa', address: 'Calle Ficticia 500, Arequipa', latitude: -16.3989, longitude: -71.5350 },
]);

export const F07_TEST_IDENTITIES = Object.freeze([
  { key: 'alfa-proposer', pharmacy: 'alfa-centro', capability: 'GEO_LOCATION_PROPOSE' },
  { key: 'alfa-reviewer', pharmacy: 'alfa-centro', capability: 'GEO_LOCATION_REVIEW' },
  { key: 'beta-proposer', pharmacy: 'beta-centro', capability: 'GEO_LOCATION_PROPOSE' },
  { key: 'beta-reviewer', pharmacy: 'beta-centro', capability: 'GEO_LOCATION_REVIEW' },
]);

export const F07_TEST_OFFERS = Object.freeze([
  { pharmacy: 'alfa-centro', product: 'producto ficticio a', priceCents: 1200 },
  { pharmacy: 'alfa-norte', product: 'producto ficticio a', priceCents: 1300 },
  { pharmacy: 'beta-centro', product: 'producto ficticio b', priceCents: 1400 },
]);

/** Distancias lineales redondeadas a 0,01 km desde Alfa Centro; cero inferencia de rutas. */
export const F07_EXPECTED_DISTANCE_KM = Object.freeze({
  'alfa-centro': 0, 'alfa-norte': 1.70, 'beta-centro': 1.70,
  'gamma-sur': 6.25, 'delta-arequipa': 765.80,
});

/** Fail closed before any code is allowed to perform a TEST write. */
export function assertF07EphemeralDatabase(urlText) {
  assert(urlText, 'F07: F07_TEST_DATABASE_URL es obligatoria');
  const url = new URL(urlText);
  assert(['postgres:', 'postgresql:'].includes(url.protocol), 'F07: protocolo PostgreSQL requerido');
  assert.equal(url.hostname, '127.0.0.1', 'F07: solo loopback');
  assert.equal(url.port, '55431', 'F07: puerto TEST requerido');
  assert.match(url.pathname, /^\/farmafind_f01_test_[a-f0-9]{12}$/, 'F07: base efímera requerida');
  assert(url.username && url.password, 'F07: credenciales locales requeridas');
  return url;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  assert.equal(process.argv[2], 'validate', 'Uso: node scripts/f07/fixtures.mjs validate');
  assert.equal(F07_TEST_PHARMACIES.length, 5);
  assert.equal(F07_TEST_IDENTITIES.length, 4);
  assert.equal(new Set(F07_TEST_PHARMACIES.map(value => value.key)).size, 5);
  assert.equal(Object.keys(F07_EXPECTED_DISTANCE_KM).length, 5);
  console.log('F07: 5 farmacias, 4 identidades y ofertas ficticias validadas; no se escribió en PostgreSQL.');
}
