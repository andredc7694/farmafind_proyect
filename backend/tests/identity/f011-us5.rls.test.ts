import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client, Pool } from 'pg';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import path from 'node:path';
import request from 'supertest';
import { migrateTestDatabase } from '../../src/modules/usuarios/infrastructure/db/migrate.js';
import { createLocalIdentityApp } from '../../src/identity-app.js';
import { Argon2PasswordHasher } from '../../src/modules/usuarios/infrastructure/argon2-password.js';
import { FileMailboxSimulator } from '../../src/modules/usuarios/infrastructure/mailbox-simulator.js';

const baseUrl = process.env.F01_TEST_DATABASE_URL;
const group = baseUrl ? describe : describe.skip;
const origin = 'http://127.0.0.1:5173';
const password = 'clave-ficticia-segura-123';
type Agent = ReturnType<typeof request.agent>;

group('F01.1 US5: perfil y seguridad personal (HTTP + PostgreSQL + RLS)', () => {
  let admin: Client; let database: Client; let composed: Awaited<ReturnType<typeof createLocalIdentityApp>>;
  let server: ReturnType<typeof composed.app.listen>; let mailbox: FileMailboxSimulator; let mailboxDirectory = '';
  let databaseName = ''; let authRole = ''; let tenantRole = '';
  const ids: Record<string, string> = {};

  beforeAll(async () => {
    const base = new URL(baseUrl!);
    if (!/^\/farmafind_f01_test_[a-f0-9]{12}$/.test(base.pathname)) throw new Error('F01.1: solo fixture TEST marcado');
    mkdirSync(path.join(process.cwd(), '.cache'), { recursive: true });
    mailboxDirectory = mkdtempSync(path.join(process.cwd(), '.cache', 'f011-us5-mailbox-'));
    mailbox = new FileMailboxSimulator(mailboxDirectory);
    admin = new Client({ connectionString: baseUrl }); await admin.connect();
    const suffix = randomBytes(6).toString('hex');
    databaseName = `farmafind_f01_test_${suffix}`; authRole = `f011_a5_${suffix}`; tenantRole = `f011_t5_${suffix}`;
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
    for (const [label, email] of [['ana', 'ana@example.test'], ['beto', 'beto@example.test'], ['clara', 'clara@example.test'],
      ['dani', 'dani@example.test'], ['owner', 'dueno@example.test']] as const) {
      ids[label] = randomUUID();
      await database.query('INSERT INTO f01.usuario(id,email_canonico,password_hash) VALUES($1,$2,$3)', [ids[label], email, hash]);
    }
    ids.worker = randomUUID();
    await database.query('INSERT INTO f01.usuario(id,alias_canonico,password_hash) VALUES($1,$2,$3)', [ids.worker, 'alfa.caja1', hash]);
    await database.query(`INSERT INTO f01.usuario_farmacia(usuario_id,farmacia_id,rol) VALUES($1,$2,'DUENO'),($3,$2,'TRABAJADOR')`,
      [ids.owner, pharmacy, ids.worker]);
    composed = await createLocalIdentityApp({ authDatabaseUrl: auth.toString(), tenantDatabaseUrl: tenant.toString(),
      csrfKey: Buffer.alloc(32, 81), abuseKey: Buffer.alloc(32, 82), allowedOrigin: origin, cookieSecure: false, accountMessages: mailbox },
    url => new Pool({ connectionString: url, max: 6 }));
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
    if (mailboxDirectory) rmSync(mailboxDirectory, { recursive: true, force: true });
  });

  const csrf = async (agent: Agent) => (await agent.get('/api/v1/auth/csrf').expect(200)).body.csrfToken as string;
  async function login(identifier: string, secret = password, expected = 200): Promise<Agent> {
    const agent = request.agent(server);
    const token = await csrf(agent);
    await agent.post('/api/v1/auth/login').set('Origin', origin).set('X-CSRF-Token', token).send({ identifier, password: secret }).expect(expected);
    return agent;
  }
  async function send(agent: Agent, path: string, body?: unknown, method: 'post' | 'patch' | 'delete' = 'post') {
    const token = await csrf(agent);
    const call = agent[method](`/api/v1${path}`).set('Origin', origin).set('X-CSRF-Token', token);
    return body === undefined ? call : call.send(body as object);
  }
  async function waitForMessage(to: string, kind: string) {
    for (let attempt = 0; attempt < 40; attempt++) {
      const found = (await mailbox.read(to)).filter(entry => entry.kind === kind);
      if (found.length > 0) return found[found.length - 1];
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    throw new Error(`No llegó el mensaje ${kind} para ${to}`);
  }

  it('el perfil se lee con valores por defecto, se edita parcialmente y nunca expone secretos', async () => {
    const ana = await login('ana@example.test');
    const initial = await ana.get('/api/v1/me/profile').expect(200);
    expect(initial.headers['cache-control']).toBe('no-store');
    expect(initial.body).toEqual({ userId: ids.ana, displayName: null, phone: null, avatarPreset: null, theme: 'SISTEMA',
      notifyReservations: true, notifySecurity: true, email: 'ana@example.test', emailVerified: false });
    const updated = await send(ana, '/me/profile', { displayName: ' Ana Prueba ', phone: '+51 999 111 222', avatarPreset: 4,
      theme: 'OSCURO', notifyReservations: false }, 'patch');
    expect(updated.status).toBe(200);
    expect(updated.body).toMatchObject({ displayName: 'Ana Prueba', phone: '+51 999 111 222', avatarPreset: 4, theme: 'OSCURO',
      notifyReservations: false, notifySecurity: true });
    const partial = await send(ana, '/me/profile', { phone: null }, 'patch');
    expect(partial.body).toMatchObject({ displayName: 'Ana Prueba', phone: null, theme: 'OSCURO' });
    expect(JSON.stringify(partial.body)).not.toMatch(/hash|password|secret/i);
    await ana.get('/api/v1/me/profile').expect(200);
    // Aislamiento: el perfil de otra persona no cambió.
    const beto = await login('beto@example.test');
    expect((await beto.get('/api/v1/me/profile').expect(200)).body).toMatchObject({ userId: ids.beto, displayName: null, theme: 'SISTEMA' });
    await request(server).get('/api/v1/me/profile').expect(401);
  });

  it('rechaza valores inválidos y cualquier campo de rol, membresía, permiso o estado (FR-014)', async () => {
    const owner = await login('dueno@example.test');
    const before = await database.query('SELECT rol,estado FROM f01.usuario_farmacia WHERE usuario_id=$1', [ids.owner]);
    const userBefore = await database.query('SELECT email_canonico,alias_canonico,estado,password_hash FROM f01.usuario WHERE id=$1', [ids.owner]);
    const invalid: unknown[] = [{}, { avatarPreset: 13 }, { avatarPreset: 1.5 }, { theme: 'ROJO' }, { phone: 'abc' }, { notifySecurity: 'true' },
      { displayName: 'x'.repeat(121) }, { displayName: 5 }, [], 'texto',
      { role: 'ADMINISTRADOR_PLATAFORMA' }, { roles: ['DUENO'] }, { rol: 'DUENO' }, { membershipId: randomUUID() }, { capabilities: ['inventory.write'] },
      { estado: 'ACTIVO' }, { state: 'ACTIVO' }, { userId: ids.beto }, { email: 'otro@example.test' }, { displayName: 'Ok', role: 'DUENO' }];
    for (const body of invalid) expect((await send(owner, '/me/profile', body, 'patch')).status, JSON.stringify(body)).toBe(400);
    expect((await database.query('SELECT rol,estado FROM f01.usuario_farmacia WHERE usuario_id=$1', [ids.owner])).rows).toEqual(before.rows);
    expect((await database.query('SELECT email_canonico,alias_canonico,estado,password_hash FROM f01.usuario WHERE id=$1', [ids.owner])).rows).toEqual(userBefore.rows);
    expect((await database.query('SELECT count(*)::int AS n FROM f01.perfil_usuario WHERE usuario_id=$1', [ids.owner])).rows[0].n).toBe(0);
    for (const route of ['/me/roles', '/me/memberships/grant', '/me/permissions']) expect([404, 403]).toContain((await send(owner, route, {})).status);
  });

  it('cambio de clave: exige la clave actual, limita fallos y cierra las demás sesiones conservando la actual', async () => {
    const first = await login('clara@example.test'); const second = await login('clara@example.test');
    expect((await send(first, '/me/password', { currentPassword: 'incorrecta-xyz-123', newPassword: 'clave-nueva-clara-1' })).status).toBe(401);
    expect((await send(first, '/me/password', { currentPassword: password, newPassword: 'corta' })).status).toBe(400);
    expect((await send(first, '/me/password', { currentPassword: password })).status).toBe(400);
    expect((await send(first, '/me/password', { currentPassword: password, newPassword: 'clave-nueva-clara-1' })).status).toBe(204);
    await first.get('/api/v1/auth/session').expect(200);
    await second.get('/api/v1/auth/session').expect(401);
    await login('clara@example.test', password, 401);
    await login('clara@example.test', 'clave-nueva-clara-1');
    const audit = await database.query(`SELECT accion,resultado FROM f01.auditoria_identidad WHERE actor_usuario_id=$1 AND accion='PASSWORD_CHANGE' ORDER BY ocurrido_at`, [ids.clara]);
    expect(audit.rows).toEqual([{ accion: 'PASSWORD_CHANGE', resultado: 'DENEGADO' }, { accion: 'PASSWORD_CHANGE', resultado: 'PERMITIDO' }]);
    expect(JSON.stringify(audit.rows)).not.toContain('clave-nueva');
  });

  it('cinco reautenticaciones fallidas bloquean los intentos de esa cuenta (429)', async () => {
    const dani = await login('dani@example.test');
    const statuses: number[] = [];
    for (let i = 0; i < 7; i++) statuses.push((await send(dani, '/me/password', { currentPassword: 'incorrecta-xyz-123', newPassword: 'clave-nueva-dani-1' })).status);
    expect(statuses.slice(0, 5)).toEqual([401, 401, 401, 401, 401]);
    expect(statuses.slice(5)).toEqual([429, 429]);
    expect((await send(dani, '/me/password', { currentPassword: password, newPassword: 'clave-nueva-dani-1' })).status).toBe(429);
    await login('dani@example.test', password); // la clave no cambió
  });

  it('cambio de correo: reautenticación, código al correo NUEVO, no cambia hasta verificar y no se reutiliza', async () => {
    const ana = await login('ana@example.test');
    expect((await send(ana, '/me/email/change', { newEmail: 'ana.nueva@example.test', currentPassword: 'incorrecta-xyz-123' })).status).toBe(401);
    expect((await send(ana, '/me/email/change', { newEmail: 'no-es-correo', currentPassword: password })).status).toBe(400);
    expect((await send(ana, '/me/email/change', { newEmail: 'ana@example.test', currentPassword: password })).status).toBe(400);
    expect((await send(ana, '/me/email/change', { newEmail: 'ana.nueva@example.test', currentPassword: password, extra: 1 })).status).toBe(400);
    const requested = await send(ana, '/me/email/change', { newEmail: ' Ana.Nueva@Example.test ', currentPassword: password });
    expect(requested.status).toBe(202); expect(requested.text).toBe('');
    const message = await waitForMessage('ana.nueva@example.test', 'CAMBIO_CORREO');
    expect(await mailbox.read('ana@example.test')).toEqual([]);
    expect((await ana.get('/api/v1/me/profile')).body.email).toBe('ana@example.test'); // aún no cambia
    await login('ana.nueva@example.test', password, 401);
    const stored = await database.query('SELECT correo_destino,encode(token_hash,\'hex\') AS digest FROM f01.token_cuenta WHERE proposito=\'CAMBIO_CORREO\'');
    expect(stored.rows).toHaveLength(1);
    expect(stored.rows[0].correo_destino).toBe('ana.nueva@example.test');
    expect(JSON.stringify(stored.rows)).not.toContain(message.code);
    const anonymous = request.agent(server);
    expect((await send(anonymous, '/auth/email/verify', { token: message.code })).status).toBe(204);
    expect((await send(anonymous, '/auth/email/verify', { token: message.code })).status).toBe(400);
    const profile = (await ana.get('/api/v1/me/profile')).body;
    expect(profile).toMatchObject({ email: 'ana.nueva@example.test', emailVerified: true });
    await login('ana.nueva@example.test');
    await login('ana@example.test', password, 401);
    const audit = await database.query(`SELECT resultado FROM f01.auditoria_identidad WHERE actor_usuario_id=$1 AND accion='EMAIL_CHANGE' ORDER BY ocurrido_at`, [ids.ana]);
    expect(audit.rows.map(row => row.resultado)).toEqual(['DENEGADO', 'PERMITIDO']);
  });

  it('pedir un correo ya usado por otra cuenta responde igual y no envía nada ni cambia nada', async () => {
    const beto = await login('beto@example.test');
    const taken = await send(beto, '/me/email/change', { newEmail: 'dani@example.test', currentPassword: password });
    expect(taken.status).toBe(202); expect(taken.text).toBe('');
    await new Promise(resolve => setTimeout(resolve, 300));
    expect(await mailbox.read('dani@example.test')).toEqual([]);
    expect((await beto.get('/api/v1/me/profile')).body.email).toBe('beto@example.test');
    expect((await database.query(`SELECT count(*)::int AS n FROM f01.token_cuenta WHERE usuario_id=$1 AND proposito='CAMBIO_CORREO'`, [ids.beto])).rows[0].n).toBe(0);
  });

  it('un trabajador con alias agrega su correo desde el perfil y debe verificarlo', async () => {
    const worker = await login('alfa.caja1');
    expect((await worker.get('/api/v1/me/profile')).body).toMatchObject({ email: null, emailVerified: false });
    expect((await send(worker, '/me/email/verification')).status).toBe(400); // sin correo aún
    expect((await send(worker, '/me/email/change', { newEmail: 'trabajador.caja1@example.test', currentPassword: password })).status).toBe(202);
    const message = await waitForMessage('trabajador.caja1@example.test', 'CAMBIO_CORREO');
    expect((await send(request.agent(server), '/auth/email/verify', { token: message.code })).status).toBe(204);
    expect((await worker.get('/api/v1/me/profile')).body).toMatchObject({ email: 'trabajador.caja1@example.test', emailVerified: true });
    await login('alfa.caja1'); // el alias sigue funcionando
  });

  it('sesiones propias: lista sin secretos, cierra una o las demás, y no ve ni cierra las ajenas', async () => {
    const one = await login('beto@example.test'); const two = await login('beto@example.test'); const three = await login('beto@example.test');
    const other = await login('clara@example.test', 'clave-nueva-clara-1');
    const listed = (await one.get('/api/v1/me/sessions').expect(200)).body as Array<Record<string, unknown>>;
    expect(listed.length).toBeGreaterThanOrEqual(3);
    expect(listed.filter(item => item.current)).toHaveLength(1);
    expect(Object.keys(listed[0]).sort()).toEqual(['createdAt', 'current', 'id', 'lastUsedAt']);
    expect(JSON.stringify(listed)).not.toMatch(/fingerprint|token|secret/i);
    const rowIds = (await database.query(`SELECT id FROM f01.sesion WHERE usuario_id=$1 AND estado='VIGENTE'`, [ids.beto])).rows.map(row => row.id);
    expect(listed.map(item => item.id).sort()).toEqual([...rowIds].sort());
    const foreign = (await database.query(`SELECT id FROM f01.sesion WHERE usuario_id=$1 AND estado='VIGENTE' LIMIT 1`, [ids.clara])).rows[0].id;
    expect((await send(one, `/me/sessions/${foreign}`, undefined, 'delete')).status).toBe(404);
    expect((await send(one, `/me/sessions/${randomUUID()}`, undefined, 'delete')).status).toBe(404);
    expect((await send(one, '/me/sessions/no-uuid', undefined, 'delete')).status).toBe(400);
    await other.get('/api/v1/auth/session').expect(200);
    const twoId = listed.find(item => !item.current && item.id !== foreign)!.id as string;
    expect((await send(one, `/me/sessions/${twoId}`, undefined, 'delete')).status).toBe(204);
    expect((await send(one, '/me/sessions/revoke-others')).status).toBe(204);
    await one.get('/api/v1/auth/session').expect(200);
    await two.get('/api/v1/auth/session').expect(401); await three.get('/api/v1/auth/session').expect(401);
    await other.get('/api/v1/auth/session').expect(200);
    expect(((await one.get('/api/v1/me/sessions')).body as unknown[]).length).toBe(1);
  });

  it('una sesión restringida no puede usar el perfil y las funciones no están al alcance del rol de aplicación', async () => {
    const agent = await login('dani@example.test');
    await database.query(`UPDATE f01.sesion SET restringida_motivo='CAMBIO_CLAVE' WHERE usuario_id=$1`, [ids.dani]);
    for (const path of ['/me/profile', '/me/sessions']) expect((await agent.get(`/api/v1${path}`)).status).toBe(403);
    expect((await send(agent, '/me/password', { currentPassword: password, newPassword: 'clave-nueva-dani-1' })).status).toBe(403);
    const privilege = await database.query(`SELECT has_function_privilege('f01_runtime','f01.get_own_profile()','EXECUTE') AS runtime,
      has_function_privilege('f01_auth','f01.get_own_profile()','EXECUTE') AS auth,
      has_function_privilege('f01_auth','f01.own_session_user()','EXECUTE') AS helper`);
    expect(privilege.rows[0]).toEqual({ runtime: false, auth: true, helper: false });
  });
});
