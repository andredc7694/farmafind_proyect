import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client, Pool } from 'pg';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import request from 'supertest';
import { migrateTestDatabase } from '../../src/modules/usuarios/infrastructure/db/migrate.js';
import { PgIdentityUnitOfWork } from '../../src/modules/usuarios/infrastructure/db/tenant-transaction.js';
import { ActivePharmacyService } from '../../src/modules/usuarios/application/active-pharmacy.js';
import { createApp } from '../../src/app.js';
import { createIdentityRouter } from '../../src/modules/usuarios/presentation/auth-router.js';
import { createMembershipRouter } from '../../src/modules/usuarios/presentation/membership-router.js';

const baseUrl = process.env.F01_TEST_DATABASE_URL;
const testGroup = baseUrl ? describe : describe.skip;
const origin = 'http://127.0.0.1:5173';
const options = { allowedOrigin: origin, csrfKey: Buffer.alloc(32, 6), cookieSecure: false };

testGroup('API US2 con PostgreSQL real y pool compartido', () => {
  let admin: Client;
  let database: Client;
  let pool: Pool;
  let databaseName: string;
  let roleName: string;
  const user = { multi: randomUUID(), onlyA: randomUUID() };
  const pharmacy = { A: randomUUID(), B: randomUUID() };
  const secret = { multi: randomBytes(32).toString('hex'), onlyA: randomBytes(32).toString('hex') };

  beforeAll(async () => {
    const url = new URL(baseUrl!);
    if (url.hostname !== '127.0.0.1' || url.port !== '55431' || url.pathname !== '/farmafind_f01_test') {
      throw new Error('F01: prueba limitada al cluster aislado de loopback');
    }
    admin = new Client({ connectionString: baseUrl });
    await admin.connect();
    const suffix = randomBytes(6).toString('hex');
    databaseName = `farmafind_f01_test_${suffix}`;
    roleName = `f01_api_members_${suffix}`;
    await admin.query(`CREATE DATABASE "${databaseName}"`);
    url.pathname = `/${databaseName}`;
    database = new Client({ connectionString: url.toString() });
    await database.connect();
    await migrateTestDatabase(url.toString(), async connectionString => {
      const client = new Client({ connectionString });
      await client.connect();
      return client;
    });

    for (const [name, id] of Object.entries(user)) {
      await database.query('INSERT INTO f01.usuario(id,email_canonico,password_hash) VALUES($1,$2,$3)',
        [id, `${name.toLowerCase()}@example.test`, '$argon2id$fixture-only']);
    }
    for (const [name, id] of Object.entries(pharmacy)) {
      await database.query('INSERT INTO f01.farmacia_referencia(id,nombre_publico) VALUES($1,$2)',
        [id, `Farmacia ficticia ${name}`]);
    }
    const membershipIds = new Map<string, string>();
    for (const [key, userId, pharmacyId] of [
      ['multiA', user.multi, pharmacy.A], ['multiB', user.multi, pharmacy.B], ['onlyA', user.onlyA, pharmacy.A],
    ]) {
      const result = await database.query(`INSERT INTO f01.usuario_farmacia(usuario_id,farmacia_id,rol)
        VALUES($1,$2,'TRABAJADOR') RETURNING id`, [userId, pharmacyId]);
      membershipIds.set(key, result.rows[0].id);
    }
    for (const [key, pharmacyId, capability] of [
      ['multiA', pharmacy.A, 'LECTURA_A'], ['multiB', pharmacy.B, 'LECTURA_B'],
    ]) {
      await database.query(`INSERT INTO f01.delegacion(membresia_id,farmacia_id,capacidad,granted_by_usuario_id)
        VALUES($1,$2,$3,$4)`, [membershipIds.get(key), pharmacyId, capability, user.multi]);
    }
    for (const [name, value] of Object.entries(secret)) {
      const fingerprint = createHash('sha256').update(Buffer.from(value, 'hex')).digest();
      await database.query(`INSERT INTO f01.sesion(usuario_id,token_fingerprint,idle_expires_at,absolute_expires_at)
        VALUES($1,$2,now()+interval '30 minutes',now()+interval '8 hours')`,
      [user[name as keyof typeof user], fingerprint]);
    }
    const password = randomBytes(32).toString('hex');
    await admin.query(`CREATE ROLE "${roleName}" LOGIN NOSUPERUSER NOBYPASSRLS PASSWORD '${password}'`);
    await admin.query(`GRANT f01_runtime TO "${roleName}"`);
    url.username = roleName;
    url.password = password;
    pool = new Pool({ connectionString: url.toString(), max: 1 });
  });

  afterAll(async () => {
    if (pool) await pool.end();
    if (database) await database.end();
    if (admin) {
      if (databaseName) await admin.query(`DROP DATABASE "${databaseName}"`);
      if (roleName) await admin.query(`DROP ROLE "${roleName}"`);
      await admin.end();
    }
  });

  function app() {
    const identity = {
      register: async () => {},
      login: async (email: unknown) => ({ secret: email === 'multi@example.test' ? secret.multi : secret.onlyA,
        view: { userId: user.multi, email: 'fixture@example.test', activePharmacyId: null } }),
      session: async () => ({ userId: user.multi, email: 'fixture@example.test', activePharmacyId: null }),
      auditDenied: async () => {},
      logout: async () => {},
    };
    const memberships = new ActivePharmacyService(new PgIdentityUnitOfWork(pool));
    return createApp(createIdentityRouter(identity, options), createMembershipRouter(identity, memberships, options));
  }

  async function authenticatedAgent(email: string) {
    const agent = request.agent(app());
    const before = await agent.get('/api/v1/auth/csrf').expect(200);
    await agent.post('/api/v1/auth/login').set('Origin', origin)
      .set('X-CSRF-Token', before.body.csrfToken).send({ email, password: 'ficticia' }).expect(200);
    const after = await agent.get('/api/v1/auth/csrf').expect(200);
    return { agent, csrf: after.body.csrfToken };
  }

  it('separa A/B bajo solicitudes HTTP concurrentes y un pool de una conexión reutilizada', async () => {
    const multi = await authenticatedAgent('multi@example.test');
    const onlyA = await authenticatedAgent('onlya@example.test');
    const [multiList, onlyAList] = await Promise.all([
      multi.agent.get('/api/v1/me/memberships').expect(200),
      onlyA.agent.get('/api/v1/me/memberships').expect(200),
    ]);
    expect(multiList.body.map((item: { pharmacyId: string }) => item.pharmacyId).sort()).toEqual([pharmacy.A, pharmacy.B].sort());
    expect(onlyAList.body.map((item: { pharmacyId: string }) => item.pharmacyId)).toEqual([pharmacy.A]);
    const [selectedA, selectedB] = await Promise.all([
      multi.agent.put('/api/v1/me/active-pharmacy').set('Origin', origin).set('X-CSRF-Token', multi.csrf)
        .send({ pharmacyId: pharmacy.A }).expect(200),
      onlyA.agent.put('/api/v1/me/active-pharmacy').set('Origin', origin).set('X-CSRF-Token', onlyA.csrf)
        .send({ pharmacyId: pharmacy.B }).expect(404),
    ]);
    expect(selectedA.body.delegationCodes).toEqual(['LECTURA_A']);
    expect(JSON.stringify(selectedB.body)).not.toContain('LECTURA_B');
    const unknown = await onlyA.agent.put('/api/v1/me/active-pharmacy').set('Origin', origin)
      .set('X-CSRF-Token', onlyA.csrf).send({ pharmacyId: randomUUID() }).expect(404);
    expect({ code: unknown.body.code, message: unknown.body.message })
      .toEqual({ code: selectedB.body.code, message: selectedB.body.message });
    expect(JSON.stringify(selectedB.body)).not.toContain(pharmacy.B);
  });

  it('revocacion e inactividad surten efecto en la siguiente operacion HTTP', async () => {
    const multi = await authenticatedAgent('multi@example.test');
    await multi.agent.put('/api/v1/me/active-pharmacy').set('Origin', origin).set('X-CSRF-Token', multi.csrf)
      .send({ pharmacyId: pharmacy.B }).expect(200);
    await database.query(`UPDATE f01.usuario_farmacia SET estado='REVOCADA'
      WHERE usuario_id=$1 AND farmacia_id=$2`, [user.multi, pharmacy.B]);
    await multi.agent.put('/api/v1/me/active-pharmacy').set('Origin', origin).set('X-CSRF-Token', multi.csrf)
      .send({ pharmacyId: pharmacy.B }).expect(404);
    const list = await multi.agent.get('/api/v1/me/memberships').expect(200);
    expect(list.body.map((item: { pharmacyId: string }) => item.pharmacyId)).toEqual([pharmacy.A]);
    await database.query("UPDATE f01.farmacia_referencia SET estado='INACTIVA' WHERE id=$1", [pharmacy.A]);
    await multi.agent.put('/api/v1/me/active-pharmacy').set('Origin', origin).set('X-CSRF-Token', multi.csrf)
      .send({ pharmacyId: pharmacy.A }).expect(404);
  });
});
