import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client, Pool } from 'pg';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { migrateTestDatabase } from '../../src/modules/usuarios/infrastructure/db/migrate.js';

const baseUrl = process.env.F01_TEST_DATABASE_URL;
const group = baseUrl ? describe : describe.skip;

group('T044: mutacion local TRABAJADOR protegida por PostgreSQL RLS real', () => {
  let admin: Client;
  let database: Client;
  let pool: Pool;
  let databaseName: string;
  let loginRole: string;
  let pharmacyA: string;
  let pharmacyB: string;
  let ownerA: string;
  let adminA: string;
  let workerA: string;
  let ownerB: string;
  let targetA: string;
  let targetB: string;
  const fingerprints = new Map<string, string>();

  beforeAll(async () => {
    const base = new URL(baseUrl!);
    if (base.hostname !== '127.0.0.1' || base.port !== '55431' ||
        base.pathname !== '/farmafind_f01_test') throw new Error('Solo PostgreSQL ficticio local F01');
    admin = new Client({ connectionString: baseUrl });
    await admin.connect();
    const suffix = randomBytes(6).toString('hex');
    databaseName = `farmafind_f01_test_${suffix}`;
    loginRole = `f01_test_admin_${suffix}`;
    await admin.query(`CREATE DATABASE "${databaseName}"`);
    const url = new URL(base);
    url.pathname = `/${databaseName}`;
    await migrateTestDatabase(url.toString(), async connectionString => {
      const client = new Client({ connectionString });
      await client.connect();
      return client;
    });
    database = new Client({ connectionString: url.toString() });
    await database.connect();
    pharmacyA = randomUUID(); pharmacyB = randomUUID();
    ownerA = randomUUID(); adminA = randomUUID(); workerA = randomUUID();
    ownerB = randomUUID(); targetA = randomUUID(); targetB = randomUUID();
    for (const [id, label] of [
      [ownerA, 'dueno-a'], [adminA, 'admin-a'], [workerA, 'trabajador-a'],
      [ownerB, 'dueno-b'], [targetA, 'objetivo-a'], [targetB, 'objetivo-b'],
    ]) {
      await database.query('INSERT INTO f01.usuario(id,email_canonico,password_hash) VALUES($1,$2,$3)',
        [id, `${label}@example.invalid`, '$argon2id$fixture-only']);
      const fingerprint = createHash('sha256').update(randomBytes(32)).digest('hex');
      fingerprints.set(id, fingerprint);
      await database.query(`INSERT INTO f01.sesion(usuario_id,token_fingerprint,idle_expires_at,absolute_expires_at)
        VALUES($1,decode($2,'hex'),now()+interval '1 hour',now()+interval '8 hours')`, [id, fingerprint]);
    }
    await database.query('INSERT INTO f01.farmacia_referencia(id,nombre_publico) VALUES($1,$2),($3,$4)',
      [pharmacyA, 'Farmacia ficticia A', pharmacyB, 'Farmacia ficticia B']);
    for (const [userId, pharmacyId, role] of [
      [ownerA, pharmacyA, 'DUENO'], [adminA, pharmacyA, 'ADMINISTRADOR'],
      [workerA, pharmacyA, 'TRABAJADOR'], [ownerB, pharmacyB, 'DUENO'],
    ]) {
      const member = await database.query(`INSERT INTO f01.usuario_farmacia(usuario_id,farmacia_id,rol)
        VALUES($1,$2,$3) RETURNING id`, [userId, pharmacyId, role]);
      if (role !== 'TRABAJADOR') await database.query(`INSERT INTO f01.delegacion
        (membresia_id,farmacia_id,capacidad,granted_by_usuario_id)
        VALUES($1,$2,'membership.manage',$3)`, [member.rows[0].id, pharmacyId, userId]);
    }
    const password = randomBytes(32).toString('hex');
    await admin.query(`CREATE ROLE "${loginRole}" LOGIN NOSUPERUSER NOBYPASSRLS PASSWORD '${password}'`);
    await admin.query(`GRANT f01_runtime TO "${loginRole}"`);
    url.username = loginRole;
    url.password = password;
    pool = new Pool({ connectionString: url.toString(), max: 1 });
  });

  afterAll(async () => {
    if (pool) await pool.end();
    if (database) await database.end();
    if (admin) {
      if (databaseName) await admin.query(`DROP DATABASE "${databaseName}"`);
      if (loginRole) await admin.query(`DROP ROLE "${loginRole}"`);
      await admin.end();
    }
  });

  async function asActor<T>(actor: string, pharmacyId: string | null,
    work: (client: import('pg').PoolClient) => Promise<T>): Promise<T> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SET LOCAL ROLE f01_runtime');
      await client.query("SELECT set_config('app.actor_user_id',$1,true)", [actor]);
      await client.query("SELECT set_config('app.session_fingerprint',$1,true)", [fingerprints.get(actor)]);
      if (pharmacyId) await client.query("SELECT set_config('app.farmacia_id',$1,true)", [pharmacyId]);
      const result = await work(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally { client.release(); }
  }

  const grantSql = `INSERT INTO f01.usuario_farmacia
    (usuario_id,farmacia_id,rol,estado,changed_by_usuario_id)
    VALUES($1,$2,$3,'ACTIVA',$4) RETURNING id,usuario_id,farmacia_id,rol,estado`;

  it('permite dueño de A conceder TRABAJADOR a otra persona de A y auditar en la misma transaccion', async () => {
    const member = await asActor(ownerA, pharmacyA, async client => {
      const result = await client.query(grantSql, [targetA, pharmacyA, 'TRABAJADOR', ownerA]);
      await client.query(`INSERT INTO f01.auditoria_acceso
        (actor_usuario_id,farmacia_id,accion,recurso_tipo,resultado,correlation_id)
        VALUES($1,$2,'MEMBERSHIP_GRANT','MEMBERSHIP','PERMITIDO',$3)`,
      [ownerA, pharmacyA, randomUUID()]);
      return result.rows[0];
    });
    expect(member).toMatchObject({ usuario_id: targetA, farmacia_id: pharmacyA, rol: 'TRABAJADOR', estado: 'ACTIVA' });
    const events = await database.query(`SELECT accion FROM f01.auditoria_acceso
      WHERE actor_usuario_id=$1 AND farmacia_id=$2`, [ownerA, pharmacyA]);
    expect(events.rows).toEqual([{ accion: 'MEMBERSHIP_GRANT' }]);
  });

  it('permite administrador autorizado de A revocar solo TRABAJADOR de A con auditoria', async () => {
    const member = await asActor(adminA, pharmacyA, async client => {
      const result = await client.query(`UPDATE f01.usuario_farmacia
        SET estado='REVOCADA',changed_by_usuario_id=$2,updated_at=now()
        WHERE usuario_id=$1 AND farmacia_id=$3 AND rol='TRABAJADOR'
        RETURNING id,estado`, [workerA, adminA, pharmacyA]);
      await client.query(`INSERT INTO f01.auditoria_acceso
        (actor_usuario_id,farmacia_id,accion,recurso_tipo,resultado,correlation_id)
        VALUES($1,$2,'MEMBERSHIP_REVOKE','MEMBERSHIP','PERMITIDO',$3)`,
      [adminA, pharmacyA, randomUUID()]);
      return result.rows[0];
    });
    expect(member).toMatchObject({ estado: 'REVOCADA' });
    const events = await database.query(`SELECT accion FROM f01.auditoria_acceso
      WHERE actor_usuario_id=$1 AND farmacia_id=$2`, [adminA, pharmacyA]);
    expect(events.rows).toEqual([{ accion: 'MEMBERSHIP_REVOKE' }]);
  });

  it.each([
    ['autoelevacion', () => [ownerA, pharmacyA, ownerA, pharmacyA, 'TRABAJADOR']],
    ['farmacia B ajena', () => [ownerA, pharmacyA, targetB, pharmacyB, 'TRABAJADOR']],
    ['trabajador sin permiso', () => [workerA, pharmacyA, targetB, pharmacyA, 'TRABAJADOR']],
    ['rol DUENO no delegable', () => [ownerA, pharmacyA, targetB, pharmacyA, 'DUENO']],
  ] as const)('deniega %s sin cambiar filas', async (_reason, fixture) => {
    const [actor, context, target, resource, role] = fixture();
    await expect(asActor(actor, context, client => client.query(grantSql,
      [target, resource, role, actor]))).rejects.toMatchObject({ code: '42501' });
    const rows = await database.query(`SELECT 1 FROM f01.usuario_farmacia
      WHERE usuario_id=$1 AND farmacia_id=$2`, [target, resource]);
    if (target === ownerA) expect(rows.rows).toHaveLength(1);
    else expect(rows.rows).toHaveLength(0);
  });

  it('sin tenant y al reutilizar la conexion no conserva autorización anterior', async () => {
    await expect(asActor(ownerA, null, client => client.query(grantSql,
      [targetB, pharmacyA, 'TRABAJADOR', ownerA]))).rejects.toMatchObject({ code: '42501' });
    await expect(asActor(ownerB, pharmacyB, client => client.query(grantSql,
      [targetB, pharmacyA, 'TRABAJADOR', ownerB]))).rejects.toMatchObject({ code: '42501' });
  });
  it('no permite revocar una membresia de DUENO aunque pertenezca a A', async () => {
    const ownerMembership = await database.query(`SELECT id,estado FROM f01.usuario_farmacia
      WHERE usuario_id=$1 AND farmacia_id=$2`, [ownerA, pharmacyA]);
    const denied = await asActor(adminA, pharmacyA, client => client.query(`UPDATE f01.usuario_farmacia
      SET estado='REVOCADA',changed_by_usuario_id=$2,updated_at=now()
      WHERE id=$1 RETURNING id`, [ownerMembership.rows[0].id, adminA]));
    expect(denied.rowCount).toBe(0);
    const unchanged = await database.query('SELECT estado FROM f01.usuario_farmacia WHERE id=$1',
      [ownerMembership.rows[0].id]);
    expect(unchanged.rows[0].estado).toBe('ACTIVA');
  });

  it('revierte la concesion si la auditoria atomica falla', async () => {
    await expect(asActor(ownerA, pharmacyA, async client => {
      await client.query(grantSql, [targetB, pharmacyA, 'TRABAJADOR', ownerA]);
      await client.query(`INSERT INTO f01.auditoria_acceso
        (actor_usuario_id,farmacia_id,accion,recurso_tipo,resultado,correlation_id)
        VALUES($1,$2,'MEMBERSHIP_GRANT','MEMBERSHIP','PERMITIDO',$3)`,
      [ownerA, pharmacyB, randomUUID()]);
    })).rejects.toMatchObject({ code: '42501' });
    const absent = await database.query(`SELECT 1 FROM f01.usuario_farmacia
      WHERE usuario_id=$1 AND farmacia_id=$2`, [targetB, pharmacyA]);
    expect(absent.rows).toHaveLength(0);
  });
});
