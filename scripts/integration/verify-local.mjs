/** Real HTTP checks against the isolated integrated TEST API. No credentials are printed. */
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';

const state = JSON.parse(readFileSync(new URL('../../.cache/f03-fixture/state.local.json', import.meta.url), 'utf8'));
assert.equal(state.kind, 'F03_TEST_ONLY');
assert.match(state.database, /^farmafind_f01_test_[a-f0-9]{12}$/);
const port = Number(process.env.FARMAFIND_LOCAL_API_PORT ?? '3000');
assert(Number.isInteger(port) && port >= 1024 && port <= 65535);
const base = `http://127.0.0.1:${port}`;
const origin = 'http://127.0.0.1:5173';
const cookies = new Map();
const cookieHeader = () => [...cookies].map(([key, value]) => `${key}=${value}`).join('; ');
async function call(path, options = {}) {
  const response = await fetch(`${base}${path}`, { ...options, headers: { ...options.headers, Cookie: cookieHeader() } });
  for (const header of response.headers.getSetCookie()) {
    const pair = header.split(';', 1)[0];
    const separator = pair.indexOf('=');
    if (separator > 0) cookies.set(pair.slice(0, separator), pair.slice(separator + 1));
  }
  return { status: response.status, body: response.status === 204 || response.status === 202 ? null : await response.json() };
}
async function csrf() {
  const response = await call('/api/v1/auth/csrf');
  assert.equal(response.status, 200);
  assert.match(response.body.csrfToken, /^[a-f0-9]{64}$/);
  return response.body.csrfToken;
}
async function post(path, body, extra = {}) {
  return call(path, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin,
    'X-CSRF-Token': await csrf(), ...extra }, body: JSON.stringify(body) });
}

const health = await call('/health');
assert.equal(health.status, 200);
const search = await call('/api/v1/busquedas?q=paracetamol');
assert.equal(search.status, 200);
assert.equal(search.body.ofertas.length, 2);
const empty = await call('/api/v1/busquedas?q=sincoincidencia');
assert.equal(empty.status, 200);
assert.deepEqual(empty.body.ofertas, []);
const clinical = await call('/api/v1/asistente/consultar', { method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ consulta: '¿Qué dosis de paracetamol debo tomar?' }) });
assert.equal(clinical.status, 200);
assert.equal(clinical.body.intencion, 'CLINICA_RECHAZADA');
const anonymous = await call('/api/v1/reservas');
assert.equal(anonymous.status, 401);

// The generated identity is fictional and exists only in the already isolated TEST fixture.
const email = `local-${randomUUID()}@example.invalid`;
const password = `Aa1!${randomBytes(24).toString('hex')}`;
assert.equal((await post('/api/v1/auth/register', { email, password })).status, 202);
assert.equal((await post('/api/v1/auth/login', { email, password })).status, 200);
assert.equal((await call('/api/v1/auth/session')).status, 200);
const memberships = await call('/api/v1/me/memberships');
assert.equal(memberships.status, 200);
assert.deepEqual(memberships.body, []);
const own = await call('/api/v1/reservas');
assert.equal(own.status, 200);
assert.deepEqual(own.body, []);
const forbiddenQueue = await call(`/api/v1/farmacias/${state.pharmacies.alfa}/reservas`);
assert.notEqual(forbiddenQueue.status, 200);
const offer = search.body.ofertas[0];
const reservation = await post('/api/v1/reservas', { pharmacyId: offer.farmacia.id,
  medicationId: offer.medicamento.id, quantity: 1 }, { 'Idempotency-Key': randomUUID() });
assert.equal(reservation.status, 201, `Reserva TEST falló: ${reservation.status}`);
assert.equal((await call('/api/v1/reservas')).body.length, 1);
console.log('HTTP TEST: salud, búsqueda con datos/vacía, rechazo clínico, anonimato, registro, sesión,');
console.log('membresías vacías, reservas propias, denegación administrativa y creación: correctos.');
