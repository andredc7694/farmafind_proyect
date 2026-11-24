import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client, Pool } from 'pg';
import { randomBytes, randomUUID } from 'node:crypto';
import request from 'supertest';
import { migrateTestDatabase } from '../../src/modules/usuarios/infrastructure/db/migrate.js';
import { createLocalIdentityApp } from '../../src/identity-app.js';
import { Argon2PasswordHasher } from '../../src/modules/usuarios/infrastructure/argon2-password.js';

const baseUrl = process.env.F01_TEST_DATABASE_URL;
const group = baseUrl ? describe : describe.skip;
const origin = 'http://127.0.0.1:5173';
const ownerPassword = 'clave-ficticia-propietario-123';
const keyPattern = /^[0-9A-HJKMNP-TV-Z]{8}(-[0-9A-HJKMNP-TV-Z]{8}){3}$/;

group('F01.1 US1: alta de personal, primer ingreso y cambio de clave (HTTP + PostgreSQL)', () => {
  let admin: Client; let database: Client; let composed: Awaited<ReturnType<typeof createLocalIdentityApp>>;
  let server: ReturnType<typeof composed.app.listen>;
  let databaseName = ''; let authRole = ''; let tenantRole = '';
  let pharmacyA: string; let pharmacyB: string; let ownerA: string; let ownerB: string;

  beforeAll(async () => {
    const base = new URL(baseUrl!);
    if (!/^\/farmafind_f01_test_[a-f0-9]{12}$/.test(base.pathname)) throw new Error('F01.1: solo fixture TEST marcado');
    admin = new Client({ connectionString: baseUrl }); await admin.connect();
    const suffix = randomBytes(6).toString('hex');
    databaseName = `farmafind_f01_test_${suffix}`; authRole = `f011_auth_${suffix}`; tenantRole = `f011_ten_${suffix}`;
    await admin.query(`CREATE DATABASE "${databaseName}"`);
    base.pathname = `/${databaseName}`;
    database = new Client({ connectionString: base.toString() }); await database.connect();
    await migrateTestDatabase(base.toString(), async url => { const c = new Client({ connectionString: url }); await c.connect(); return c; });
    const authPassword = randomBytes(32).toString('hex'); const tenantPassword = randomBytes(32).toString('hex');
    await admin.query(`CREATE ROLE "${authRole}" LOGIN NOSUPERUSER NOBYPASSRLS PASSWORD '${authPassword}'`);
    await admin.query(`CREATE ROLE "${tenantRole}" LOGIN NOSUPERUSER NOBYPASSRLS PASSWORD '${tenantPassword}'`);
    await admin.query(`GRANT f01_auth TO "${authRole}"`); await admin.query(`GRANT f01_runtime TO "${tenantRole}"`);
    const auth = new URL(base); auth.username = authRole; auth.password = authPassword;
    const tenant = new URL(base); tenant.username = tenantRole; tenant.password = tenantPassword;

    const hash = await new Argon2PasswordHasher().hash(ownerPassword);
    pharmacyA = randomUUID(); pharmacyB = randomUUID(); ownerA = randomUUID(); ownerB = randomUUID();
    await database.query('INSERT INTO f01.farmacia_referencia(id,nombre_publico) VALUES($1,$2),($3,$4)', [pharmacyA, 'Farmacia ficticia Alfa', pharmacyB, 'Farmacia ficticia Beta']);
    for (const [id, email, pharmacy] of [[ownerA, 'dueno-alfa@example.test', pharmacyA], [ownerB, 'dueno-beta@example.test', pharmacyB]]) {
      await database.query('INSERT INTO f01.usuario(id,email_canonico,password_hash) VALUES($1,$2,$3)', [id, email, hash]);
      const membership = (await database.query(`INSERT INTO f01.usuario_farmacia(usuario_id,farmacia_id,rol) VALUES($1,$2,'DUENO') RETURNING id`, [id, pharmacy])).rows[0];
      await database.query(`INSERT INTO f01.delegacion(membresia_id,farmacia_id,capacidad,granted_by_usuario_id) VALUES($1,$2,'membership.manage',$3)`, [membership.id, pharmacy, id]);
    }
    composed = await createLocalIdentityApp({ authDatabaseUrl: auth.toString(), tenantDatabaseUrl: tenant.toString(),
      csrfKey: Buffer.alloc(32, 41), abuseKey: Buffer.alloc(32, 42), allowedOrigin: origin, cookieSecure: false },
    url => new Pool({ connectionString: url, max: 4 }));
    server = composed.app.listen(0, '127.0.0.1');
  });

  afterAll(async () => {
    if (server) await new Promise<void>(resolve => server.close(() => resolve()));
    if (composed) await composed.close();
    if (database) await database.end();
    if (admin) {
      if (databaseName) await admin.query(`DROP DATABASE "${databaseName}"`);
      if (authRole) await admin.query(`DROP ROLE "${authRole}"`);
      if (tenantRole) await admin.query(`DROP ROLE "${tenantRole}"`);
      await admin.end();
    }
  });

  const csrf = async (agent: ReturnType<typeof request.agent>) => (await agent.get('/api/v1/auth/csrf').expect(200)).body.csrfToken as string;
  async function login(identifier: string, password: string, expected = 200) {
    const agent = request.agent(server);
    const token = await csrf(agent);
    const response = await agent.post('/api/v1/auth/login').set('Origin', origin).set('X-CSRF-Token', token).send({ identifier, password }).expect(expected);
    return { agent, response };
  }
  /** POST con CSRF; `.expect(estado)` comprueba el código y devuelve la respuesta. */
  function post(agent: ReturnType<typeof request.agent>, path: string, body: unknown) {
    return {
      async expect(status: number) {
        const token = await csrf(agent);
        const response = await agent.post(`/api/v1${path}`).set('Origin', origin).set('X-CSRF-Token', token).send(body as object);
        expect(response.status, JSON.stringify(response.body)).toBe(status);
        return response;
      },
    };
  }

  let temporaryKey = ''; let workerId = ''; let alfaOwner: ReturnType<typeof request.agent>;

  it('el propietario de Alfa crea una cuenta operativa y recibe la clave temporal una sola vez', async () => {
    alfaOwner = (await login('dueno-alfa@example.test', ownerPassword)).agent;
    const response = await post(alfaOwner, `/pharmacies/${pharmacyA}/staff`, { alias: 'Alfa.Caja1', displayName: 'Caja uno ficticia', capabilities: ['inventory.read', 'reservation.read'] }).expect(201);
    expect(response.body.alias).toBe('alfa.caja1');
    expect(response.body.temporaryPassword).toMatch(keyPattern);
    const remaining = new Date(response.body.expiresAt).getTime() - Date.now();
    expect(remaining).toBeGreaterThan(23.9 * 3_600_000); expect(remaining).toBeLessThanOrEqual(24 * 3_600_000);
    temporaryKey = response.body.temporaryPassword; workerId = response.body.userId;
    const stored = await database.query('SELECT clave_hash,motivo,consumida_at FROM f01.credencial_temporal WHERE usuario_id=$1', [workerId]);
    expect(stored.rows[0].clave_hash).toMatch(/^\$argon2id\$/);
    expect(stored.rows[0].clave_hash).not.toContain(temporaryKey.replace(/-/g, ''));
    expect(stored.rows[0]).toMatchObject({ motivo: 'ALTA', consumida_at: null });
    const user = (await database.query('SELECT email_canonico,alias_canonico FROM f01.usuario WHERE id=$1', [workerId])).rows[0];
    expect(user).toEqual({ email_canonico: null, alias_canonico: 'alfa.caja1' });
    const audit = await database.query(`SELECT accion,farmacia_id FROM f01.auditoria_identidad WHERE objetivo_usuario_id=$1 ORDER BY accion`, [workerId]);
    expect(audit.rows.map(row => row.accion)).toEqual(['CAPABILITY_GRANT', 'STAFF_CREATE']);
    const caps = await database.query(`SELECT d.capacidad FROM f01.delegacion d JOIN f01.usuario_farmacia m ON m.id=d.membresia_id WHERE m.usuario_id=$1 ORDER BY 1`, [workerId]);
    expect(caps.rows.map(row => row.capacidad)).toEqual(['inventory.read', 'reservation.read']);
  });

  it('el listado muestra al trabajador sin hashes ni claves', async () => {
    const response = await alfaOwner.get(`/api/v1/pharmacies/${pharmacyA}/staff`).expect(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0]).toMatchObject({ userId: workerId, alias: 'alfa.caja1', displayName: 'Caja uno ficticia', state: 'ACTIVA', pendingTemporaryKey: true, capabilities: ['inventory.read', 'reservation.read'] });
    expect(JSON.stringify(response.body)).not.toMatch(/argon2|temporaryPassword|clave/i);
  });

  it('rechaza alias repetido (409 genérico), entradas inválidas y capacidades no delegables (400)', async () => {
    const dup = await post(alfaOwner, `/pharmacies/${pharmacyA}/staff`, { alias: 'alfa.caja1', displayName: 'Otra' }).expect(409);
    expect(JSON.stringify(dup.body)).not.toContain(workerId);
    await post(alfaOwner, `/pharmacies/${pharmacyA}/staff`, { alias: 'a', displayName: 'x' }).expect(400);
    await post(alfaOwner, `/pharmacies/${pharmacyA}/staff`, { alias: 'alfa.caja9', displayName: '' }).expect(400);
    await post(alfaOwner, `/pharmacies/${pharmacyA}/staff`, { alias: 'alfa.caja9', displayName: 'x', capabilities: ['membership.manage'] }).expect(400);
    await post(alfaOwner, `/pharmacies/${pharmacyA}/staff`, { alias: 'alfa.caja9', displayName: 'x', role: 'DUENO' }).expect(400);
    expect((await database.query(`SELECT count(*)::int AS n FROM f01.usuario WHERE alias_canonico='alfa.caja9'`)).rows[0].n).toBe(0);
  });

  it('un propietario de Beta no puede operar sobre Alfa y un anónimo recibe 401', async () => {
    const beta = (await login('dueno-beta@example.test', ownerPassword)).agent;
    await post(beta, `/pharmacies/${pharmacyA}/staff`, { alias: 'beta.intruso', displayName: 'x' }).expect(404);
    await beta.get(`/api/v1/pharmacies/${pharmacyA}/staff`).expect(404);
    await post(request.agent(server), `/pharmacies/${pharmacyA}/staff`, { alias: 'anonimo.x', displayName: 'x' }).expect(401);
    expect((await database.query(`SELECT count(*)::int AS n FROM f01.usuario WHERE alias_canonico IN ('beta.intruso','anonimo.x')`)).rows[0].n).toBe(0);
  });

  let worker: ReturnType<typeof request.agent>;

  it('primer ingreso con la clave temporal (escrita con minúsculas y espacios): sesión restringida a cambio de clave', async () => {
    const typed = temporaryKey.toLowerCase().replace(/-/g, ' ');
    const { agent, response } = await login('alfa.caja1', typed);
    worker = agent;
    expect(response.body).toMatchObject({ userId: workerId, email: null, alias: 'alfa.caja1', restriction: 'CAMBIO_CLAVE' });
    const consumed = await database.query('SELECT consumida_at FROM f01.credencial_temporal WHERE usuario_id=$1', [workerId]);
    expect(consumed.rows[0].consumida_at).not.toBeNull();
    const audit = await database.query(`SELECT accion FROM f01.auditoria_identidad WHERE actor_usuario_id=$1 AND accion='TEMP_KEY_CONSUME'`, [workerId]);
    expect(audit.rows).toHaveLength(1);
  });

  it('la sesión restringida no alcanza ninguna otra ruta (guardia HTTP y base de datos)', async () => {
    for (const path of [`/pharmacies/${pharmacyA}/staff`, '/me/memberships', `/pharmacies/${pharmacyA}/inventario`]) {
      const response = await worker.get(`/api/v1${path}`).expect(403);
      expect(response.body.code).toBe('SESSION_RESTRICTED');
    }
    await worker.get('/api/v1/auth/session').expect(200);
  });

  it('la clave temporal no sirve por segunda vez', async () => {
    await login('alfa.caja1', temporaryKey, 401);
  });

  it('rechaza una clave nueva débil o con campos extra y acepta la definitiva', async () => {
    await post(worker, '/auth/password/change-temporary', { newPassword: 'corta' }).expect(400);
    await post(worker, '/auth/password/change-temporary', { newPassword: 'clave-definitiva-123', otro: 1 }).expect(400);
    await post(worker, '/auth/password/change-temporary', { newPassword: 'clave-definitiva-123' }).expect(204);
    const view = await worker.get('/api/v1/auth/session').expect(200);
    expect(view.body.restriction).toBeUndefined();
    expect(view.body.alias).toBe('alfa.caja1');
    const audit = await database.query(`SELECT accion FROM f01.auditoria_identidad WHERE actor_usuario_id=$1 AND accion='PASSWORD_CHANGE'`, [workerId]);
    expect(audit.rows).toHaveLength(1);
  });

  it('tras cambiar la clave el trabajador solo ve Alfa y no puede gestionar personal', async () => {
    const memberships = await worker.get('/api/v1/me/memberships').expect(200);
    expect(memberships.body.map((row: { pharmacyId: string }) => row.pharmacyId)).toEqual([pharmacyA]);
    await worker.get(`/api/v1/pharmacies/${pharmacyA}/staff`).expect(403);
    await post(worker, `/pharmacies/${pharmacyA}/staff`, { alias: 'alfa.subalterno', displayName: 'x' }).expect(403);
    await worker.get(`/api/v1/pharmacies/${pharmacyB}/staff`).expect(404);
    await post(worker, '/auth/password/change-temporary', { newPassword: 'otra-clave-definitiva-1' }).expect(403);
  });

  it('con la clave definitiva puede volver a entrar y la anterior ya no vale', async () => {
    await login('ALFA.CAJA1', 'clave-definitiva-123');
    await login('alfa.caja1', temporaryKey, 401);
  });

  it('una clave temporal vencida (24 h) se rechaza', async () => {
    const created = await post(alfaOwner, `/pharmacies/${pharmacyA}/staff`, { alias: 'alfa.vencida', displayName: 'Cuenta vencida' }).expect(201);
    await database.query(`UPDATE f01.credencial_temporal SET emitida_at=now()-interval '25 hours',expira_at=now()-interval '1 hour' WHERE usuario_id=$1`, [created.body.userId]);
    await login('alfa.vencida', created.body.temporaryPassword, 401);
  });

  it('cinco intentos fallidos bloquean la cuenta 15 minutos, incluso con la clave correcta', async () => {
    const created = await post(alfaOwner, `/pharmacies/${pharmacyA}/staff`, { alias: 'alfa.bloqueo', displayName: 'Cuenta de bloqueo' }).expect(201);
    let blocked = 0;
    for (let attempt = 0; attempt < 6; attempt++) {
      const agent = request.agent(server);
      const token = await csrf(agent);
      const response = await agent.post('/api/v1/auth/login').set('Origin', origin).set('X-CSRF-Token', token).send({ identifier: 'alfa.bloqueo', password: `incorrecta-${attempt}` });
      if (response.status === 429) { blocked++; expect(Number(response.headers['retry-after'])).toBeGreaterThan(0); } else expect(response.status).toBe(401);
    }
    expect(blocked).toBeGreaterThanOrEqual(1);
    const agent = request.agent(server);
    const token = await csrf(agent);
    await agent.post('/api/v1/auth/login').set('Origin', origin).set('X-CSRF-Token', token).send({ identifier: 'alfa.bloqueo', password: created.body.temporaryPassword }).expect(429);
    const stillUnused = await database.query('SELECT consumida_at FROM f01.credencial_temporal WHERE usuario_id=$1', [created.body.userId]);
    expect(stillUnused.rows[0].consumida_at).toBeNull();
  });
});
