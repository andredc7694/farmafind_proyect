import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client, Pool } from 'pg';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import { migrateTestDatabase } from '../../src/modules/usuarios/infrastructure/db/migrate.js';
import { createLocalIdentityApp } from '../../src/identity-app.js';
import { Argon2PasswordHasher } from '../../src/modules/usuarios/infrastructure/argon2-password.js';

const baseUrl = process.env.F01_TEST_DATABASE_URL;
const group = baseUrl ? describe : describe.skip;
const origin = 'http://127.0.0.1:5173';

group('proceso F01 compuesto contra PostgreSQL ficticio', () => {
  let admin: Client;
  let database: Client;
  let app: Awaited<ReturnType<typeof createLocalIdentityApp>>;
  let server: ReturnType<typeof app.app.listen>;
  let databaseName = '';
  let authRole = '';
  let tenantRole = '';

  beforeAll(async () => {
    const base = new URL(baseUrl!);
    if (base.hostname !== '127.0.0.1' || base.port !== '55431' || base.pathname !== '/farmafind_f01_test') {
      throw new Error('F01: prueba limitada al cluster ficticio aislado');
    }
    admin = new Client({ connectionString: baseUrl });
    await admin.connect();
    const suffix = randomBytes(6).toString('hex');
    databaseName = `farmafind_f01_test_${suffix}`;
    authRole = `f01_auth_local_${suffix}`;
    tenantRole = `f01_tenant_local_${suffix}`;
    await admin.query(`CREATE DATABASE "${databaseName}"`);
    base.pathname = `/${databaseName}`;
    database = new Client({ connectionString: base.toString() });
    await database.connect();
    await migrateTestDatabase(base.toString(), async url => {
      const client = new Client({ connectionString: url });
      await client.connect();
      return client;
    });
    const authPassword = randomBytes(32).toString('hex');
    const tenantPassword = randomBytes(32).toString('hex');
    await admin.query(`CREATE ROLE "${authRole}" LOGIN NOSUPERUSER NOBYPASSRLS PASSWORD '${authPassword}'`);
    await admin.query(`CREATE ROLE "${tenantRole}" LOGIN NOSUPERUSER NOBYPASSRLS PASSWORD '${tenantPassword}'`);
    await admin.query(`GRANT f01_auth TO "${authRole}"`);
    await admin.query(`GRANT f01_runtime TO "${tenantRole}"`);
    const auth = new URL(base);
    auth.username = authRole;
    auth.password = authPassword;
    const tenant = new URL(base);
    tenant.username = tenantRole;
    tenant.password = tenantPassword;
    app = await createLocalIdentityApp({ authDatabaseUrl: auth.toString(), tenantDatabaseUrl: tenant.toString(),
      csrfKey: Buffer.alloc(32, 31), abuseKey: Buffer.alloc(32, 32), allowedOrigin: origin, cookieSecure: false },
    url => new Pool({ connectionString: url, max: 4 }));
    server = app.app.listen(0, '127.0.0.1');
  });

  afterAll(async () => {
    if (server) await new Promise<void>(resolve => server.close(() => resolve()));
    if (app) await app.close();
    if (database) await database.end();
    if (admin) {
      if (databaseName) await admin.query(`DROP DATABASE "${databaseName}"`);
      if (authRole) await admin.query(`DROP ROLE "${authRole}"`);
      if (tenantRole) await admin.query(`DROP ROLE "${tenantRole}"`);
      await admin.end();
    }
  });

  async function csrf(agent: ReturnType<typeof request.agent>) {
    const response = await agent.get('/api/v1/auth/csrf').expect(200);
    return response.body.csrfToken as string;
  }

  async function newSession(email: string) {
    const agent = request.agent(server);
    const registerToken = await csrf(agent);
    await agent.post('/api/v1/auth/register').set('Origin', origin)
      .set('X-CSRF-Token', registerToken)
      .send({ email, password: 'clave-ficticia-segura-123' }).expect(202);
    const loginToken = await csrf(agent);
    await agent.post('/api/v1/auth/login').set('Origin', origin)
      .set('X-CSRF-Token', loginToken)
      .send({ email, password: 'clave-ficticia-segura-123' }).expect(200);
    return agent;
  }

  async function fixtureSession(email: string) {
    // Fixture creation is done by the isolated test migrator, never by a public
    // privileged registration route. This preserves the approved register/IP limit.
    const hash = await new Argon2PasswordHasher().hash('clave-ficticia-segura-123');
    await database.query(`INSERT INTO f01.usuario(email_canonico,password_hash) VALUES($1,$2)`, [email, hash]);
    const agent = request.agent(server);
    const token = await csrf(agent);
    await agent.post('/api/v1/auth/login').set('Origin', origin).set('X-CSRF-Token', token)
      .send({ email, password: 'clave-ficticia-segura-123' }).expect(200);
    return agent;
  }

  it('arranca con /health, permite identidad propia y separa farmacias A/B', async () => {
    await request(server).get('/health').expect(200);
    const multi = await newSession('multi-composition@example.test');
    const onlyA = await newSession('onlya-composition@example.test');
    const profile = await multi.get('/api/v1/auth/session').expect(200);
    expect(profile.body.email).toBe('multi-composition@example.test');
    const userRows = await database.query<{ id: string; email_canonico: string }>(
      "SELECT id,email_canonico FROM f01.usuario WHERE email_canonico LIKE '%-composition@example.test'");
    const users = Object.fromEntries(userRows.rows.map(row => [row.email_canonico, row.id]));
    const pharmacyA = (await database.query<{ id: string }>(
      "INSERT INTO f01.farmacia_referencia(nombre_publico) VALUES ('Farmacia ficticia A') RETURNING id")).rows[0].id;
    const pharmacyB = (await database.query<{ id: string }>(
      "INSERT INTO f01.farmacia_referencia(nombre_publico) VALUES ('Farmacia ficticia B') RETURNING id")).rows[0].id;
    for (const [email, pharmacyId] of [
      ['multi-composition@example.test', pharmacyA], ['multi-composition@example.test', pharmacyB],
      ['onlya-composition@example.test', pharmacyA],
    ]) {
      await database.query("INSERT INTO f01.usuario_farmacia(usuario_id,farmacia_id,rol) VALUES($1,$2,'TRABAJADOR')",
        [users[email], pharmacyId]);
    }
    const multiList = await multi.get('/api/v1/me/memberships').expect(200);
    const onlyAList = await onlyA.get('/api/v1/me/memberships').expect(200);
    expect(multiList.body.map((row: { pharmacyId: string }) => row.pharmacyId).sort()).toEqual([pharmacyA, pharmacyB].sort());
    expect(onlyAList.body.map((row: { pharmacyId: string }) => row.pharmacyId)).toEqual([pharmacyA]);
    const multiToken = await csrf(multi);
    const chosen = await multi.put('/api/v1/me/active-pharmacy').set('Origin', origin)
      .set('X-CSRF-Token', multiToken).send({ pharmacyId: pharmacyB }).expect(200);
    expect(chosen.body.pharmacyId).toBe(pharmacyB);
    const onlyAToken = await csrf(onlyA);
    await onlyA.put('/api/v1/me/active-pharmacy').set('Origin', origin)
      .set('X-CSRF-Token', onlyAToken).send({ pharmacyId: pharmacyB }).expect(404);
    const logoutToken = await csrf(multi);
    await multi.post('/api/v1/auth/logout').set('Origin', origin)
      .set('X-CSRF-Token', logoutToken).expect(204);
    await multi.get('/api/v1/auth/session').expect(401);
  });

  it('administra solo TRABAJADOR de A por HTTP con RLS, auditoria y denegaciones', async () => {
    const owner = await fixtureSession('owner-local@example.test');
    const worker = await fixtureSession('worker-local@example.test');
    const noPermission = await fixtureSession('owner-no-permission@example.test');
    const outsider = await fixtureSession('outsider-local@example.test');
    const identities = await database.query<{ id: string; email_canonico: string }>(`
      SELECT id,email_canonico FROM f01.usuario WHERE email_canonico IN
      ('owner-local@example.test','worker-local@example.test',
       'owner-no-permission@example.test','outsider-local@example.test')`);
    const ids = Object.fromEntries(identities.rows.map(row => [row.email_canonico, row.id]));
    const a = (await database.query<{ id: string }>(
      "INSERT INTO f01.farmacia_referencia(nombre_publico) VALUES('Farmacia local A') RETURNING id")).rows[0].id;
    const b = (await database.query<{ id: string }>(
      "INSERT INTO f01.farmacia_referencia(nombre_publico) VALUES('Farmacia local B') RETURNING id")).rows[0].id;
    const own = (await database.query<{ id: string }>(`INSERT INTO f01.usuario_farmacia
      (usuario_id,farmacia_id,rol) VALUES($1,$2,'DUENO') RETURNING id`,
    [ids['owner-local@example.test'], a])).rows[0].id;
    await database.query(`INSERT INTO f01.delegacion
      (membresia_id,farmacia_id,capacidad,granted_by_usuario_id)
      VALUES($1,$2,'membership.manage',$3)`, [own, a, ids['owner-local@example.test']]);
    await database.query(`INSERT INTO f01.usuario_farmacia(usuario_id,farmacia_id,rol)
      VALUES($1,$2,'DUENO'),($3,$4,'TRABAJADOR')`,
    [ids['owner-no-permission@example.test'], a, ids['outsider-local@example.test'], b]);

    const local = `/api/v1/pharmacies/${a}/memberships`;
    const foreign = `/api/v1/pharmacies/${b}/memberships`;
    const token = await csrf(owner);
    await owner.post(local).set('Origin', origin).set('X-CSRF-Token', token)
      .send({ userId: ids['owner-local@example.test'], role: 'TRABAJADOR' }).expect(403);
    await owner.post(local).set('Origin', origin).set('X-CSRF-Token', token)
      .send({ userId: ids['worker-local@example.test'], role: 'DUENO' }).expect(400);
    await owner.post(foreign).set('Origin', origin).set('X-CSRF-Token', token)
      .send({ userId: ids['worker-local@example.test'], role: 'TRABAJADOR' }).expect(404);
    await owner.post(local).set('Origin', origin)
      .send({ userId: ids['worker-local@example.test'], role: 'TRABAJADOR' }).expect(403);
    const denied = await noPermission.post(local).set('Origin', origin)
      .set('X-CSRF-Token', await csrf(noPermission))
      .send({ userId: ids['worker-local@example.test'], role: 'TRABAJADOR' }).expect(403);
    expect(JSON.stringify(denied.body)).not.toContain(ids['worker-local@example.test']);

    const granted = await owner.post(local).set('Origin', origin).set('X-CSRF-Token', token)
      .send({ userId: ids['worker-local@example.test'], role: 'TRABAJADOR' }).expect(201);
    expect(granted.body).toMatchObject({ userId: ids['worker-local@example.test'], pharmacyId: a,
      role: 'TRABAJADOR', status: 'ACTIVA' });
    await owner.post(local).set('Origin', origin).set('X-CSRF-Token', token)
      .send({ userId: ids['worker-local@example.test'], role: 'TRABAJADOR' }).expect(409);
    const listed = await owner.get(local).expect(200);
    expect(listed.body).toHaveLength(1);
    expect(listed.body[0].id).toBe(granted.body.id);
    await owner.get(foreign).expect(404);
    const workerToken = await csrf(worker);
    await worker.post(local).set('Origin', origin).set('X-CSRF-Token', workerToken)
      .send({ userId: ids['outsider-local@example.test'], role: 'TRABAJADOR' }).expect(403);
    await owner.patch(`${foreign}/${granted.body.id}`).set('Origin', origin)
      .set('X-CSRF-Token', token).send({ status: 'REVOCADA' }).expect(404);

    const revoked = await owner.patch(`${local}/${granted.body.id}`).set('Origin', origin)
      .set('X-CSRF-Token', token).send({ status: 'REVOCADA' }).expect(200);
    expect(revoked.body.status).toBe('REVOCADA');
    await owner.patch(`${local}/${granted.body.id}`).set('Origin', origin)
      .set('X-CSRF-Token', token).send({ status: 'REVOCADA' }).expect(409);
    const workerOwn = await worker.get('/api/v1/me/memberships').expect(200);
    expect(workerOwn.body).toEqual([]);
    const events = await database.query<{ accion: string }>(`SELECT accion FROM f01.auditoria_acceso
      WHERE actor_usuario_id=$1 AND farmacia_id=$2 ORDER BY occurred_at`, [ids['owner-local@example.test'], a]);
    expect(events.rows.map(row => row.accion)).toEqual(['MEMBERSHIP_GRANT', 'MEMBERSHIP_REVOKE']);
    const foreignMember = await database.query(`SELECT rol,estado FROM f01.usuario_farmacia
      WHERE usuario_id=$1 AND farmacia_id=$2`, [ids['outsider-local@example.test'], b]);
    expect(foreignMember.rows).toEqual([{ rol: 'TRABAJADOR', estado: 'ACTIVA' }]);
  });
});
