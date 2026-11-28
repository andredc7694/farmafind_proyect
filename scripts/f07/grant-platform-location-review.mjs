/** F07.1 T018: concede «Revisar ubicaciones» (f07.platform_location_grant) al revisor TEST de la
 *  DEMO manual. Solo con F025_DEMO_SLOT=manual, en la base TEST marcada del clúster F02.5 y con la
 *  marca explícita --autorizado-por-andre=AAAA-MM-DD. Idempotente: si ya hay una concesión activa no
 *  agrega otra. No crea usuarios, roles ni permisos F02.5; no toca farmacias, inventario ni reservas. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { Client } from 'pg';
import { assertF025ConnectedTarget } from '../f025/test-env.mjs';
import { localStateName } from '../f025/demo-slot.mjs';

assert.equal(process.env.F025_DEMO_SLOT, 'manual', 'Solo para la DEMO manual (F025_DEMO_SLOT=manual)');
const flag = process.argv.find(value => value.startsWith('--autorizado-por-andre='));
const authorizedOn = flag?.split('=')[1];
assert.match(authorizedOn ?? '', /^\d{4}-\d{2}-\d{2}$/, 'Falta --autorizado-por-andre=AAAA-MM-DD');
const dir = new URL('../../.cache/f025-docker/', import.meta.url);
const state = JSON.parse(readFileSync(new URL(localStateName('demo.local.json'), dir), 'utf8'));
assert.equal(state.kind, 'F025_TEST_DEMO_ONLY');
assert.notEqual(state.database, 'farmafind_f01_test');
const credential = JSON.parse(readFileSync(new URL(localStateName('credentials.local.json'), dir), 'utf8'));
const secret = readFileSync(new URL('postgres-password.txt', dir), 'utf8').trim();
const url = new URL(`postgresql://127.0.0.1:55431/${state.database}`);
url.username = 'f01_migrator'; url.password = secret;
const db = new Client({ connectionString: url.toString() }); await db.connect();
try {
  await assertF025ConnectedTarget(db, state.database);
  await db.query('BEGIN');
  try {
    const actor = (await db.query('SELECT id FROM f01.usuario WHERE email_canonico=$1 AND estado=\'ACTIVO\'',
      [credential.reviewer.email])).rows[0]?.id;
    assert(actor, 'Revisor TEST no existe o no está activo');
    const role = (await db.query(`SELECT count(*)::int AS n FROM f01.platform_role_assignment
      WHERE usuario_id=$1 AND role_code='ADMINISTRADOR_PLATAFORMA' AND estado='ACTIVA'`, [actor])).rows[0].n;
    assert.equal(role, 1, 'El revisor TEST no tiene ADMINISTRADOR_PLATAFORMA activo');
    const memberships = (await db.query('SELECT count(*)::int AS n FROM f01.usuario_farmacia WHERE usuario_id=$1', [actor])).rows[0].n;
    const existing = (await db.query(`SELECT id,approval_id,granted_at FROM f07.platform_location_grant
      WHERE actor_id=$1 AND estado='ACTIVA'`, [actor])).rows[0];
    let grant = existing;
    if (!existing) {
      const approval = (await db.query('SELECT integrity_hash FROM f01.privileged_approval WHERE id=$1',
        [state.reviewerApproval])).rows[0];
      assert(approval, 'Expediente BOOT-01 TEST ausente');
      grant = (await db.query(`INSERT INTO f07.platform_location_grant(actor_id,approval_id,approval_sha256,reason)
        VALUES($1,$2,$3,$4) RETURNING id,approval_id,granted_at`, [actor, randomUUID(), approval.integrity_hash,
        `Revisión de ubicaciones DEMO TEST F07.1 (T018), autorizada por Andre el ${authorizedOn}`])).rows[0];
    }
    await db.query('COMMIT');
    console.log(JSON.stringify({ result: existing ? 'YA_EXISTIA' : 'CONCEDIDA', grantId: grant.id,
      approvalId: grant.approval_id, grantedAt: grant.granted_at, reviewerMemberships: memberships }));
  } catch (error) { await db.query('ROLLBACK'); throw error; }
} finally { await db.end(); }
