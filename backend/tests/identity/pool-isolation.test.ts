import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client, Pool } from 'pg';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { migrateTestDatabase } from '../../src/modules/usuarios/infrastructure/db/migrate.js';
import { PgIdentityUnitOfWork } from '../../src/modules/usuarios/infrastructure/db/tenant-transaction.js';

const baseUrl = process.env.F01_TEST_DATABASE_URL;
const testGroup = baseUrl ? describe : describe.skip;

testGroup('pool F01: A/B concurrentes sin fuga de contexto', () => {
  let admin: Client;
  let database: Client;
  let pool: Pool;
  let testName: string;
  let roleName: string;
  const actors = [randomUUID(), randomUUID()];
  const pharmacies = [randomUUID(), randomUUID()];
  const secrets = [randomBytes(32).toString('hex'), randomBytes(32).toString('hex')];

  beforeAll(async () => {
    const base = new URL(baseUrl!);
    if (base.hostname !== '127.0.0.1' || base.port !== '55431' || base.pathname !== '/farmafind_f01_test') {
      throw new Error('Pruebas F01: solo instancia local aislada y base farmafind_f01_test');
    }
    admin = new Client({ connectionString: baseUrl });
    await admin.connect();
    const suffix = randomBytes(6).toString('hex');
    testName = `farmafind_f01_test_${suffix}`;
    roleName = `f01_test_pool_${suffix}`;
    await admin.query(`CREATE DATABASE "${testName}"`);
    const url = new URL(base);
    url.pathname = `/${testName}`;
    database = new Client({ connectionString: url.toString() });
    await database.connect();
    await migrateTestDatabase(url.toString(), async connectionString => {
      const client = new Client({ connectionString });
      await client.connect();
      return client;
    });

    for (let index = 0; index < 2; index++) {
      await database.query('INSERT INTO f01.usuario(id,email_canonico,password_hash) VALUES($1,$2,$3)',
        [actors[index], `pool-${index}@example.invalid`, '$argon2id$fixture-only']);
      await database.query('INSERT INTO f01.farmacia_referencia(id,nombre_publico) VALUES($1,$2)',
        [pharmacies[index], `Farmacia ficticia ${index}`]);
      await database.query('INSERT INTO f01.usuario_farmacia(usuario_id,farmacia_id,rol) VALUES($1,$2,$3)',
        [actors[index], pharmacies[index], 'TRABAJADOR']);
      const fingerprint = createHash('sha256').update(Buffer.from(secrets[index], 'hex')).digest();
      await database.query(`
        INSERT INTO f01.sesion(usuario_id,token_fingerprint,idle_expires_at,absolute_expires_at)
        VALUES($1,$2,now()+interval '30 minutes',now()+interval '8 hours')
      `, [actors[index], fingerprint]);
    }

    const password = randomBytes(32).toString('hex');
    await admin.query(`CREATE ROLE "${roleName}" LOGIN NOSUPERUSER NOBYPASSRLS PASSWORD '${password}'`);
    await admin.query(`GRANT f01_runtime TO "${roleName}"`);
    url.username = roleName;
    url.password = password;
    pool = new Pool({ connectionString: url.toString(), max: 2 });
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

  it('dos solicitudes simultáneas mantienen actor y farmacia propios y limpian conexiones', async () => {
    const uow = new PgIdentityUnitOfWork(pool);
    const results = await Promise.all([0, 1].map(index => uow.run(secrets[index], async (tx, actor) => {
      expect(actor).toBe(actors[index]);
      await tx.useAuthorizedPharmacy(actor, pharmacies[index]);
      await new Promise(resolve => setTimeout(resolve, 20));
      const visible = await tx.listOwnMemberships(actor);
      expect(visible.map(row => row.pharmacyId)).toEqual([pharmacies[index]]);
      return tx.context();
    })));
    for (let index = 0; index < 2; index++) {
      expect(results[index].actorUserId).toBe(actors[index]);
      expect(results[index].pharmacyId).toBe(pharmacies[index]);
    }
    const clients = await Promise.all([pool.connect(), pool.connect()]);
    try {
      for (const client of clients) {
        const context = await client.query(`
          SELECT current_setting('app.actor_user_id',true) AS actor,
                 current_setting('app.farmacia_id',true) AS pharmacy,
                 current_setting('app.session_fingerprint',true) AS fingerprint
        `);
        expect(context.rows[0].actor || null).toBeNull();
        expect(context.rows[0].pharmacy || null).toBeNull();
        expect(context.rows[0].fingerprint || null).toBeNull();
      }
    } finally { clients.forEach(client => client.release()); }
  });

  it('un fallo hace rollback y la siguiente operación conserva únicamente el contexto B', async () => {
    const uow = new PgIdentityUnitOfWork(pool);
    await expect(uow.run(secrets[0], async (tx, actor) => {
      await tx.useAuthorizedPharmacy(actor, pharmacies[0]);
      throw new Error('fallo ficticio');
    })).rejects.toThrow('fallo ficticio');
    const next = await uow.run(secrets[1], async (tx, actor) => {
      await tx.useAuthorizedPharmacy(actor, pharmacies[1]);
      return tx.context();
    });
    expect(next.actorUserId).toBe(actors[1]);
    expect(next.pharmacyId).toBe(pharmacies[1]);
  });
});
