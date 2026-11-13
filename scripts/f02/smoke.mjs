/** Integrated HTTP smoke on FIX-01 TEST/DEMO; no server, remote service or real data. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Pool } from 'pg';
import request from 'supertest';
import { createLocalIdentityApp } from '../../backend/dist/identity-app.js';
import { validateLocalIdentityRuntime } from '../../backend/dist/config/identity-runtime.js';

const state = JSON.parse(readFileSync(new URL('../../.cache/f02-fixture/state.local.json', import.meta.url), 'utf8'));
assert.equal(state.kind, 'F02_FIX01_TEST_ONLY');
assert.match(state.database, /^farmafind_f01_test_[a-f0-9]{12}$/);
for (const name of ['authUrl','runtimeUrl']) {
  const url = new URL(state[name]);
  assert.equal(url.hostname, '127.0.0.1'); assert.equal(url.port, '55431');
  assert.equal(url.pathname, `/${state.database}`);
}
const origin = 'http://127.0.0.1:5173';
const config = validateLocalIdentityRuntime({ APP_MODE: 'identity', HOST: '127.0.0.1', PORT: '3000',
  F01_AUTH_DATABASE_URL: state.authUrl, F01_DATABASE_URL: state.runtimeUrl,
  F01_CSRF_KEY_HEX: state.csrfKey, F01_ABUSE_KEY_HEX: state.abuseKey,
  F01_ALLOWED_ORIGIN: origin, F01_CSRF_TRUSTED_ORIGIN: origin,
  F01_COOKIE_SECURE: 'false', F01_ALLOW_HTTP_LOOPBACK: 'true' });
const composed = await createLocalIdentityApp(config, url => new Pool({ connectionString: url, max: 4 }));
try {
  async function login(account) {
    const agent = request.agent(composed.app);
    const token = (await agent.get('/api/v1/auth/csrf').expect(200)).body.csrfToken;
    await agent.post('/api/v1/auth/login').set('Origin', origin).set('X-CSRF-Token', token)
      .send({ email: account.email, password: account.password }).expect(200);
    return agent;
  }
  await request(composed.app).get('/health').expect(200);
  const owner = await login(state.users.ownerA);
  await owner.get('/api/v1/auth/session').expect(200);
  const memberships = await owner.get('/api/v1/me/memberships').expect(200);
  assert(memberships.body.some(item => item.pharmacyId === state.pharmacies.alfa));
  const chosen = (await owner.get('/api/v1/auth/csrf').expect(200)).body.csrfToken;
  await owner.put('/api/v1/me/active-pharmacy').set('Origin', origin)
    .set('X-CSRF-Token', chosen).send({ pharmacyId: state.pharmacies.alfa }).expect(200);
  const catalog = await owner.get('/api/v1/catalogo/medicamentos').expect(200);
  assert.equal(catalog.body.length, 2);
  await owner.get(`/api/v1/farmacias/${state.pharmacies.alfa}/inventario`).expect(200);
  await owner.get(`/api/v1/farmacias/${state.pharmacies.alfa}/importaciones`).expect(200);
  await owner.get(`/api/v1/farmacias/${state.pharmacies.beta}/inventario`).expect(404);
  const worker = await login(state.users.workerA);
  await worker.get(`/api/v1/farmacias/${state.pharmacies.alfa}/inventario`).expect(404);
  console.log('F02 TEST/DEMO HTTP: sesión, selector, catálogo y accesos A/B verificados.');
} finally { await composed.close(); }
