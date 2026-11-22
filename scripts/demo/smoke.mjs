/** Read-only HTTP checks for the running manual DEMO; credentials stay in .cache. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const state = JSON.parse(readFileSync(new URL('../../.cache/manual-demo/state.local.json', import.meta.url), 'utf8'));
const credentials = JSON.parse(readFileSync(new URL('../../.cache/manual-demo/credentials.local.json', import.meta.url), 'utf8'));
assert.equal(state.kind, 'FARMAFIND_MANUAL_DEMO_TEST_ONLY');
const origin = 'http://127.0.0.1:5173';
function browser() {
  const cookies = new Map();
  return async (path, options = {}) => {
    const response = await fetch(`${origin}${path}`, { ...options,
      headers: { Origin: origin, Cookie: [...cookies].map(([key, value]) => `${key}=${value}`).join('; '),
        ...(options.headers ?? {}) } });
    for (const setCookie of response.headers.getSetCookie()) {
      const [pair] = setCookie.split(';'); const index = pair.indexOf('=');
      if (index > 0) cookies.set(pair.slice(0, index), pair.slice(index + 1));
    }
    return response;
  };
}
async function login(request, account) {
  const csrf = await request('/api/v1/auth/csrf'); assert.equal(csrf.status, 200);
  const { csrfToken } = await csrf.json();
  const response = await request('/api/v1/auth/login', { method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
    body: JSON.stringify(account) });
  assert.equal(response.status, 200, 'Inicio de sesión DEMO falló');
}
for (const path of ['/', '/search', '/mapa', '/assistant/conversation', '/identity', '/inventory', '/reservations',
  '/plantilla-inventario-demo.csv']) {
  assert.equal((await fetch(`${origin}${path}`)).status, 200, `Pantalla o plantilla no disponible: ${path}`);
}
for (const path of ['/api/v1/busquedas?q=producto&orden=relevancia&pagina=1',
  '/api/v1/geolocalizacion/farmacias?ciudad=lima']) {
  assert.equal((await fetch(`${origin}${path}`)).status, 200, `API pública no disponible: ${path}`);
}
assert.equal((await fetch(`${origin}/api/v1/reservas`)).status, 401);
const admin = browser(); await login(admin, credentials.adminAlfa);
assert.equal((await admin('/api/v1/auth/session')).status, 200);
assert.equal((await admin('/api/v1/me/memberships')).status, 200);
assert.equal((await admin(`/api/v1/farmacias/${state.pharmacies.alfa}/inventario`)).status, 200);
assert.equal((await admin(`/api/v1/farmacias/${state.pharmacies.alfa}/importaciones`)).status, 200);
assert.equal((await admin(`/api/v1/farmacias/${state.pharmacies.alfa}/reservas`)).status, 200);
assert.equal((await admin(`/api/v1/farmacias/${state.pharmacies.beta}/inventario`)).status, 404,
  'Aislamiento Alfa/Beta falló');
const client = browser(); await login(client, credentials.cliente);
assert.equal((await client('/api/v1/reservas')).status, 200);
assert.equal((await client(`/api/v1/farmacias/${state.pharmacies.alfa}/inventario`)).status, 404);
console.log('DEMO HTTP: pantallas, plantilla, búsqueda, mapa, autenticación, inventario, reservas y aislamiento Alfa/Beta correctos.');
