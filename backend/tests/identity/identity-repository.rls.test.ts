import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client, Pool } from 'pg';
import { randomBytes, randomUUID } from 'node:crypto';
import { migrateTestDatabase } from '../../src/modules/usuarios/infrastructure/db/migrate.js';
import { PgSessionRepository, PgUserRepository } from '../../src/modules/usuarios/infrastructure/identity-repository.js';
import { createOpaqueSession } from '../../src/modules/usuarios/domain/session-policy.js';
import { PgAuthUnitOfWork } from '../../src/modules/usuarios/infrastructure/db/auth-transaction.js';
import { IdentityUseCases } from '../../src/modules/usuarios/application/identity-use-cases.js';
import { Argon2PasswordHasher } from '../../src/modules/usuarios/infrastructure/argon2-password.js';
import { PgAbuseRepository } from '../../src/modules/usuarios/infrastructure/abuse-repository.js';
import { RateLimitedError } from '../../src/modules/usuarios/application/ports.js';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { createIdentityRouter } from '../../src/modules/usuarios/presentation/auth-router.js';

const baseUrl = process.env.F01_TEST_DATABASE_URL;
const testGroup = baseUrl ? describe : describe.skip;

testGroup('rol de autenticación global acotado en PostgreSQL real', () => {
  let admin: Client;
  let database: Client;
  let auth: Client;
  let pool: Pool;
  let databaseName: string;
  let loginRole: string;

  beforeAll(async () => {
    const base = new URL(baseUrl!);
    if (base.hostname !== '127.0.0.1' || base.port !== '55431' || base.pathname !== '/farmafind_f01_test') {
      throw new Error('Pruebas F01: solo cluster aislado en 127.0.0.1:55431');
    }
    admin = new Client({ connectionString: baseUrl });
    await admin.connect();
    const suffix = randomBytes(6).toString('hex');
    databaseName = `farmafind_f01_test_${suffix}`;
    loginRole = `f01_auth_test_${suffix}`;
    await admin.query(`CREATE DATABASE "${databaseName}"`);
    base.pathname = `/${databaseName}`;
    database = new Client({ connectionString: base.toString() });
    await database.connect();
    await migrateTestDatabase(base.toString(), async url => {
      const client = new Client({ connectionString: url });
      await client.connect();
      return client;
    });
    const password = randomBytes(32).toString('hex');
    await admin.query(`CREATE ROLE "${loginRole}" LOGIN NOSUPERUSER NOBYPASSRLS PASSWORD '${password}'`);
    await admin.query(`GRANT f01_auth TO "${loginRole}"`);
    base.username = loginRole;
    base.password = password;
    auth = new Client({ connectionString: base.toString() });
    await auth.connect();
    pool = new Pool({ connectionString: base.toString(), max: 2 });
  });

  afterAll(async () => {
    if (pool) await pool.end();
    if (auth) await auth.end();
    if (database) await database.end();
    if (admin) {
      if (databaseName) await admin.query(`DROP DATABASE "${databaseName}"`);
      if (loginRole) await admin.query(`DROP ROLE "${loginRole}"`);
      await admin.end();
    }
  });

  it('usa rol NOLOGIN sin BYPASSRLS y sin acceso a membresías privadas', async () => {
    const role = await database.query("SELECT rolsuper,rolbypassrls,rolcanlogin FROM pg_roles WHERE rolname='f01_auth'");
    expect(role.rows).toEqual([{ rolsuper: false, rolbypassrls: false, rolcanlogin: false }]);
    await auth.query('BEGIN');
    try {
      await auth.query('SET LOCAL ROLE f01_auth');
      await expect(auth.query('SELECT * FROM f01.usuario_farmacia')).rejects.toMatchObject({ code: '42501' });
    } finally {
      await auth.query('ROLLBACK');
    }
  });

  it('rol auth solo inserta auditoria global permitida y no puede leer eventos', async () => {
    await auth.query('BEGIN');
    try {
      await auth.query('SET LOCAL ROLE f01_auth');
      await expect(auth.query('SELECT id FROM f01.auditoria_acceso')).rejects.toMatchObject({ code: '42501' });
    } finally {
      await auth.query('ROLLBACK');
    }
    await auth.query('BEGIN');
    try {
      await auth.query('SET LOCAL ROLE f01_auth');
      await expect(auth.query(`INSERT INTO f01.auditoria_acceso
        (farmacia_id,accion,recurso_tipo,resultado,correlation_id)
        VALUES($1,'LOGIN','IDENTITY','DENEGADO',$2)`,
      ['00000000-0000-4000-8000-00000000000b', '00000000-0000-4000-8000-000000000001']))
        .rejects.toMatchObject({ code: '42501' });
    } finally {
      await auth.query('ROLLBACK');
    }
  });

  it('registra cliente y sesión sin token bruto; lectura/revocación exigen huella de contexto', async () => {
    const userRepository = new PgUserRepository(auth);
    const sessionRepository = new PgSessionRepository(auth);
    await auth.query('BEGIN');
    try {
      await auth.query('SET LOCAL ROLE f01_auth');
      const user = await userRepository.createCustomer({ canonicalEmail: 'cliente@example.test', passwordHash: '$argon2id$fixture-only' });
      expect(user.state).toBe('ACTIVO');
      expect(await userRepository.findByCanonicalEmail('cliente@example.test')).toMatchObject({ id: user.id });
      const issued = createOpaqueSession(user.id, new Date());
      await sessionRepository.save(issued.session);
      const withoutContext = await auth.query('SELECT id FROM f01.sesion');
      expect(withoutContext.rows).toEqual([]);
      const found = await sessionRepository.findByFingerprint(issued.session.tokenFingerprint);
      expect(found).toMatchObject({ id: issued.session.id, userId: user.id, state: 'VIGENTE' });
      await sessionRepository.revoke(issued.session.tokenFingerprint, new Date());
      expect(await sessionRepository.findByFingerprint(issued.session.tokenFingerprint)).toMatchObject({ state: 'REVOCADA' });
      await auth.query('COMMIT');
    } catch (error) {
      await auth.query('ROLLBACK');
      throw error;
    }
  });

  it('ejecuta registro, login, revalidación y logout con rol auth limitado y sesiones reales', async () => {
    const hasher = new Argon2PasswordHasher();
    const dummyHash = await hasher.hash('solo-dato-ficticio-para-tiempo-uniforme');
    const service = new IdentityUseCases(new PgAuthUnitOfWork(pool, Buffer.alloc(32, 7)), hasher, { now: () => new Date() }, dummyHash);
    await service.register(' Persona@Example.Test ', 'contraseña-ficticia-distinta', '192.0.2.10');
    await service.register('persona@example.test', 'contraseña-ficticia-duplicada', '192.0.2.10');
    const count = await database.query("SELECT count(*)::int AS count FROM f01.usuario WHERE email_canonico='persona@example.test'");
    expect(count.rows[0].count).toBe(1);
    await expect(service.login('persona@example.test', 'incorrecta', '192.0.2.11')).rejects.toThrow('Credenciales inválidas');
    await expect(service.login('ausente@example.test', 'incorrecta', '192.0.2.11')).rejects.toThrow('Credenciales inválidas');
    const login = await service.login('persona@example.test', 'contraseña-ficticia-distinta', '192.0.2.11');
    expect(login.secret).toMatch(/^[a-f0-9]{64}$/);
    expect((await service.session(login.secret)).email).toBe('persona@example.test');
    await service.logout(login.secret);
    await expect(service.session(login.secret)).rejects.toThrow('No autorizado');

    const second = await service.login('persona@example.test', 'contraseña-ficticia-distinta', '192.0.2.11');
    await database.query("UPDATE f01.usuario SET estado='INACTIVO' WHERE email_canonico='persona@example.test'");
    await expect(service.session(second.secret)).rejects.toThrow('No autorizado');
    await database.query("UPDATE f01.usuario SET estado='ACTIVO' WHERE email_canonico='persona@example.test'");
    await database.query("UPDATE f01.sesion SET idle_expires_at=now()-interval '1 minute' WHERE usuario_id=$1 AND estado='VIGENTE'", [second.view.userId]);
    await expect(service.session(second.secret)).rejects.toThrow('No autorizado');
  });

  it('conserva contadores ABUSE-01 compartidos, sin correo ni IP en claro', async () => {
    const now = new Date('2026-11-11T12:15:00.000Z');
    const abuse = new PgAbuseRepository(auth, Buffer.alloc(32, 7));
    await auth.query('BEGIN');
    try {
      await auth.query('SET LOCAL ROLE f01_auth');
      for (let index = 0; index < 5; index++) {
        expect((await abuse.assessLogin('ausente@example.test', '192.0.2.1', now)).allowed).toBe(true);
        await abuse.recordLoginFailure('ausente@example.test', '192.0.2.1', now);
      }
      expect(await abuse.assessLogin('ausente@example.test', '192.0.2.2', now)).toMatchObject({ allowed: false, status: 429 });
      expect(await abuse.assessLogin('otra@example.test', '192.0.2.1', now)).toMatchObject({ allowed: false, status: 429 });
      for (let index = 0; index < 5; index++) {
        expect((await abuse.assessRegistration('192.0.2.3', now)).allowed).toBe(true);
        await abuse.recordRegistrationAttempt('192.0.2.3', now);
      }
      expect(await abuse.assessRegistration('192.0.2.3', now)).toMatchObject({ allowed: false, status: 429 });
      expect((await abuse.assessRegistration('192.0.2.3', new Date(now.getTime() + 15 * 60_000))).allowed).toBe(true);
      const digests = await auth.query("SELECT encode(key_digest,'hex') AS digest FROM f01.abuse_attempt");
      expect(JSON.stringify(digests.rows)).not.toContain('ausente@example.test');
      expect(JSON.stringify(digests.rows)).not.toContain('192.0.2.1');
      await auth.query('COMMIT');
    } catch (error) {
      await auth.query('ROLLBACK');
      throw error;
    }
  });

  it('aplica ABUSE-01 en los casos de uso después de cinco fallos reales, sin sesión nueva', async () => {
    const hasher = new Argon2PasswordHasher();
    const dummyHash = await hasher.hash('dummy-ficticio');
    const service = new IdentityUseCases(new PgAuthUnitOfWork(pool, Buffer.alloc(32, 7)), hasher, { now: () => new Date() }, dummyHash);
    for (let index = 0; index < 5; index++) {
      await expect(service.login('nadie@example.test', 'incorrecta', '192.0.2.20')).rejects.toThrow('Credenciales inválidas');
      await expect(service.register('invalido', 'dato-ficticio', '192.0.2.21')).rejects.toThrow('Entrada inválida');
    }
    await expect(service.login('nadie@example.test', 'incorrecta', '192.0.2.20'))
      .rejects.toMatchObject({ constructor: RateLimitedError });
    await expect(service.register('invalido', 'dato-ficticio', '192.0.2.21'))
      .rejects.toMatchObject({ constructor: RateLimitedError });
    const count = await database.query("SELECT count(*)::int AS count FROM f01.sesion WHERE usuario_id IN (SELECT id FROM f01.usuario WHERE email_canonico='nadie@example.test')");
    expect(count.rows[0].count).toBe(0);
  });
  it('encadena registro, sesion y revocacion HTTP contra PostgreSQL real con rol acotado', async () => {
    const beforeAudit = await database.query('SELECT count(*)::int AS count FROM f01.auditoria_acceso');
    const hasher = new Argon2PasswordHasher();
    const dummyHash = await hasher.hash('solo-ficticio');
    const identity = new IdentityUseCases(new PgAuthUnitOfWork(pool, Buffer.alloc(32, 9)),
      hasher, { now: () => new Date() }, dummyHash);
    const origin = 'http://127.0.0.1:5173';
    const agent = request.agent(createApp(createIdentityRouter(identity, {
      allowedOrigin: origin, csrfKey: Buffer.alloc(32, 8), cookieSecure: false,
    })));
    const csrf = await agent.get('/api/v1/auth/csrf').expect(200);
    const credentials = { email: 'http@example.test', password: 'solo-contrasena-ficticia' };
    await agent.post('/api/v1/auth/register').set('Origin', origin)
      .set('X-CSRF-Token', csrf.body.csrfToken).send(credentials).expect(202);
    await agent.post('/api/v1/auth/register').set('Origin', origin)
      .set('X-CSRF-Token', csrf.body.csrfToken).send(credentials).expect(202);
    const login = await agent.post('/api/v1/auth/login').set('Origin', origin)
      .set('X-CSRF-Token', csrf.body.csrfToken).send(credentials).expect(200);
    expect(login.body.email).toBe(credentials.email);
    expect(JSON.stringify(login.body)).not.toContain(credentials.password);
    await agent.get('/api/v1/auth/session').expect(200);
    const denialCorrelation = randomUUID();
    const activeSecret = /ff-session-local=([a-f0-9]{64})/.exec(login.headers['set-cookie']?.join(';') ?? '')?.[1];
    expect(activeSecret).toBeDefined();
    await identity.auditDenied(activeSecret!, 'PHARMACY_SELECT', denialCorrelation);
    const post = await agent.get('/api/v1/auth/csrf').expect(200);
    await agent.post('/api/v1/auth/logout').set('Origin', origin)
      .set('X-CSRF-Token', post.body.csrfToken).expect(204);
    await agent.get('/api/v1/auth/session').expect(401);
    const count = await database.query("SELECT count(*)::int AS count FROM f01.usuario WHERE email_canonico='http@example.test'");
    expect(count.rows[0].count).toBe(1);
    const afterLogout = await agent.get('/api/v1/auth/csrf').expect(200);
    for (let index = 0; index < 5; index++) {
      await agent.post('/api/v1/auth/login').set('Origin', origin)
        .set('X-CSRF-Token', afterLogout.body.csrfToken)
        .send({ email: 'absent@example.test', password: 'wrong-fictitious' }).expect(401);
    }
    const limited = await agent.post('/api/v1/auth/login').set('Origin', origin)
      .set('X-CSRF-Token', afterLogout.body.csrfToken)
      .send({ email: 'absent@example.test', password: 'wrong-fictitious' }).expect(429);
    expect(Number(limited.headers['retry-after'])).toBeGreaterThan(0);
    expect(JSON.stringify(limited.body)).not.toContain('absent@example.test');
    const events = await database.query(`SELECT accion,resultado,actor_usuario_id,farmacia_id,recurso_tipo,correlation_id
      FROM f01.auditoria_acceso ORDER BY occurred_at`);
    const fresh = events.rows.slice(beforeAudit.rows[0].count);
    expect(fresh).toHaveLength(10);
    expect(fresh.filter(row => row.accion === 'REGISTER')).toHaveLength(2);
    expect(fresh.filter(row => row.accion === 'LOGIN' && row.resultado === 'DENEGADO')).toHaveLength(5);
    expect(fresh).toContainEqual(expect.objectContaining({ accion: 'PHARMACY_SELECT',
      resultado: 'DENEGADO', farmacia_id: null, correlation_id: denialCorrelation }));
    expect(fresh.every(row => row.farmacia_id === null && row.recurso_tipo === 'IDENTITY' && row.correlation_id)).toBe(true);
    expect(JSON.stringify(fresh)).not.toContain(credentials.email);
    expect(JSON.stringify(fresh)).not.toContain(credentials.password);
  });
});
