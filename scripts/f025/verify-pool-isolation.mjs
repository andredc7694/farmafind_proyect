/** F02.5 TEST-only: backend pool reuse, SQL RLS and rollback of a temporary revocation. */
import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { Client, Pool } from 'pg';
import { PgIdentityUnitOfWork } from '../../backend/dist/modules/usuarios/infrastructure/db/tenant-transaction.js';
import { assertF025ConnectedTarget, assertF025EphemeralDatabase } from './test-env.mjs';

const local = new URL('../../.cache/f025-docker/', import.meta.url);
const state = JSON.parse(readFileSync(new URL('state.local.json', local), 'utf8'));
const demo = JSON.parse(readFileSync(new URL('demo.local.json', local), 'utf8'));
const users = JSON.parse(readFileSync(new URL('browser-users.local.json', local), 'utf8'));
const password = readFileSync(new URL('postgres-password.txt', local), 'utf8').trim();
assert.equal(users.kind, 'F025_BROWSER_ORDINARY_TEST');
assert.equal(users.database, state.database);
assert.equal(demo.database, state.database);
assert.equal(users.accounts.length, 5);
assert.equal(assertF025EphemeralDatabase(demo.roles.runtime), state.database);
const migrationUrl = new URL(`postgresql://127.0.0.1:55431/${state.database}`);
migrationUrl.username = 'f01_migrator';
migrationUrl.password = password;
assertF025EphemeralDatabase(migrationUrl.toString(), { migration: true });

const admin = new Client({ connectionString: migrationUrl.toString() });
const pool = new Pool({ connectionString: demo.roles.runtime, max: 1 });
let passed = 0;
await admin.connect();
try {
  await assertF025ConnectedTarget(admin, state.database);
  const owners = [];
  for (const account of users.accounts.slice(0, 2)) {
    const result = await admin.query(`SELECT u.id AS user_id,m.farmacia_id,m.id AS membership_id
      FROM f01.usuario u JOIN f01.usuario_farmacia m ON m.usuario_id=u.id
      WHERE u.email_canonico=$1 AND m.rol='DUENO' AND m.estado='ACTIVA'
      ORDER BY m.created_at DESC LIMIT 1`, [account.email]);
    assert.equal(result.rows.length, 1, 'Falta dueño TEST');
    const secret = randomBytes(32).toString('hex');
    const fingerprint = createHash('sha256').update(Buffer.from(secret, 'hex')).digest();
    await admin.query(`INSERT INTO f01.sesion(usuario_id,token_fingerprint,idle_expires_at,absolute_expires_at)
      VALUES($1,$2,now()+interval '5 minutes',now()+interval '5 minutes')`,
    [result.rows[0].user_id, fingerprint]);
    owners.push({ ...result.rows[0], secret, fingerprint: fingerprint.toString('hex') });
  }
  const unit = new PgIdentityUnitOfWork(pool);
  const own = async (owner, other) => unit.runWithClient(owner.secret,
    async (transaction, client, actorId) => {
      assert.equal(actorId, owner.user_id);
      await transaction.useAuthorizedPharmacy(actorId, owner.farmacia_id);
      const result = await client.query(`SELECT farmacia_id FROM f025.farmacia_perfil
        WHERE farmacia_id IN ($1,$2) ORDER BY farmacia_id`,
      [owner.farmacia_id, other.farmacia_id]);
      assert.deepEqual(result.rows.map(row => row.farmacia_id), [owner.farmacia_id]);
      const context = await client.query(`SELECT pg_backend_pid() AS pid,current_user AS role,
        current_setting('app.farmacia_id',true) AS pharmacy`);
      assert.equal(context.rows[0].role, 'f01_runtime');
      assert.equal(context.rows[0].pharmacy, owner.farmacia_id);
      passed += 3;
      return context.rows[0].pid;
    });
  const firstPid = await own(owners[0], owners[1]);
  const neutral = await pool.query(`SELECT pg_backend_pid() AS pid,current_user AS role,
    current_setting('app.farmacia_id',true) AS pharmacy,
    current_setting('app.actor_user_id',true) AS actor`);
  assert.equal(neutral.rows[0].pid, firstPid);
  assert.notEqual(neutral.rows[0].role, 'f01_runtime');
  assert.equal(neutral.rows[0].pharmacy || '', '');
  assert.equal(neutral.rows[0].actor || '', '');
  passed += 4;
  assert.equal(await own(owners[1], owners[0]), firstPid);
  await assert.rejects(unit.runWithClient(owners[1].secret,
    (transaction, _client, actorId) =>
      transaction.useAuthorizedPharmacy(actorId, owners[0].farmacia_id)),
  /No autorizado/);
  passed++;
  assert.equal(await own(owners[0], owners[1]), firstPid);

  // A revocation is visible to RLS in its transaction, then fully rolled back.
  await admin.query('BEGIN');
  try {
    await admin.query(`UPDATE f01.usuario_farmacia SET estado='REVOCADA'
      WHERE id=$1 AND estado='ACTIVA'`, [owners[0].membership_id]);
    await admin.query('SET LOCAL ROLE f01_runtime');
    await admin.query("SELECT set_config('app.actor_user_id',$1,true)", [owners[0].user_id]);
    await admin.query("SELECT set_config('app.session_fingerprint',$1,true)", [owners[0].fingerprint]);
    await admin.query("SELECT set_config('app.farmacia_id',$1,true)", [owners[0].farmacia_id]);
    const denied = await admin.query('SELECT count(*)::int AS n FROM f025.farmacia_perfil');
    assert.equal(denied.rows[0].n, 0);
    passed++;
  } finally { await admin.query('ROLLBACK'); }
  assert.equal(await own(owners[0], owners[1]), firstPid);
  console.log(JSON.stringify({ kind: 'F025_POOL_ISOLATION', database: 'technical-TEST',
    assertions: passed, reusedBackendConnection: true, revocationRolledBack: true,
    persistentDatabaseTouched: false }));
} finally {
  await pool.end();
  await admin.end();
}
