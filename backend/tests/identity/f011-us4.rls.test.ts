import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client, Pool } from 'pg';
import { randomBytes, randomUUID } from 'node:crypto';
import request from 'supertest';
import { migrateTestDatabase } from '../../src/modules/usuarios/infrastructure/db/migrate.js';
import { createLocalIdentityApp } from '../../src/identity-app.js';
import { Argon2PasswordHasher } from '../../src/modules/usuarios/infrastructure/argon2-password.js';
import { totpCode, totpStep } from '../../src/modules/usuarios/domain/totp.js';
// @ts-expect-error script .mjs sin tipos
import { resetMfa } from '../../../scripts/f01/reset-mfa.mjs';

const baseUrl = process.env.F01_TEST_DATABASE_URL;
const group = baseUrl ? describe : describe.skip;
const origin = 'http://127.0.0.1:5173';
const password = 'clave-ficticia-segura-123';
type Agent = ReturnType<typeof request.agent>;

const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function base32Decode(text: string): Buffer {
  let bits = 0; let value = 0; const out: number[] = [];
  for (const char of text) {
    value = (value << 5) | alphabet.indexOf(char); bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; }
  }
  return Buffer.from(out);
}

group('F01.1 US4: segundo factor TOTP del administrador general (HTTP + PostgreSQL + RLS)', () => {
  let admin: Client; let database: Client; let composed: Awaited<ReturnType<typeof createLocalIdentityApp>>;
  let server: ReturnType<typeof composed.app.listen>;
  let databaseName = ''; let authRole = ''; let tenantRole = '';
  const ids: Record<string, string> = {};
  let totpSecret: Buffer;

  beforeAll(async () => {
    const base = new URL(baseUrl!);
    if (!/^\/farmafind_f01_test_[a-f0-9]{12}$/.test(base.pathname)) throw new Error('F01.1: solo fixture TEST marcado');
    admin = new Client({ connectionString: baseUrl }); await admin.connect();
    const suffix = randomBytes(6).toString('hex');
    databaseName = `farmafind_f01_test_${suffix}`; authRole = `f011_a4_${suffix}`; tenantRole = `f011_t4_${suffix}`;
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
    const hash = await new Argon2PasswordHasher().hash(password);
    const pharmacy = randomUUID();
    await database.query('INSERT INTO f01.farmacia_referencia(id,nombre_publico) VALUES($1,$2)', [pharmacy, 'Farmacia ficticia Alfa']);
    for (const [label, email] of [['admin', 'admin@example.test'], ['admin2', 'admin2@example.test'], ['owner', 'dueno@example.test'],
      ['worker', 'trabajador@example.test'], ['customer', 'cliente@example.test']] as const) {
      ids[label] = randomUUID();
      await database.query('INSERT INTO f01.usuario(id,email_canonico,password_hash) VALUES($1,$2,$3)', [ids[label], email, hash]);
    }
    await database.query(`INSERT INTO f01.usuario_farmacia(usuario_id,farmacia_id,rol) VALUES($1,$2,'DUENO'),($3,$2,'TRABAJADOR')`,
      [ids.owner, pharmacy, ids.worker]);
    for (const label of ['admin', 'admin2']) {
      const approval = randomUUID();
      await database.query(`INSERT INTO f01.privileged_approval(id,operation,target_usuario_id,role_code,reason,expires_at,integrity_hash)
        VALUES($1,'INITIAL_PLATFORM_ADMIN',$2,'ADMINISTRADOR_PLATAFORMA','Fixture sintético TEST',now()+interval '1 hour',$3)`,
      [approval, ids[label], 'a'.repeat(64)]);
      await database.query(`INSERT INTO f01.platform_role_assignment(usuario_id,role_code,approval_id)
        VALUES($1,'ADMINISTRADOR_PLATAFORMA',$2)`, [ids[label], approval]);
    }
    composed = await createLocalIdentityApp({ authDatabaseUrl: auth.toString(), tenantDatabaseUrl: tenant.toString(),
      csrfKey: Buffer.alloc(32, 71), abuseKey: Buffer.alloc(32, 72), allowedOrigin: origin, cookieSecure: false,
      mfaKey: randomBytes(32) }, url => new Pool({ connectionString: url, max: 6 }));
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

  const csrf = async (agent: Agent) => (await agent.get('/api/v1/auth/csrf').expect(200)).body.csrfToken as string;
  async function login(email: string): Promise<{ agent: Agent; body: Record<string, unknown> }> {
    const agent = request.agent(server);
    const token = await csrf(agent);
    const response = await agent.post('/api/v1/auth/login').set('Origin', origin).set('X-CSRF-Token', token)
      .send({ identifier: email, password }).expect(200);
    return { agent, body: response.body };
  }
  async function send(agent: Agent, path: string, body?: unknown) {
    const token = await csrf(agent);
    const call = agent.post(`/api/v1${path}`).set('Origin', origin).set('X-CSRF-Token', token);
    return body === undefined ? call : call.send(body as object);
  }
  const codeAt = (offset: number) => totpCode(totpSecret, totpStep(Date.now()) + offset);

  it('cliente, trabajador y propietario no pueden iniciar el alta del factor (sin ruta de ascenso)', async () => {
    for (const email of ['cliente@example.test', 'trabajador@example.test', 'dueno@example.test']) {
      const { agent, body } = await login(email);
      expect(body.restriction).toBeUndefined();
      expect((await send(agent, '/me/mfa/enroll')).status).toBe(403);
      expect((await send(agent, '/me/mfa/activate', { code: '123456' })).status).toBe(401);
      expect((await agent.get('/api/v1/platform/role-assignments')).status).toBe(403);
      for (const route of ['/me/roles', '/me/platform-role', '/me/mfa/disable', '/me/mfa/reset', '/platform/mfa/reset']) {
        expect([404, 403]).toContain((await send(agent, route, {})).status);
      }
    }
    const denied = await database.query(`SELECT count(*)::int AS n FROM f01.auditoria_identidad WHERE accion='ELEVATION_DENIED'`);
    expect(denied.rows[0].n).toBe(3);
    const rows = await database.query('SELECT count(*)::int AS n FROM f01.mfa_totp');
    expect(rows.rows[0].n).toBe(0);
  });

  it('administrador sin factor: entra sin restricción pero /platform/** devuelve 403; el alta cifra el secreto', async () => {
    const { agent, body } = await login('admin@example.test');
    expect(body.restriction).toBeUndefined();
    expect((await agent.get('/api/v1/platform/role-assignments')).status).toBe(403);
    const enrolled = await send(agent, '/me/mfa/enroll');
    expect(enrolled.status).toBe(201);
    expect(enrolled.headers['cache-control']).toBe('no-store');
    expect(Object.keys(enrolled.body).sort()).toEqual(['otpauthUri', 'secret']);
    expect(enrolled.body.otpauthUri).toContain('otpauth://totp/');
    totpSecret = base32Decode(enrolled.body.secret);
    const stored = await database.query('SELECT secreto_cifrado,nonce,estado FROM f01.mfa_totp WHERE usuario_id=$1', [ids.admin]);
    expect(stored.rows[0].estado).toBe('PENDIENTE');
    expect((stored.rows[0].secreto_cifrado as Buffer).includes(totpSecret)).toBe(false);
    // Aún pendiente: el código correcto no sirve para /auth/mfa/verify y /platform sigue cerrado.
    expect((await agent.get('/api/v1/platform/role-assignments')).status).toBe(403);
    expect((await send(agent, '/me/mfa/activate', { code: '000000' })).status).toBe(401);
    expect((await send(agent, '/me/mfa/activate', { code: codeAt(0), extra: 1 })).status).toBe(400);
    expect((await agent.get('/api/v1/platform/role-assignments')).status).toBe(403);
    expect((await send(agent, '/me/mfa/activate', { code: codeAt(0) })).status).toBe(204);
    expect((await agent.get('/api/v1/platform/role-assignments')).status).toBe(200);
    expect((await send(agent, '/me/mfa/enroll')).status).toBe(409);
  });

  it('con el factor activo, el siguiente inicio de sesión queda restringido hasta verificar; un código no se reutiliza', async () => {
    const first = await login('admin@example.test');
    expect(first.body.restriction).toBe('MFA_PENDIENTE');
    expect((await first.agent.get('/api/v1/platform/role-assignments')).status).toBe(403);
    expect((await first.agent.get('/api/v1/pharmacies')).status).toBe(403);
    expect((await send(first.agent, '/me/mfa/enroll')).status).toBe(403);
    // El código del alta (paso actual) ya fue consumido: se rechaza aunque sea correcto.
    expect((await send(first.agent, '/auth/mfa/verify', { code: codeAt(0) })).status).toBe(401);
    expect((await send(first.agent, '/auth/mfa/verify', { code: codeAt(1) })).status).toBe(204);
    expect((await first.agent.get('/api/v1/platform/role-assignments')).status).toBe(200);
    expect(((await first.agent.get('/api/v1/auth/session')).body as Record<string, unknown>).restriction).toBeUndefined();
    // Otra sesión no puede reutilizar el mismo código.
    const second = await login('admin@example.test');
    expect((await send(second.agent, '/auth/mfa/verify', { code: codeAt(1) })).status).toBe(401);
    expect((await second.agent.get('/api/v1/platform/role-assignments')).status).toBe(403);
    // Una sesión nueva sin verificar no hereda la verificación de la otra.
    const audit = await database.query(`SELECT accion,resultado FROM f01.auditoria_identidad WHERE actor_usuario_id=$1
      AND accion IN ('MFA_ENROLL','MFA_VERIFY') ORDER BY ocurrido_at`, [ids.admin]);
    expect(audit.rows.filter(row => row.resultado === 'PERMITIDO').map(row => row.accion)).toEqual(['MFA_ENROLL', 'MFA_VERIFY', 'MFA_VERIFY']);
    expect(audit.rows.some(row => row.resultado === 'DENEGADO')).toBe(true);
  });

  it('cinco códigos incorrectos bloquean los intentos de esa cuenta (429)', async () => {
    const session = await login('admin@example.test');
    const statuses: number[] = [];
    for (let i = 0; i < 7; i++) statuses.push((await send(session.agent, '/auth/mfa/verify', { code: '000000' })).status);
    expect(statuses.slice(-1)[0]).toBe(429);
    expect(statuses).toContain(401);
    // Ni siquiera el código correcto sirve mientras dure el bloqueo.
    expect((await send(session.agent, '/auth/mfa/verify', { code: codeAt(-1) })).status).toBe(429);
  });

  it('el segundo administrador y sus sesiones son independientes (no hereda el factor del primero)', async () => {
    const other = await login('admin2@example.test');
    expect(other.body.restriction).toBeUndefined();
    expect((await other.agent.get('/api/v1/platform/role-assignments')).status).toBe(403);
    const rows = await database.query('SELECT usuario_id FROM f01.mfa_totp');
    expect(rows.rows.map(row => row.usuario_id)).toEqual([ids.admin]);
  });

  it('el reinicio técnico offline destruye el secreto, cierra sesiones, audita y permite un alta nueva', async () => {
    // El bloqueo por intentos del caso anterior sigue vigente; se limpia en la fixture (el reinicio es otro procedimiento).
    await database.query("DELETE FROM f01.abuse_attempt");
    const before = await login('admin@example.test');
    const outcome = await resetMfa(database, ids.admin);
    expect(outcome.previousState).toBe('ACTIVO');
    expect(outcome.sessionsClosed).toBeGreaterThan(0);
    expect((await before.agent.get('/api/v1/auth/session')).status).toBe(401);
    const stored = await database.query('SELECT estado,secreto_cifrado FROM f01.mfa_totp WHERE usuario_id=$1', [ids.admin]);
    expect(stored.rows[0].estado).toBe('REINICIADO');
    expect((stored.rows[0].secreto_cifrado as Buffer).length).toBe(1);
    const audit = await database.query(`SELECT actor_usuario_id,objetivo_usuario_id FROM f01.auditoria_identidad WHERE accion='MFA_RESET'`);
    expect(audit.rows).toEqual([{ actor_usuario_id: null, objetivo_usuario_id: ids.admin }]);
    // Sin factor activo: entra sin restricción, /platform/** sigue cerrado y debe enrolarse de nuevo.
    const again = await login('admin@example.test');
    expect(again.body.restriction).toBeUndefined();
    expect((await again.agent.get('/api/v1/platform/role-assignments')).status).toBe(403);
    expect((await send(again.agent, '/auth/mfa/verify', { code: codeAt(0) })).status).toBe(401);
    const previousSecret = totpSecret;
    const enrolled = await send(again.agent, '/me/mfa/enroll');
    expect(enrolled.status).toBe(201);
    totpSecret = base32Decode(enrolled.body.secret);
    expect(totpSecret.equals(previousSecret)).toBe(false);
    expect((await send(again.agent, '/me/mfa/activate', { code: codeAt(0) })).status).toBe(204);
    expect((await again.agent.get('/api/v1/platform/role-assignments')).status).toBe(200);
  });

  it('el rol de aplicación no puede leer ni escribir el secreto directamente', async () => {
    const privilege = await database.query(`SELECT has_table_privilege('f01_runtime','f01.mfa_totp','SELECT') AS lee,
      has_table_privilege('f01_runtime','f01.mfa_totp','INSERT') AS inserta,
      has_column_privilege('f01_auth','f01.mfa_totp','secreto_cifrado','UPDATE') AS cambia_secreto,
      has_function_privilege('f01_runtime','f01.complete_mfa(text,bigint)','EXECUTE') AS runtime_completa`);
    expect(privilege.rows[0]).toEqual({ lee: false, inserta: false, cambia_secreto: false, runtime_completa: false });
  });
});
