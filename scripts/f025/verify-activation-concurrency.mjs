/** Two first-time approvals of one synthetic application, in the F02.5 technical TEST database only. */
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { Client } from 'pg';
import { assertF025ConnectedTarget, assertF025EphemeralDatabase } from './test-env.mjs';

const local = new URL('../../.cache/f025-docker/', import.meta.url);
const state = JSON.parse(readFileSync(new URL('state.local.json', local), 'utf8'));
const demo = JSON.parse(readFileSync(new URL('demo.local.json', local), 'utf8'));
const users = JSON.parse(readFileSync(new URL('browser-users.local.json', local), 'utf8'));
const reviewer = JSON.parse(readFileSync(new URL('credentials.local.json', local), 'utf8')).reviewer;
const markerFile = new URL('activation-concurrency.local.json', local);
if (existsSync(markerFile)) throw new Error('F02.5: la carrera TEST ya se ejecutó; no repetir altas');
assert.equal(users.database, state.database);
assert.equal(demo.database, state.database);
assert.equal(assertF025EphemeralDatabase(demo.roles.runtime), state.database);
const password = readFileSync(new URL('postgres-password.txt', local), 'utf8').trim();
const url = new URL(`postgresql://127.0.0.1:55431/${state.database}`);
url.username = 'f01_migrator'; url.password = password;
assertF025EphemeralDatabase(url.toString(), { migration: true });
const admin = new Client({ connectionString: url.toString() });
await admin.connect();
let passed = 0;
try {
  await assertF025ConnectedTarget(admin, state.database);
  const identities = [];
  for (const email of [users.accounts[0].email, reviewer.email]) {
    const result = await admin.query('SELECT id FROM f01.usuario WHERE email_canonico=$1 AND estado=$2',
      [email, 'ACTIVO']);
    assert.equal(result.rows.length, 1);
    const fingerprint = randomBytes(32).toString('hex');
    await admin.query(`INSERT INTO f01.sesion(usuario_id,token_fingerprint,idle_expires_at,absolute_expires_at)
      VALUES($1,decode($2,'hex'),now()+interval '5 minutes',now()+interval '5 minutes')`,
    [result.rows[0].id, fingerprint]);
    identities.push({ id: result.rows[0].id, fingerprint });
  }
  const [applicant, platform] = identities;
  const context = async (client, identity) => {
    await client.query('SET LOCAL ROLE f01_runtime');
    await client.query("SELECT set_config('app.actor_user_id',$1,true)", [identity.id]);
    await client.query("SELECT set_config('app.session_fingerprint',$1,true)", [identity.fingerprint]);
  };
  const makeReady = async (client, rollback = false) => {
    const name = `Farmacia Carrera ${randomBytes(5).toString('hex')}`;
    await client.query('BEGIN');
    const row = await client.query(`INSERT INTO f025.solicitud(solicitante_id,nombre_comercial,
      contacto,direccion,departamento,provincia,distrito,representante)
      VALUES($1,$2,'Contacto TEST','Dirección TEST','Lima','Lima','Lima','Representante TEST')
      RETURNING id`, [applicant.id, name]);
    const id = row.rows[0].id;
    await context(client, applicant);
    const sent = await client.query("SELECT * FROM f025.change_application($1,1,'ENVIAR',NULL,$2)",
      [id, randomUUID()]);
    assert.equal(sent.rows[0].new_state, 'PENDIENTE'); passed++;
    await client.query("SELECT set_config('app.actor_user_id',$1,true)", [platform.id]);
    await client.query("SELECT set_config('app.session_fingerprint',$1,true)", [platform.fingerprint]);
    const review = await client.query(`SELECT * FROM f025.change_application(
      $1,2,'INICIAR_REVISION','Revisión de carrera TEST',$2)`, [id, randomUUID()]);
    assert.equal(review.rows[0].new_state, 'EN_REVISION'); passed++;
    if (!rollback) await client.query('COMMIT');
    return id;
  };
  const id = await makeReady(admin);
  const key = randomBytes(24).toString('hex');
  const approve = async (applicationId, idempotencyKey, commit = true) => {
    const client = new Client({ connectionString: demo.roles.runtime });
    await client.connect();
    try {
      await client.query('BEGIN');
      await context(client, platform);
      const result = await client.query('SELECT * FROM f025.activate_application($1,$2,$3,$4,$5)',
        [applicationId, 3, idempotencyKey, 'Aprobación concurrente TEST', randomUUID()]);
      if (commit) await client.query('COMMIT');
      else await client.query('ROLLBACK');
      return result.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally { await client.end(); }
  };
  const results = await Promise.allSettled([approve(id, key), approve(id, key)]);
  assert(results.every(item => item.status === 'fulfilled'), 'Aprobaciones concurrentes inesperadas');
  const first = results[0].value;
  assert.equal(results[1].value.activated_farmacia_id, first.activated_farmacia_id); passed++;
  assert.equal(results[1].value.owner_membership_id, first.owner_membership_id); passed++;
  const counts = (await admin.query(`SELECT
    (SELECT count(*)::int FROM f025.activacion WHERE solicitud_id=$1) AS activations,
    (SELECT count(*)::int FROM f01.farmacia_referencia WHERE id=$2) AS pharmacies,
    (SELECT count(*)::int FROM f01.usuario_farmacia WHERE id=$3 AND rol='DUENO') AS owners,
    (SELECT count(*)::int FROM f025.outbox_evento WHERE solicitud_id=$1 AND tipo='SOLICITUD_APROBADA') AS events`,
  [id, first.activated_farmacia_id, first.owner_membership_id])).rows[0];
  for (const value of Object.values(counts)) { assert.equal(value, 1); passed++; }
  await assert.rejects(approve(id, randomBytes(24).toString('hex')),
    error => error.code === '23505'); passed++;
  const replay = await approve(id, key);
  assert.equal(replay.activated_farmacia_id, first.activated_farmacia_id); passed++;

  // The second fixture exists only inside this transaction and is rolled back with its approval.
  const rollbackId = await makeReady(admin, true);
  await context(admin, platform);
  const temporary = await admin.query('SELECT * FROM f025.activate_application($1,$2,$3,$4,$5)',
    [rollbackId, 3, randomBytes(24).toString('hex'), 'Aprobación reversible TEST', randomUUID()]);
  assert.equal(temporary.rows.length, 1); passed++;
  await admin.query('ROLLBACK');
  const absent = await admin.query(`SELECT count(*)::int AS n FROM f025.solicitud WHERE id=$1`, [rollbackId]);
  assert.equal(absent.rows[0].n, 0); passed++;
  writeFileSync(markerFile, JSON.stringify({ kind: 'F025_CONCURRENCY_TEST_ONLY', database: state.database,
    applicationId: id, pharmacyId: first.activated_farmacia_id }) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ kind: 'F025_ACTIVATION_CONCURRENCY', database: 'technical-TEST',
    assertions: passed, simultaneousApprovals: 2, activations: 1, owners: 1,
    outboxEvents: 1, incompatibleReplayDenied: true, rollbackVerified: true,
    persistentDatabaseTouched: false }));
} finally { await admin.end(); }
