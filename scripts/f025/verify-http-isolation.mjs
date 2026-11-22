/** Read-only cross-tenant HTTP checks against the existing technical F02.5 TEST slot. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Client } from 'pg';
import { assertF025ConnectedTarget, assertF025EphemeralDatabase } from './test-env.mjs';

const local = new URL('../../.cache/f025-docker/', import.meta.url);
const database = JSON.parse(readFileSync(new URL('state.local.json', local), 'utf8')).database;
const users = JSON.parse(readFileSync(new URL('browser-users.local.json', local), 'utf8'));
assert.equal(users.kind, 'F025_BROWSER_ORDINARY_TEST');
assert.equal(users.database, database);
assert.equal(users.accounts.length, 5);
const secret = readFileSync(new URL('postgres-password.txt', local), 'utf8').trim();
const target = new URL(`postgresql://127.0.0.1:55431/${database}`);
target.username = 'f01_migrator';
target.password = secret;
assertF025EphemeralDatabase(target.toString(), { migration: true });
const db = new Client({ connectionString: target.toString() });
await db.connect();
try { await assertF025ConnectedTarget(db, database); }
finally { await db.end(); }

const root = 'http://127.0.0.1:3000/api/v1';
class Session {
  cookies = new Map();
  csrf = '';
  async request(method, path, body) {
    const headers = { Origin: 'http://127.0.0.1:5173',
      Cookie: [...this.cookies.values()].join('; ') };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (method !== 'GET' && this.csrf) headers['X-CSRF-Token'] = this.csrf;
    const response = await fetch(root + path, { method, headers,
      body: body === undefined ? undefined : JSON.stringify(body) });
    for (const value of response.headers.getSetCookie()) {
      const pair = value.split(';')[0];
      this.cookies.set(pair.split('=')[0], pair);
    }
    const text = await response.text();
    return { status: response.status, body: text ? JSON.parse(text) : null };
  }
  async login(account) {
    const csrf = await this.request('GET', '/auth/csrf');
    assert.equal(csrf.status, 200);
    this.csrf = csrf.body.csrfToken;
    assert.equal((await this.request('POST', '/auth/login', account)).status, 200);
    const renewed = await this.request('GET', '/auth/csrf');
    assert.equal(renewed.status, 200);
    this.csrf = renewed.body.csrfToken;
  }
}

const owners = [];
for (const [index, account] of users.accounts.entries()) {
  const session = new Session();
  await session.login(account);
  const result = await session.request('GET', '/me/memberships');
  assert.equal(result.status, 200);
  const matching = result.body.filter(item =>
    item.pharmacyName.startsWith(`Farmacia Navegador ${index + 1} `));
  assert(matching.length >= 1, `Falta farmacia TEST del propietario ${index + 1}`);
  const pharmacy = matching.at(-1).pharmacyId;
  assert.equal((await session.request('GET', `/farmacias/${pharmacy}/inventario`)).status, 200);
  assert.equal((await session.request('GET', `/farmacias/${pharmacy}/reservas`)).status, 200);
  owners.push({ session, pharmacy });
}

let pairs = 0;
let denials = 0;
for (const owner of owners) {
  for (const other of owners) {
    if (owner === other) continue;
    const inventory = await owner.session.request('GET', `/farmacias/${other.pharmacy}/inventario`);
    assert.equal(inventory.status, 404, 'Inventario ajeno accesible o error inesperado');
    const reservations = await owner.session.request('GET', `/farmacias/${other.pharmacy}/reservas`);
    assert([403, 404].includes(reservations.status), 'Reservas ajenas accesibles o error inesperado');
    pairs++;
    denials += 2;
  }
}
for (const [actor, target] of [[owners[0], owners[1]], [owners[1], owners[0]]]) {
  const history = await actor.session.request('GET', `/farmacias/${target.pharmacy}/importaciones`);
  assert.equal(history.status, 404, 'Historial de importación ajeno accesible');
  const preview = await actor.session.request('POST', `/farmacias/${target.pharmacy}/importaciones/vista-previa`);
  assert.equal(preview.status, 404, 'Vista previa de importación ajena autorizada');
  const workers = await actor.session.request('GET', `/pharmacies/${target.pharmacy}/memberships`);
  assert([403, 404].includes(workers.status), 'Trabajadores ajenos accesibles');
  const location = await actor.session.request('POST',
    `/farmacias/${target.pharmacy}/ubicacion/propuestas`,
    {direccionPublicable:'Dirección ficticia TEST',ciudad:'Lima',latitud:-12.04,
      longitud:-77.03,fuente:'Prueba sintética TEST'});
  assert([403, 404].includes(location.status), 'Ubicación ajena modificable');
  denials += 4;
}
const reviewer = new Session();
const reviewerCredentials = JSON.parse(readFileSync(new URL('credentials.local.json', local), 'utf8'));
await reviewer.login(reviewerCredentials.reviewer);
for (const owner of owners) {
  assert.equal((await reviewer.request('GET', `/farmacias/${owner.pharmacy}/inventario`)).status, 404);
  denials++;
  const reservation = await reviewer.request('GET', `/farmacias/${owner.pharmacy}/reservas`);
  assert([403, 404].includes(reservation.status), 'Revisor leyó reservas privadas sin membresía');
  denials++;
}
console.log(JSON.stringify({ kind: 'F025_HTTP_TENANT_ISOLATION', database: 'technical-TEST',
  pharmacies: owners.length, directedPairs: pairs, ownPositiveChecks: 10,
  privateDenials: denials, persistentDatabaseTouched: false }));
