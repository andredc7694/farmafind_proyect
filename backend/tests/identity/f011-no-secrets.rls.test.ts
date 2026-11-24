import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Client, Pool } from 'pg';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import path from 'node:path';
import request from 'supertest';
import { migrateTestDatabase } from '../../src/modules/usuarios/infrastructure/db/migrate.js';
import { createLocalIdentityApp } from '../../src/identity-app.js';
import { Argon2PasswordHasher } from '../../src/modules/usuarios/infrastructure/argon2-password.js';
import { FileMailboxSimulator } from '../../src/modules/usuarios/infrastructure/mailbox-simulator.js';
import { totpCode, totpStep } from '../../src/modules/usuarios/domain/totp.js';

const baseUrl = process.env.F01_TEST_DATABASE_URL;
const group = baseUrl ? describe : describe.skip;
const origin = 'http://127.0.0.1:5173';
const password = 'clave-ficticia-segura-123';
const newPassword = 'clave-nueva-ficticia-456';
type Agent = ReturnType<typeof request.agent>;

const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function base32Decode(text: string): Buffer {
  let bits = 0; let value = 0; const out: number[] = [];
  for (const char of text) { value = (value << 5) | alphabet.indexOf(char); bits += 5; if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; } }
  return Buffer.from(out);
}

group('F01.1 transversal: ningún secreto en auditoría, registros, tablas ni respuestas posteriores (HTTP + PostgreSQL)', () => {
  let admin: Client; let database: Client; let composed: Awaited<ReturnType<typeof createLocalIdentityApp>>;
  let server: ReturnType<typeof composed.app.listen>; let mailbox: FileMailboxSimulator; let mailboxDirectory = '';
  let databaseName = ''; let authRole = ''; let tenantRole = '';
  const ids: Record<string, string> = {};
  const secrets = new Map<string, string>();      // etiqueta → valor que NO debe reaparecer
  const later: string[] = [];                      // cuerpos de respuestas posteriores a la entrega
  const logs: string[] = [];
  let pharmacy = '';

  beforeAll(async () => {
    const base = new URL(baseUrl!);
    if (!/^\/farmafind_f01_test_[a-f0-9]{12}$/.test(base.pathname)) throw new Error('F01.1: solo fixture TEST marcado');
    mkdirSync(path.join(process.cwd(), '.cache'), { recursive: true });
    mailboxDirectory = mkdtempSync(path.join(process.cwd(), '.cache', 'f011-nosecrets-mailbox-'));
    mailbox = new FileMailboxSimulator(mailboxDirectory);
    admin = new Client({ connectionString: baseUrl }); await admin.connect();
    const suffix = randomBytes(6).toString('hex');
    databaseName = `farmafind_f01_test_${suffix}`; authRole = `f011_a7_${suffix}`; tenantRole = `f011_t7_${suffix}`;
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
    pharmacy = randomUUID();
    await database.query('INSERT INTO f01.farmacia_referencia(id,nombre_publico) VALUES($1,$2)', [pharmacy, 'Farmacia ficticia Alfa']);
    for (const [label, email] of [['owner', 'dueno@example.test'], ['rita', 'rita@example.test'], ['sofia', 'sofia@example.test'], ['admin', 'admin@example.test']] as const) {
      ids[label] = randomUUID();
      await database.query('INSERT INTO f01.usuario(id,email_canonico,password_hash) VALUES($1,$2,$3)', [ids[label], email, hash]);
    }
    const membership = (await database.query(`INSERT INTO f01.usuario_farmacia(usuario_id,farmacia_id,rol) VALUES($1,$2,'DUENO') RETURNING id`, [ids.owner, pharmacy])).rows[0];
    await database.query(`INSERT INTO f01.delegacion(membresia_id,farmacia_id,capacidad,granted_by_usuario_id) VALUES($1,$2,'membership.manage',$3)`, [membership.id, pharmacy, ids.owner]);
    const approval = randomUUID();
    await database.query(`INSERT INTO f01.privileged_approval(id,operation,target_usuario_id,role_code,reason,expires_at,integrity_hash)
      VALUES($1,'INITIAL_PLATFORM_ADMIN',$2,'ADMINISTRADOR_PLATAFORMA','Fixture sintético TEST',now()+interval '1 hour',$3)`, [approval, ids.admin, 'a'.repeat(64)]);
    await database.query(`INSERT INTO f01.platform_role_assignment(usuario_id,role_code,approval_id) VALUES($1,'ADMINISTRADOR_PLATAFORMA',$2)`, [ids.admin, approval]);
    composed = await createLocalIdentityApp({ authDatabaseUrl: auth.toString(), tenantDatabaseUrl: tenant.toString(),
      csrfKey: Buffer.alloc(32, 91), abuseKey: Buffer.alloc(32, 92), allowedOrigin: origin, cookieSecure: false,
      accountMessages: mailbox, mfaKey: randomBytes(32) }, url => new Pool({ connectionString: url, max: 6 }));
    server = composed.app.listen(0, '127.0.0.1');
    secrets.set('clave de prueba', password); secrets.set('clave nueva de prueba', newPassword);
  });

  afterAll(async () => {
    vi.restoreAllMocks();
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
  async function login(identifier: string, secret = password, expected = 200): Promise<{ agent: Agent; cookie: string }> {
    const agent = request.agent(server);
    const token = await csrf(agent);
    const response = await agent.post('/api/v1/auth/login').set('Origin', origin).set('X-CSRF-Token', token).send({ identifier, password: secret }).expect(expected);
    const cookie = ((response.headers['set-cookie'] as unknown as string[] | undefined) ?? []).join(';').match(/ff-session-local=([0-9a-f]{64})/)?.[1] ?? '';
    if (cookie) secrets.set(`sesión de ${identifier}`, cookie);
    return { agent, cookie };
  }
  async function send(agent: Agent, path: string, body?: unknown, method: 'post' | 'put' | 'patch' = 'post') {
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
  const remember = (response: { text: string }) => { later.push(response.text); };

  it('recorre todos los flujos que emiten secretos y recoge cada secreto emitido', async () => {
    for (const method of ['log', 'info', 'warn', 'error', 'debug'] as const) {
      vi.spyOn(console, method).mockImplementation((...args: unknown[]) => { logs.push(args.map(String).join(' ')); });
    }
    const originalStdout = process.stdout.write.bind(process.stdout); const originalStderr = process.stderr.write.bind(process.stderr);
    vi.spyOn(process.stdout, 'write').mockImplementation(((chunk: unknown, ...rest: unknown[]) => { if (typeof chunk === 'string' && /FARMA|secret|token/i.test(chunk)) logs.push(chunk); return (originalStdout as (...args: unknown[]) => boolean)(chunk, ...rest); }) as never);
    vi.spyOn(process.stderr, 'write').mockImplementation(((chunk: unknown, ...rest: unknown[]) => { if (typeof chunk === 'string') logs.push(chunk); return (originalStderr as (...args: unknown[]) => boolean)(chunk, ...rest); }) as never);

    // 1) Clave temporal de alta y reemisión.
    const owner = await login('dueno@example.test');
    const created = await send(owner.agent, `/pharmacies/${pharmacy}/staff`, { alias: 'alfa.caja1', displayName: 'Caja uno' });
    expect(created.status).toBe(201);
    const firstKey = created.body.temporaryPassword as string;
    secrets.set('clave temporal de alta', firstKey); secrets.set('clave temporal de alta (compacta)', firstKey.replaceAll('-', ''));
    const reissued = await send(owner.agent, `/pharmacies/${pharmacy}/staff/${created.body.userId}/temporary-key`);
    expect(reissued.status).toBe(201);
    secrets.set('clave temporal reemitida', reissued.body.temporaryPassword); secrets.set('clave temporal reemitida (compacta)', (reissued.body.temporaryPassword as string).replaceAll('-', ''));
    const worker = await login('alfa.caja1', reissued.body.temporaryPassword);
    expect((await send(worker.agent, '/auth/password/change-temporary', { newPassword })).status).toBe(204);
    // 2) Restablecimiento y verificación de correo por token.
    const resetter = request.agent(server);
    expect((await send(resetter, '/auth/password/reset/request', { email: 'rita@example.test' })).status).toBe(202);
    const reset = await waitForMessage('rita@example.test', 'RESTABLECER_CLAVE');
    secrets.set('código de restablecimiento', reset.code);
    expect((await send(resetter, '/auth/password/reset/confirm', { token: reset.code, newPassword })).status).toBe(204);
    const sofia = await login('sofia@example.test');
    expect((await send(sofia.agent, '/me/email/verification')).status).toBe(202);
    const verify = await waitForMessage('sofia@example.test', 'VERIFICAR_CORREO');
    secrets.set('código de verificación', verify.code);
    expect((await send(request.agent(server), '/auth/email/verify', { token: verify.code })).status).toBe(204);
    // 3) Cambio de correo.
    expect((await send(sofia.agent, '/me/email/change', { newEmail: 'sofia.nueva@example.test', currentPassword: password })).status).toBe(202);
    const change = await waitForMessage('sofia.nueva@example.test', 'CAMBIO_CORREO');
    secrets.set('código de cambio de correo', change.code);
    expect((await send(request.agent(server), '/auth/email/verify', { token: change.code })).status).toBe(204);
    // 4) Segundo factor del administrador.
    const platformAdmin = await login('admin@example.test');
    const enrolled = await send(platformAdmin.agent, '/me/mfa/enroll');
    expect(enrolled.status).toBe(201);
    const totp = base32Decode(enrolled.body.secret);
    secrets.set('secreto TOTP (base32)', enrolled.body.secret); secrets.set('secreto TOTP (hex)', totp.toString('hex'));
    expect((await send(platformAdmin.agent, '/me/mfa/activate', { code: totpCode(totp, totpStep(Date.now())) })).status).toBe(204);
    const second = await login('admin@example.test');
    expect((await send(second.agent, '/auth/mfa/verify', { code: totpCode(totp, totpStep(Date.now()) + 1) })).status).toBe(204);
    // 5) Respuestas posteriores a la entrega.
    for (const [agent, route] of [[owner.agent, `/pharmacies/${pharmacy}/staff`], [owner.agent, `/pharmacies/${pharmacy}/staff/invitations`], [owner.agent, '/me/memberships'],
      [sofia.agent, '/me/profile'], [sofia.agent, '/me/sessions'], [platformAdmin.agent, '/me/profile'], [second.agent, '/auth/session'],
      [second.agent, '/platform/role-assignments'], [worker.agent, '/me/profile'], [worker.agent, '/auth/session']] as const) {
      const response = await (agent as Agent).get(`/api/v1${route}`);
      expect(response.status, route).toBe(200); remember(response);
    }
    expect((await send(platformAdmin.agent, '/me/mfa/enroll')).status).toBe(409); // no reentrega el secreto
    remember((await send(platformAdmin.agent, '/me/mfa/enroll')) as never);
    expect(secrets.size).toBeGreaterThanOrEqual(14);
  });

  it('las respuestas posteriores no repiten ningún secreto emitido', () => {
    const joined = later.join('\n');
    expect(joined.length).toBeGreaterThan(200);
    const leaked = [...secrets].filter(([, value]) => value.length >= 8 && joined.includes(value)).map(([label]) => label);
    expect(leaked).toEqual([]);
  });

  it('los registros del proceso no contienen ningún secreto', () => {
    const joined = logs.join('\n');
    const leaked = [...secrets].filter(([, value]) => value.length >= 8 && joined.includes(value)).map(([label]) => label);
    expect(leaked).toEqual([]);
  });

  it('ninguna tabla del esquema f01 guarda un secreto en claro (solo resúmenes o texto cifrado)', async () => {
    const tables = (await database.query(`SELECT table_name FROM information_schema.tables WHERE table_schema='f01' AND table_type='BASE TABLE'`)).rows.map(row => String(row.table_name));
    expect(tables).toEqual(expect.arrayContaining(['auditoria_identidad', 'token_cuenta', 'credencial_temporal', 'mfa_totp', 'sesion', 'usuario']));
    const leaks: string[] = [];
    for (const table of tables) {
      const rows = (await database.query(`SELECT row_to_json(t)::text AS body FROM f01."${table}" t`)).rows.map(row => String(row.body));
      const dump = rows.join('\n');
      for (const [label, value] of secrets) if (value.length >= 8 && dump.includes(value)) leaks.push(`${table}: ${label}`);
    }
    expect(leaks).toEqual([]);
    // El secreto TOTP en bytes tampoco aparece (la fila guarda el texto cifrado).
    const stored = (await database.query('SELECT secreto_cifrado FROM f01.mfa_totp')).rows[0].secreto_cifrado as Buffer;
    expect(stored.includes(base32Decode(secrets.get('secreto TOTP (base32)')!))).toBe(false);
  });

  it('la auditoría de identidad es un catálogo cerrado: solo columnas de identificación, sin texto libre', async () => {
    const columns = (await database.query(`SELECT column_name FROM information_schema.columns WHERE table_schema='f01' AND table_name='auditoria_identidad' ORDER BY ordinal_position`)).rows.map(row => row.column_name);
    expect(columns).toEqual(['id', 'actor_usuario_id', 'objetivo_usuario_id', 'farmacia_id', 'accion', 'resultado', 'ocurrido_at', 'correlation_id']);
    const actions = (await database.query('SELECT DISTINCT accion FROM f01.auditoria_identidad')).rows.map(row => row.accion);
    expect(actions).toEqual(expect.arrayContaining(['STAFF_CREATE', 'TEMP_KEY_ISSUE', 'TEMP_KEY_CONSUME', 'PASSWORD_CHANGE', 'PASSWORD_RESET', 'EMAIL_VERIFY', 'EMAIL_CHANGE', 'MFA_ENROLL', 'MFA_VERIFY']));
  });
});
