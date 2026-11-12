import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client, Pool } from 'pg';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { migrateTestDatabase } from '../../src/modules/usuarios/infrastructure/db/migrate.js';
import { PgIdentityUnitOfWork } from '../../src/modules/usuarios/infrastructure/db/tenant-transaction.js';

const baseUrl = process.env.F01_TEST_DATABASE_URL;
const testGroup = baseUrl ? describe : describe.skip;

testGroup('contexto F01 con rol runtime y PostgreSQL real', () => {
  let admin: Client;
  let database: Client;
  let pool: Pool;
  let testName: string;
  let roleName: string;
  let url: URL;
  let actorA: string;
  let actorB: string;
  let secretA: string;
  let secretB: string;
  let pharmacyA: string;
  let pharmacyB: string;

  beforeAll(async () => {
    const base = new URL(baseUrl!);
    if (base.hostname !== '127.0.0.1' || base.port !== '55431' || base.pathname !== '/farmafind_f01_test') {
      throw new Error('Pruebas F01: solo instancia local aislada y base farmafind_f01_test');
    }
    admin = new Client({ connectionString: baseUrl });
    await admin.connect();
    const suffix = randomBytes(6).toString('hex');
    testName = `farmafind_f01_test_${suffix}`;
    roleName = `f01_test_login_${suffix}`;
    await admin.query(`CREATE DATABASE "${testName}"`);
    url = new URL(baseUrl!);
    url.pathname = `/${testName}`;
    database = new Client({ connectionString: url.toString() });
    await database.connect();
    await migrateTestDatabase(url.toString(), async connectionString => {
      const client = new Client({ connectionString });
      await client.connect();
      return client;
    });

    actorA = randomUUID(); actorB = randomUUID();
    pharmacyA = randomUUID(); pharmacyB = randomUUID();
    for (const [id, email] of [[actorA, 'a@example.invalid'], [actorB, 'b@example.invalid']]) {
      await database.query('INSERT INTO f01.usuario(id,email_canonico,password_hash) VALUES($1,$2,$3)',
        [id, email, '$argon2id$fixture-only']);
    }
    for (const [id, name] of [[pharmacyA, 'Farmacia ficticia A'], [pharmacyB, 'Farmacia ficticia B']]) {
      await database.query('INSERT INTO f01.farmacia_referencia(id,nombre_publico) VALUES($1,$2)', [id, name]);
    }
    await database.query('INSERT INTO f01.usuario_farmacia(usuario_id,farmacia_id,rol) VALUES($1,$2,$3),($4,$5,$6)',
      [actorA, pharmacyA, 'TRABAJADOR', actorB, pharmacyB, 'TRABAJADOR']);

    secretA = randomBytes(32).toString('hex'); secretB = randomBytes(32).toString('hex');
    for (const [userId, secret] of [[actorA, secretA], [actorB, secretB]]) {
      const fingerprint = createHash('sha256').update(Buffer.from(secret, 'hex')).digest();
      await database.query(`
        INSERT INTO f01.sesion(usuario_id,token_fingerprint,idle_expires_at,absolute_expires_at)
        VALUES($1,$2,now()+interval '30 minutes',now()+interval '8 hours')
      `, [userId, fingerprint]);
    }

    const password = randomBytes(32).toString('hex');
    await admin.query(`CREATE ROLE "${roleName}" LOGIN NOSUPERUSER NOBYPASSRLS PASSWORD '${password}'`);
    await admin.query(`GRANT f01_runtime TO "${roleName}"`);
    const runtimeUrl = new URL(url);
    runtimeUrl.username = roleName;
    runtimeUrl.password = password;
    pool = new Pool({ connectionString: runtimeUrl.toString(), max: 1 });
  });

  afterAll(async () => {
    if (pool) await pool.end();
    if (database) await database.end();
    if (admin) {
      if (testName) await admin.query(`DROP DATABASE "${testName}"`);
      if (roleName) await admin.query(`DROP ROLE "${roleName}"`);
      await admin.end();
    }
  });

  it('lista solo membresías propias y fija tenant tras validar membresía activa', async () => {
    const uow = new PgIdentityUnitOfWork(pool);
    const result = await uow.run(secretA, async (tx, verifiedActor) => {
      expect(verifiedActor).toBe(actorA);
      const own = await tx.listOwnMemberships(actorA);
      expect(own.map(row => row.pharmacyId)).toEqual([pharmacyA]);
      await tx.useAuthorizedPharmacy(actorA, pharmacyA);
      return tx.context();
    });
    expect(result).toEqual({ actorUserId: actorA, pharmacyId: pharmacyA, role: 'f01_runtime' });
  });

  it('deniega otro tenant y membresía revocada sin aceptar un ID conocido', async () => {
    const uow = new PgIdentityUnitOfWork(pool);
    await expect(uow.run(secretA, tx => tx.useAuthorizedPharmacy(actorA, pharmacyB))).rejects.toThrow('No autorizado');
    await database.query("UPDATE f01.usuario_farmacia SET estado='REVOCADA' WHERE usuario_id=$1", [actorA]);
    await expect(uow.run(secretA, tx => tx.useAuthorizedPharmacy(actorA, pharmacyA))).rejects.toThrow('No autorizado');
    await database.query("UPDATE f01.usuario_farmacia SET estado='ACTIVA' WHERE usuario_id=$1", [actorA]);
  });

  it('limpia actor y tenant tras commit y rollback al reutilizar la conexión', async () => {
    const uow = new PgIdentityUnitOfWork(pool);
    await uow.run(secretA, tx => tx.useAuthorizedPharmacy(actorA, pharmacyA));
    let client = await pool.connect();
    try {
      const context = await client.query("SELECT current_setting('app.actor_user_id',true) AS actor, current_setting('app.farmacia_id',true) AS pharmacy");
      expect(context.rows[0].actor || null).toBeNull();
      expect(context.rows[0].pharmacy || null).toBeNull();
    } finally { client.release(); }

    await expect(uow.run(secretB, async tx => {
      await tx.useAuthorizedPharmacy(actorB, pharmacyB);
      throw new Error('rollback intencional');
    })).rejects.toThrow('rollback intencional');
    client = await pool.connect();
    try {
      const context = await client.query("SELECT current_setting('app.actor_user_id',true) AS actor, current_setting('app.farmacia_id',true) AS pharmacy");
      expect(context.rows[0].actor || null).toBeNull();
      expect(context.rows[0].pharmacy || null).toBeNull();
    } finally { client.release(); }
    const next = await uow.run(secretB, async tx => {
      await tx.useAuthorizedPharmacy(actorB, pharmacyB);
      return tx.context();
    });
    expect(next.pharmacyId).toBe(pharmacyB);
  });

  it('solo acepta sesión opaca vigente; ID de usuario, sesión revocada o expirada fallan', async () => {
    const uow = new PgIdentityUnitOfWork(pool);
    await expect(uow.run(actorA, tx => tx.listOwnMemberships(actorA))).rejects.toThrow('No autorizado');
    await expect(uow.run(randomBytes(32).toString('hex'), tx => tx.listOwnMemberships(actorA)))
      .rejects.toThrow('No autorizado');
    await database.query("UPDATE f01.sesion SET estado='REVOCADA',revoked_at=now() WHERE usuario_id=$1", [actorA]);
    await expect(uow.run(secretA, tx => tx.listOwnMemberships(actorA))).rejects.toThrow('No autorizado');
    await database.query("UPDATE f01.sesion SET estado='VIGENTE',revoked_at=NULL,idle_expires_at=now()-interval '1 second' WHERE usuario_id=$1", [actorA]);
    await expect(uow.run(secretA, tx => tx.listOwnMemberships(actorA))).rejects.toThrow('No autorizado');
    await database.query("UPDATE f01.sesion SET created_at=now()-interval '1 day',idle_expires_at=now()-interval '1 hour',absolute_expires_at=now()-interval '1 second' WHERE usuario_id=$1", [actorA]);
    await expect(uow.run(secretA, tx => tx.listOwnMemberships(actorA))).rejects.toThrow('No autorizado');
  });

  it('rechaza usuario inactivo y pool privilegiado', async () => {
    const uow = new PgIdentityUnitOfWork(pool);
    await database.query("UPDATE f01.usuario SET estado='INACTIVO' WHERE id=$1", [actorA]);
    await expect(uow.run(secretA, tx => tx.listOwnMemberships(actorA))).rejects.toThrow('No autorizado');
    const privilegedPool = new Pool({ connectionString: url.toString(), max: 1 });
    try {
      await expect(new PgIdentityUnitOfWork(privilegedPool).run(secretB, tx => tx.listOwnMemberships(actorB))).rejects.toThrow('rol privilegiado');
    } finally { await privilegedPool.end(); }
  });

  it('RLS directo niega filas sin actor y cambios de membresía con rol runtime', async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SET LOCAL ROLE f01_runtime');
      const sessions = await client.query('SELECT usuario_id FROM f01.sesion');
      expect(sessions.rows).toEqual([]);
      const withoutActor = await client.query('SELECT farmacia_id FROM f01.usuario_farmacia');
      expect(withoutActor.rows).toEqual([]);
      await client.query("SELECT set_config('app.actor_user_id',$1,true)", [actorB]);
      const own = await client.query('SELECT farmacia_id FROM f01.usuario_farmacia');
      expect(own.rows.map(row => row.farmacia_id)).toEqual([pharmacyB]);
      await expect(client.query("UPDATE f01.usuario_farmacia SET rol='DUENO' WHERE usuario_id=$1", [actorB]))
        .rejects.toMatchObject({ code: '42501' });
      await client.query('ROLLBACK');
    } finally { client.release(); }
  });
});
