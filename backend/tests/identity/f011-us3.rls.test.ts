import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client, Pool } from 'pg';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
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

group('F01.1 US3: recuperación, verificación de correo y reemisión de clave temporal (HTTP + PostgreSQL)', () => {
  let admin: Client; let database: Client; let composed: Awaited<ReturnType<typeof createLocalIdentityApp>>;
  let server: ReturnType<typeof composed.app.listen>; let mailbox: FileMailboxSimulator; let mailboxDirectory = '';
  let databaseName = ''; let authRole = ''; let tenantRole = '';
  let pharmacyA: string; let pharmacyB: string; let hash: string;
  const ids: Record<string, string> = {};

  beforeAll(async () => {
    const base = new URL(baseUrl!);
    if (!/^\/farmafind_f01_test_[a-f0-9]{12}$/.test(base.pathname)) throw new Error('F01.1: solo fixture TEST marcado');
    mkdirSync(path.join(process.cwd(), '.cache'), { recursive: true });
    mailboxDirectory = mkdtempSync(path.join(process.cwd(), '.cache', 'f011-us3-mailbox-'));
    mailbox = new FileMailboxSimulator(mailboxDirectory);
    admin = new Client({ connectionString: baseUrl }); await admin.connect();
    const suffix = randomBytes(6).toString('hex');
    databaseName = `farmafind_f01_test_${suffix}`; authRole = `f011_a3_${suffix}`; tenantRole = `f011_t3_${suffix}`;
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
    hash = await new Argon2PasswordHasher().hash(password);
    pharmacyA = randomUUID(); pharmacyB = randomUUID();
    await database.query('INSERT INTO f01.farmacia_referencia(id,nombre_publico) VALUES($1,$2),($3,$4)', [pharmacyA, 'Farmacia ficticia Alfa', pharmacyB, 'Farmacia ficticia Beta']);
    for (const [label, email, pharmacy] of [['ownerA', 'dueno-alfa@example.test', pharmacyA], ['ownerB', 'dueno-beta@example.test', pharmacyB]] as const) {
      ids[label] = randomUUID();
      await database.query('INSERT INTO f01.usuario(id,email_canonico,password_hash) VALUES($1,$2,$3)', [ids[label], email, hash]);
      const membership = (await database.query(`INSERT INTO f01.usuario_farmacia(usuario_id,farmacia_id,rol) VALUES($1,$2,'DUENO') RETURNING id`, [ids[label], pharmacy])).rows[0];
      await database.query(`INSERT INTO f01.delegacion(membresia_id,farmacia_id,capacidad,granted_by_usuario_id) VALUES($1,$2,'membership.manage',$3)`, [membership.id, pharmacy, ids[label]]);
    }
    for (const [label, email] of [['rita', 'rita@example.test'], ['sofia', 'sofia@example.test']] as const) {
      ids[label] = randomUUID();
      await database.query('INSERT INTO f01.usuario(id,email_canonico,password_hash) VALUES($1,$2,$3)', [ids[label], email, hash]);
    }
    composed = await createLocalIdentityApp({ authDatabaseUrl: auth.toString(), tenantDatabaseUrl: tenant.toString(),
      csrfKey: Buffer.alloc(32, 61), abuseKey: Buffer.alloc(32, 62), allowedOrigin: origin, cookieSecure: false, accountMessages: mailbox },
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
  async function send(agent: Agent, path: string, body?: unknown, method: 'post' | 'put' | 'delete' = 'post') {
    const token = await csrf(agent);
    const call = agent[method](`/api/v1${path}`).set('Origin', origin).set('X-CSRF-Token', token);
    return body === undefined ? call : call.send(body as object);
  }
  /** La entrega ocurre después de responder; se espera brevemente a que llegue. */
  async function waitForMessage(to: string, kind: string, count = 1) {
    for (let attempt = 0; attempt < 40; attempt++) {
      const found = (await mailbox.read(to)).filter(entry => entry.kind === kind);
      if (found.length >= count) return found[found.length - 1];
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    throw new Error(`No llegó el mensaje ${kind} para ${to}`);
  }
  const sha = (token: string) => createHash('sha256').update(token, 'utf8').digest();

  let resetCode = ''; let ritaOldSession: Agent;

  it('solicitar el restablecimiento es indistinguible exista o no la cuenta; el código llega solo al simulador y no se guarda en claro', async () => {
    ritaOldSession = await login('rita@example.test');
    const agent = request.agent(server);
    const existing = await send(agent, '/auth/password/reset/request', { email: 'rita@example.test' });
    const missing = await send(agent, '/auth/password/reset/request', { email: 'nadie@example.test' });
    expect(existing.status).toBe(202); expect(missing.status).toBe(202);
    expect(existing.text).toBe(missing.text);
    const message = await waitForMessage('rita@example.test', 'RESTABLECER_CLAVE');
    expect(await mailbox.read('nadie@example.test')).toEqual([]);
    resetCode = message.code;
    expect(resetCode.length).toBeGreaterThanOrEqual(40);
    expect(new Date(message.expiresAt).getTime() - Date.now()).toBeLessThanOrEqual(30 * 60_000);
    const tokens = await database.query(`SELECT proposito,encode(token_hash,'hex') AS digest,usado_at FROM f01.token_cuenta`);
    expect(tokens.rows).toHaveLength(1);
    expect(tokens.rows[0]).toMatchObject({ proposito: 'RESTABLECER_CLAVE', usado_at: null });
    expect(tokens.rows[0].digest).toBe(sha(resetCode).toString('hex'));
    expect(JSON.stringify(tokens.rows)).not.toContain(resetCode);
  });

  it('confirmar con el token cambia la clave, cierra todas las sesiones y el token no se reutiliza', async () => {
    const agent = request.agent(server);
    await send(agent, '/auth/password/reset/confirm', { token: resetCode, newPassword: 'corta' }).then(r => expect(r.status).toBe(400));
    const response = await send(agent, '/auth/password/reset/confirm', { token: resetCode, newPassword: 'clave-nueva-recuperada-1' });
    expect(response.status).toBe(204);
    await ritaOldSession.get('/api/v1/auth/session').expect(401); // sesión anterior cerrada
    await login('rita@example.test', 'clave-nueva-recuperada-1');
    expect((await database.query(`SELECT usado_at FROM f01.token_cuenta`)).rows[0].usado_at).not.toBeNull();
    const audit = await database.query(`SELECT accion FROM f01.auditoria_identidad WHERE actor_usuario_id=$1`, [ids.rita]);
    expect(audit.rows.map(row => row.accion)).toContain('PASSWORD_RESET');
  });

  it('un token inválido, usado o vencido recibe el mismo 400', async () => {
    const agent = request.agent(server);
    const bad = await send(agent, '/auth/password/reset/confirm', { token: 'x'.repeat(43), newPassword: 'clave-nueva-recuperada-2' });
    const used = await send(agent, '/auth/password/reset/confirm', { token: resetCode, newPassword: 'clave-nueva-recuperada-2' });
    expect(bad.status).toBe(400); expect(used.status).toBe(400);
    expect(bad.body.message).toBe(used.body.message);
    // La clave antigua no se cambió por los intentos fallidos.
    await login('rita@example.test', 'clave-nueva-recuperada-1');
  });

  it('el límite de intentos bloquea con 429 por igual a cuentas existentes e inexistentes', async () => {
    const agent = request.agent(server);
    // Alcanzar el presupuesto por IP (5 intentos en 15 min) con tokens inválidos.
    for (let attempt = 0; attempt < 5; attempt++) {
      await send(agent, '/auth/password/reset/confirm', { token: `y${attempt}`.padEnd(43, 'y'), newPassword: 'clave-nueva-recuperada-3' });
    }
    const existing = await send(agent, '/auth/password/reset/request', { email: 'sofia@example.test' });
    const missing = await send(agent, '/auth/password/reset/request', { email: 'fantasma@example.test' });
    expect(existing.status).toBe(429); expect(missing.status).toBe(429);
    expect(existing.headers['retry-after']).toBeDefined();
    expect(Math.abs(Number(existing.headers['retry-after']) - Number(missing.headers['retry-after']))).toBeLessThanOrEqual(2);
    expect(await mailbox.read('sofia@example.test')).toEqual([]);
  });

  it('verificación de correo: solicitud autenticada, token de un solo uso y cuentas sin correo rechazadas', async () => {
    const sofia = await login('sofia@example.test');
    expect((await send(sofia, '/me/email/verification')).status).toBe(202);
    const message = await waitForMessage('sofia@example.test', 'VERIFICAR_CORREO');
    expect(new Date(message.expiresAt).getTime() - Date.now()).toBeGreaterThan(23 * 3_600_000);
    expect((await database.query('SELECT email_verificado_at FROM f01.usuario WHERE id=$1', [ids.sofia])).rows[0].email_verificado_at).toBeNull();
    await send(request.agent(server), '/auth/email/verify', { token: message.code }).then(r => expect(r.status).toBe(429)); // presupuesto por IP agotado arriba
    // Se consume por función de base de datos para no depender del presupuesto de la IP de prueba.
    const verified = await database.query(`SELECT f01.verify_email($1) AS ok`, [sha(message.code)]);
    expect(verified.rows[0].ok).toBe(true);
    expect((await database.query('SELECT email_verificado_at FROM f01.usuario WHERE id=$1', [ids.sofia])).rows[0].email_verificado_at).not.toBeNull();
    expect((await database.query(`SELECT f01.verify_email($1) AS ok`, [sha(message.code)])).rows[0].ok).toBe(false); // un solo uso
    expect((await database.query(`SELECT accion FROM f01.auditoria_identidad WHERE actor_usuario_id=$1`, [ids.sofia])).rows.map(r => r.accion)).toContain('EMAIL_VERIFY');
  });

  it('una función de restablecimiento rechaza un token vencido y no cambia nada', async () => {
    const token = randomBytes(32).toString('base64url');
    await database.query(`INSERT INTO f01.token_cuenta(usuario_id,proposito,token_hash,creado_at,expira_at) VALUES($1,'RESTABLECER_CLAVE',$2,now()-interval '2 hours',now()-interval '1 hour')`, [ids.sofia, sha(token)]);
    const before = (await database.query('SELECT password_hash FROM f01.usuario WHERE id=$1', [ids.sofia])).rows[0].password_hash;
    expect((await database.query(`SELECT f01.complete_password_reset($1,$2) AS ok`, [sha(token), hash])).rows[0].ok).toBe(false);
    expect((await database.query('SELECT password_hash FROM f01.usuario WHERE id=$1', [ids.sofia])).rows[0].password_hash).toBe(before);
  });

  let workerId = ''; let firstKey = '';

  it('reemisión para un trabajador sin correo: nueva clave temporal, sesiones cerradas, clave anterior inservible', async () => {
    const ownerA = await login('dueno-alfa@example.test');
    const created = await send(ownerA, `/pharmacies/${pharmacyA}/staff`, { alias: 'alfa.caja1', displayName: 'Caja uno' });
    expect(created.status).toBe(201);
    workerId = created.body.userId; firstKey = created.body.temporaryPassword;
    const worker = await login('alfa.caja1', firstKey);
    await send(worker, '/auth/password/change-temporary', { newPassword: 'clave-definitiva-123' }).then(r => expect(r.status).toBe(204));
    await worker.get('/api/v1/auth/session').expect(200);
    const reissued = await send(ownerA, `/pharmacies/${pharmacyA}/staff/${workerId}/temporary-key`);
    expect(reissued.status).toBe(201);
    expect(reissued.body.temporaryPassword).toMatch(/^[0-9A-HJKMNP-TV-Z]{8}(-[0-9A-HJKMNP-TV-Z]{8}){3}$/);
    expect(reissued.body.temporaryPassword).not.toBe(firstKey);
    await worker.get('/api/v1/auth/session').expect(401);
    const again = await login('alfa.caja1', reissued.body.temporaryPassword);
    expect((await again.get('/api/v1/auth/session').expect(200)).body.restriction).toBe('CAMBIO_CLAVE');
    const stored = await database.query('SELECT motivo,consumida_at FROM f01.credencial_temporal WHERE usuario_id=$1', [workerId]);
    expect(stored.rows[0].motivo).toBe('RECUPERACION');
    const audit = await database.query(`SELECT accion FROM f01.auditoria_identidad WHERE objetivo_usuario_id=$1 AND farmacia_id=$2`, [workerId, pharmacyA]);
    expect(audit.rows.map(row => row.accion)).toContain('TEMP_KEY_ISSUE');
  });

  it('la reemisión no alcanza a otras farmacias, a trabajadores, ni a cuentas con correo', async () => {
    const ownerA = await login('dueno-alfa@example.test'); const ownerB = await login('dueno-beta@example.test');
    expect((await send(ownerB, `/pharmacies/${pharmacyA}/staff/${workerId}/temporary-key`)).status).toBe(404);
    expect((await send(ownerB, `/pharmacies/${pharmacyB}/staff/${workerId}/temporary-key`)).status).toBe(404);
    expect((await send(ownerA, `/pharmacies/${pharmacyA}/staff/${ids.rita}/temporary-key`)).status).toBe(404); // cuenta con correo
    expect((await send(ownerA, `/pharmacies/${pharmacyA}/staff/${ids.ownerA}/temporary-key`)).status).toBe(403); // uno mismo (no se puede actuar sobre la propia cuenta)
    const worker2 = await send(ownerA, `/pharmacies/${pharmacyA}/staff`, { alias: 'alfa.caja2', displayName: 'Caja dos' });
    const worker3 = await send(ownerA, `/pharmacies/${pharmacyA}/staff`, { alias: 'alfa.caja3', displayName: 'Caja tres' });
    const sesionTrabajador = await login('alfa.caja3', worker3.body.temporaryPassword);
    await send(sesionTrabajador, '/auth/password/change-temporary', { newPassword: 'clave-definitiva-456' }).then(r => expect(r.status).toBe(204));
    // Un trabajador (sin permiso de gestión) no puede reemitir claves de nadie.
    expect((await send(sesionTrabajador, `/pharmacies/${pharmacyA}/staff/${worker2.body.userId}/temporary-key`)).status).toBe(403);
    expect((await send(ownerA, `/pharmacies/${pharmacyA}/staff/${worker2.body.userId}/temporary-key`)).status).toBe(201);
  });
});
