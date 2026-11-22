/** F02 local demo only: no production credentials or remote database. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Pool } from 'pg';
import { createLocalIdentityApp } from '../../backend/dist/identity-app.js';
import { validateLocalIdentityRuntime } from '../../backend/dist/config/identity-runtime.js';

async function main() {
  const state = JSON.parse(readFileSync(new URL('../../.cache/f02-fixture/state.local.json', import.meta.url), 'utf8'));
  assert.equal(state.kind, 'F02_FIX01_TEST_ONLY');
  assert.match(state.database, /^farmafind_f01_test_[a-f0-9]{12}$/);
  for (const key of ['authUrl', 'runtimeUrl']) {
    const url = new URL(state[key]);
    assert.equal(url.hostname, '127.0.0.1'); assert.equal(url.port, '55431');
    assert.equal(url.pathname, `/${state.database}`);
  }
  const config = validateLocalIdentityRuntime({ APP_MODE: 'identity', HOST: '127.0.0.1', PORT: '3000',
    F01_AUTH_DATABASE_URL: state.authUrl, F01_DATABASE_URL: state.runtimeUrl,
    F01_CSRF_KEY_HEX: state.csrfKey, F01_ABUSE_KEY_HEX: state.abuseKey,
    F01_ALLOWED_ORIGIN: 'http://127.0.0.1:5173', F01_CSRF_TRUSTED_ORIGIN: 'http://127.0.0.1:5173',
    F01_COOKIE_SECURE: 'false', F01_ALLOW_HTTP_LOOPBACK: 'true' });
  const composed = await createLocalIdentityApp(config, url => new Pool({ connectionString: url, max: 4 }));
  const server = composed.app.listen(3000, '127.0.0.1', () => {
    console.log('F02 API TEST/DEMO: http://127.0.0.1:3000/health');
  });
  server.on('error', async () => { await composed.close(); process.exitCode = 1; });
  let closing = false;
  const stop = () => {
    if (closing) return;
    closing = true;
    server.close(() => { void composed.close(); });
  };
  process.on('SIGINT', stop); process.on('SIGTERM', stop);
}

main().catch(() => {
  console.error('F02: base TEST/DEMO local o roles no disponibles');
  process.exitCode = 1;
});
