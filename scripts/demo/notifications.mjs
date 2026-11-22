/** F05 local receiver and Outbox publisher; no external delivery channel. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Pool } from 'pg';
import { createApp } from '../../notifications/dist/app.js';
import { PgEventRepository } from '../../notifications/dist/events/repository.js';
import { ProcessEvent } from '../../notifications/dist/events/process-event.js';
import { loadNotificationPublisherConfig } from '../../backend/dist/config/notifications.js';
import { PgOutboxRepository } from '../../backend/dist/modules/notificaciones/infrastructure/outbox-repository.js';
import { HttpNotificationTransport } from '../../backend/dist/modules/notificaciones/infrastructure/notifications-client.js';
import { PublishOutbox } from '../../backend/dist/modules/notificaciones/application/publish-outbox.js';

const state = JSON.parse(readFileSync(new URL('../../.cache/manual-demo/state.local.json', import.meta.url), 'utf8'));
assert.equal(state.kind, 'FARMAFIND_MANUAL_DEMO_TEST_ONLY');
assert.match(state.database, /^farmafind_f01_test_[a-f0-9]{12}$/);
for (const value of [state.roles.notifier, state.roles.publisher]) {
  const url = new URL(value);
  assert.equal(url.hostname, '127.0.0.1'); assert.equal(url.port, '55431');
  assert.equal(url.pathname, `/${state.database}`);
}
const notifierPool = new Pool({ connectionString: state.roles.notifier, max: 3 });
const publisherPool = new Pool({ connectionString: state.roles.publisher, max: 2 });
try {
  for (const [pool, role] of [[notifierPool, 'f05_notifications_runtime'],
    [publisherPool, 'f05_outbox_publisher']]) {
    const result = await pool.query(`SELECT rolsuper,rolbypassrls,pg_has_role(session_user,$1,'member') AS permitted
      FROM pg_roles WHERE rolname=session_user`, [role]);
    assert.equal(result.rows[0]?.rolsuper, false);
    assert.equal(result.rows[0]?.rolbypassrls, false);
    assert.equal(result.rows[0]?.permitted, true);
  }
} catch (error) { await Promise.all([notifierPool.end(), publisherPool.end()]); throw error; }
const secret = state.notificationSecret;
assert.match(secret, /^[a-f0-9]{64}$/i);
const server = createApp({ processor: new ProcessEvent(new PgEventRepository(notifierPool),
  { now: () => new Date() }), secret }).listen(3001, '127.0.0.1',
  () => console.log('FarmaFind DEMO notificaciones locales: http://127.0.0.1:3001/health'));
const config = loadNotificationPublisherConfig(process.env);
const publisher = new PublishOutbox(new PgOutboxRepository(publisherPool),
  new HttpNotificationTransport('http://127.0.0.1:3001/internal/v1/events', secret,
    config.requestTimeoutMs), { now: () => new Date() }, config);
let busy = false;
const timer = setInterval(async () => {
  if (busy) return; busy = true;
  try { const result = await publisher.run();
    if (result.published || result.retried || result.blocked) console.log(`F05 DEMO: ${result.published} publicados, ${result.retried} reintentos, ${result.blocked} bloqueados`);
  } catch { console.error('F05 DEMO: error de publicación local'); }
  finally { busy = false; }
}, 3000);
let closing = false;
const stop = () => { if (closing) return; closing = true; clearInterval(timer);
  server.close(() => void Promise.all([notifierPool.end(), publisherPool.end()])); };
process.on('SIGINT', stop); process.on('SIGTERM', stop);
server.on('error', async error => { clearInterval(timer); console.error(`F05 DEMO: ${error.code || 'error'}`);
  await Promise.all([notifierPool.end(), publisherPool.end()]); process.exitCode = 1; });
