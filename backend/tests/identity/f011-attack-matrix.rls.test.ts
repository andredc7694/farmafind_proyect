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
const password = 'clave-ficticia-segura-123';
type Agent = ReturnType<typeof request.agent>;

/** Matriz de pruebas negativas de contracts/security.md con Alfa/Beta, conexiones reutilizadas y roles directos. */
group('F01.1 matriz de ataques Alfa/Beta (HTTP + PostgreSQL + RLS)', () => {
  let admin: Client; let database: Client; let composed: Awaited<ReturnType<typeof createLocalIdentityApp>>;
  let server: ReturnType<typeof composed.app.listen>; let tenantUrl = '';
  let databaseName = ''; let authRole = ''; let tenantRole = '';
  let pharmacyA = ''; let pharmacyB = '';
  const ids: Record<string, string> = {}; const memberships: Record<string, string> = {};

  beforeAll(async () => {
    const base = new URL(baseUrl!);
    if (!/^\/farmafind_f01_test_[a-f0-9]{12}$/.test(base.pathname)) throw new Error('F01.1: solo fixture TEST marcado');
    admin = new Client({ connectionString: baseUrl }); await admin.connect();
    const suffix = randomBytes(6).toString('hex');
    databaseName = `farmafind_f01_test_${suffix}`; authRole = `f011_a8_${suffix}`; tenantRole = `f011_t8_${suffix}`;
    await admin.query(`CREATE DATABASE "${databaseName}"`);
    base.pathname = `/${databaseName}`;
    database = new Client({ connectionString: base.toString() }); await database.connect();
    await migrateTestDatabase(base.toString(), async url => { const c = new Client({ connectionString: url }); await c.connect(); return c; });
    const authPassword = randomBytes(32).toString('hex'); const tenantPassword = randomBytes(32).toString('hex');
    await admin.query(`CREATE ROLE "${authRole}" LOGIN NOSUPERUSER NOBYPASSRLS PASSWORD '${authPassword}'`);
    await admin.query(`CREATE ROLE "${tenantRole}" LOGIN NOSUPERUSER NOBYPASSRLS PASSWORD '${tenantPassword}'`);
    await admin.query(`GRANT f01_auth TO "${authRole}"`); await admin.query(`GRANT f01_runtime TO "${tenantRole}"`);
    const auth = new URL(base); auth.username = authRole; auth.password = authPassword;
    const tenant = new URL(base); tenant.username = tenantRole; tenant.password = tenantPassword; tenantUrl = tenant.toString();
    const hash = await new Argon2PasswordHasher().hash(password);
    pharmacyA = randomUUID(); pharmacyB = randomUUID();
    await database.query('INSERT INTO f01.farmacia_referencia(id,nombre_publico) VALUES($1,$2),($3,$4)', [pharmacyA, 'Farmacia ficticia Alfa', pharmacyB, 'Farmacia ficticia Beta']);
    for (const [label, email] of [['ownerA', 'dueno-alfa@example.test'], ['ownerB', 'dueno-beta@example.test'], ['customer', 'cliente@example.test'],
      ['rita', 'rita@example.test'], ['adminNoMfa', 'admin@example.test']] as const) {
      ids[label] = randomUUID();
      await database.query('INSERT INTO f01.usuario(id,email_canonico,password_hash) VALUES($1,$2,$3)', [ids[label], email, hash]);
    }
    for (const [label, alias] of [['workerA', 'alfa.caja1'], ['workerA2', 'alfa.caja2'], ['workerB', 'beta.caja1']] as const) {
      ids[label] = randomUUID();
      await database.query('INSERT INTO f01.usuario(id,alias_canonico,password_hash) VALUES($1,$2,$3)', [ids[label], alias, hash]);
    }
    for (const [label, user, pharmacy, role] of [['ownerA', ids.ownerA, pharmacyA, 'DUENO'], ['ownerB', ids.ownerB, pharmacyB, 'DUENO'],
      ['workerA', ids.workerA, pharmacyA, 'TRABAJADOR'], ['workerA2', ids.workerA2, pharmacyA, 'TRABAJADOR'], ['workerB', ids.workerB, pharmacyB, 'TRABAJADOR']] as const) {
      memberships[label] = (await database.query(`INSERT INTO f01.usuario_farmacia(usuario_id,farmacia_id,rol) VALUES($1,$2,$3) RETURNING id`, [user, pharmacy, role])).rows[0].id;
      if (role === 'DUENO') await database.query(`INSERT INTO f01.delegacion(membresia_id,farmacia_id,capacidad,granted_by_usuario_id) VALUES($1,$2,'membership.manage',$3)`, [memberships[label], pharmacy, user]);
    }
    const approval = randomUUID();
    await database.query(`INSERT INTO f01.privileged_approval(id,operation,target_usuario_id,role_code,reason,expires_at,integrity_hash)
      VALUES($1,'INITIAL_PLATFORM_ADMIN',$2,'ADMINISTRADOR_PLATAFORMA','Fixture sintético TEST',now()+interval '1 hour',$3)`, [approval, ids.adminNoMfa, 'a'.repeat(64)]);
    await database.query(`INSERT INTO f01.platform_role_assignment(usuario_id,role_code,approval_id) VALUES($1,'ADMINISTRADOR_PLATAFORMA',$2)`, [ids.adminNoMfa, approval]);
    composed = await createLocalIdentityApp({ authDatabaseUrl: auth.toString(), tenantDatabaseUrl: tenantUrl,
      csrfKey: Buffer.alloc(32, 101), abuseKey: Buffer.alloc(32, 102), allowedOrigin: origin, cookieSecure: false, mfaKey: randomBytes(32) },
    url => new Pool({ connectionString: url, max: 1 })); // una sola conexión por pool: el contexto no debe filtrarse entre peticiones
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
  async function login(identifier: string, secret = password, expected = 200): Promise<Agent> {
    const agent = request.agent(server);
    const token = await csrf(agent);
    await agent.post('/api/v1/auth/login').set('Origin', origin).set('X-CSRF-Token', token).send({ identifier, password: secret }).expect(expected);
    return agent;
  }
  async function call(agent: Agent, method: 'get' | 'post' | 'put' | 'patch' | 'delete', path: string, body?: unknown) {
    const token = await csrf(agent);
    const pending = agent[method](`/api/v1${path}`).set('Origin', origin).set('X-CSRF-Token', token);
    return body === undefined ? pending : pending.send(body as object);
  }
  const count = async (sql: string, params: unknown[] = []) => (await database.query(sql, params)).rows[0].n as number;
  const snapshot = async () => ({
    usuarios: await count('SELECT count(*)::int AS n FROM f01.usuario'), membresias: await count('SELECT count(*)::int AS n FROM f01.usuario_farmacia'),
    delegaciones: await count('SELECT count(*)::int AS n FROM f01.delegacion'), credenciales: await count('SELECT count(*)::int AS n FROM f01.credencial_temporal'),
    invitaciones: await count('SELECT count(*)::int AS n FROM f01.invitacion_personal'), plataforma: await count('SELECT count(*)::int AS n FROM f01.platform_role_assignment') });

  it('trabajador Alfa: crear personal, invitar, emitir clave y concederse capacidades → 403 con auditoría ELEVATION_DENIED', async () => {
    const worker = await login('alfa.caja1');
    const before = await snapshot();
    const attempts: Array<[string, string, unknown]> = [
      ['post', `/pharmacies/${pharmacyA}/staff`, { alias: 'intruso.uno', displayName: 'Intruso' }],
      ['post', `/pharmacies/${pharmacyA}/staff/invitations`, { email: 'rita@example.test' }],
      ['post', `/pharmacies/${pharmacyA}/staff/${ids.workerA2}/temporary-key`, undefined],
      ['put', `/pharmacies/${pharmacyA}/staff/${memberships.workerA}/capabilities`, { capabilities: ['inventory.write'] }],
      ['get', `/pharmacies/${pharmacyA}/staff`, undefined]];
    for (const [method, path, body] of attempts) expect((await call(worker, method as 'get', path, body)).status, path).toBe(403);
    expect(await snapshot()).toEqual(before);
    const audit = await database.query(`SELECT actor_usuario_id,farmacia_id,resultado FROM f01.auditoria_identidad WHERE accion='ELEVATION_DENIED' AND actor_usuario_id=$1`, [ids.workerA]);
    expect(audit.rows).toHaveLength(attempts.length);
    expect(audit.rows.every(row => row.farmacia_id === pharmacyA && row.resultado === 'DENEGADO')).toBe(true);
  });

  it('propietario Alfa sobre Beta: cada ruta responde 404 sin revelar y no cambia nada; no deja auditoría de Beta', async () => {
    const owner = await login('dueno-alfa@example.test');
    const before = await snapshot();
    const attempts: Array<[string, string, unknown]> = [
      ['get', `/pharmacies/${pharmacyB}/staff`, undefined], ['post', `/pharmacies/${pharmacyB}/staff`, { alias: 'cruzado.uno', displayName: 'Cruzado' }],
      ['post', `/pharmacies/${pharmacyB}/staff/invitations`, { email: 'rita@example.test' }], ['get', `/pharmacies/${pharmacyB}/staff/invitations`, undefined],
      ['post', `/pharmacies/${pharmacyB}/staff/${ids.workerB}/temporary-key`, undefined],
      ['put', `/pharmacies/${pharmacyB}/staff/${memberships.workerB}/capabilities`, { capabilities: ['inventory.write'] }],
      ['patch', `/pharmacies/${pharmacyB}/memberships/${memberships.workerB}`, { status: 'REVOCADA' }],
      // Un trabajador de Beta nombrado dentro de Alfa tampoco es alcanzable.
      ['post', `/pharmacies/${pharmacyA}/staff/${ids.workerB}/temporary-key`, undefined],
      ['put', `/pharmacies/${pharmacyA}/staff/${memberships.workerB}/capabilities`, { capabilities: ['inventory.write'] }]];
    const statuses: number[] = [];
    for (const [method, path, body] of attempts) statuses.push((await call(owner, method as 'get', path, body)).status);
    expect(statuses.slice(0, 7)).toEqual(Array(7).fill(404));
    expect(statuses.slice(7).every(status => status === 404)).toBe(true);
    expect(await snapshot()).toEqual(before);
    expect(await count(`SELECT count(*)::int AS n FROM f01.auditoria_identidad WHERE farmacia_id=$1 AND actor_usuario_id=$2`, [pharmacyB, ids.ownerA])).toBe(0);
    expect(await count(`SELECT count(*)::int AS n FROM f01.sesion WHERE usuario_id=$1 AND estado='VIGENTE'`, [ids.workerB])).toBe(0); // nadie cerró sesiones ajenas
  });

  it('propietario: no puede crear ni ascender administradores o propietarios (sin ruta o 400/403)', async () => {
    const owner = await login('dueno-alfa@example.test');
    const before = await snapshot();
    for (const body of [{ alias: 'jefe.falso', displayName: 'Jefe', role: 'DUENO' }, { alias: 'jefe.falso', displayName: 'Jefe', capabilities: ['membership.manage'] },
      { alias: 'jefe.falso', displayName: 'Jefe', capabilities: ['platform.admin'] }, { alias: 'jefe.falso', displayName: 'Jefe', roles: ['ADMINISTRADOR_PLATAFORMA'] }]) {
      expect((await call(owner, 'post', `/pharmacies/${pharmacyA}/staff`, body)).status).toBe(400);
    }
    expect((await call(owner, 'put', `/pharmacies/${pharmacyA}/staff/${memberships.workerA}/capabilities`, { capabilities: ['membership.manage'] })).status).toBe(400);
    expect((await call(owner, 'post', `/pharmacies/${pharmacyA}/memberships`, { userId: ids.rita, role: 'DUENO' })).status).toBe(410);
    expect((await call(owner, 'post', '/platform/role-assignments', { userId: ids.rita, role: 'ADMINISTRADOR_PLATAFORMA', approvalId: randomUUID() })).status).toBe(403);
    for (const route of ['/me/roles', '/platform/role-assignments/self', '/me/platform-role']) expect([403, 404]).toContain((await call(owner, 'post', route, {})).status);
    expect(await snapshot()).toEqual(before);
  });

  it('cliente: aceptar o rechazar una invitación ajena → 404 y la invitación queda intacta', async () => {
    const owner = await login('dueno-alfa@example.test');
    expect((await call(owner, 'post', `/pharmacies/${pharmacyA}/staff/invitations`, { email: 'rita@example.test' })).status).toBe(202);
    const invitation = (await owner.get(`/api/v1/pharmacies/${pharmacyA}/staff/invitations`).expect(200)).body[0].id as string;
    const customer = await login('cliente@example.test');
    expect((await call(customer, 'post', `/me/invitations/${invitation}/accept`)).status).toBe(404);
    expect((await call(customer, 'post', `/me/invitations/${invitation}/decline`)).status).toBe(404);
    expect((await call(customer, 'post', `/me/invitations/${randomUUID()}/accept`)).status).toBe(404);
    expect(await count(`SELECT count(*)::int AS n FROM f01.invitacion_personal WHERE id=$1 AND estado='PENDIENTE'`, [invitation])).toBe(1);
    expect(await count(`SELECT count(*)::int AS n FROM f01.usuario_farmacia WHERE usuario_id=$1`, [ids.customer])).toBe(0);
    // El destinatario real (y solo él) puede aceptarla.
    const rita = await login('rita@example.test');
    expect((await call(rita, 'post', `/me/invitations/${invitation}/accept`)).status).toBe(204);
    expect(await count(`SELECT count(*)::int AS n FROM f01.usuario_farmacia WHERE usuario_id=$1 AND farmacia_id=$2`, [ids.rita, pharmacyA])).toBe(1);
  });

  it('anónimo: clave temporal consumida, vencida, alias inexistente y clave errónea son indistinguibles', async () => {
    const owner = await login('dueno-alfa@example.test');
    const created = await call(owner, 'post', `/pharmacies/${pharmacyA}/staff`, { alias: 'alfa.nuevo1', displayName: 'Nuevo uno' });
    expect(created.status).toBe(201);
    const consumed = await login('alfa.nuevo1', created.body.temporaryPassword); // primer uso permitido
    expect((await consumed.get('/api/v1/auth/session')).body.restriction).toBe('CAMBIO_CLAVE');
    const second = await call(owner, 'post', `/pharmacies/${pharmacyA}/staff`, { alias: 'alfa.nuevo2', displayName: 'Nuevo dos' });
    await database.query(`UPDATE f01.credencial_temporal SET emitida_at = now() - interval '48 hours', expira_at = now() - interval '24 hours' WHERE usuario_id=(SELECT id FROM f01.usuario WHERE alias_canonico='alfa.nuevo2')`);
    const probe = async (identifier: string, secret: string) => {
      const agent = request.agent(server); const token = await csrf(agent);
      const response = await agent.post('/api/v1/auth/login').set('Origin', origin).set('X-CSRF-Token', token).send({ identifier, password: secret });
      return { status: response.status, body: JSON.stringify({ ...response.body, correlationId: undefined }), cookie: response.headers['set-cookie'] };
    };
    const results = [await probe('alfa.nuevo1', created.body.temporaryPassword), await probe('alfa.nuevo2', second.body.temporaryPassword),
      await probe('no.existe.alias', 'ABCDEFGH-JKMNPQRS-TVWXYZ01-23456789'), await probe('alfa.caja1', 'clave-incorrecta-123')];
    expect(new Set(results.map(item => item.status))).toEqual(new Set([401]));
    expect(new Set(results.map(item => item.body)).size).toBe(1);
    expect(results.every(item => item.cookie === undefined)).toBe(true);
  });

  it('anónimo: sondear correos por invitación y por restablecimiento da respuestas indistinguibles', async () => {
    const owner = await login('dueno-beta@example.test');
    const known = await call(owner, 'post', `/pharmacies/${pharmacyB}/staff/invitations`, { email: 'cliente@example.test' });
    const unknown = await call(owner, 'post', `/pharmacies/${pharmacyB}/staff/invitations`, { email: 'nadie.existe@example.test' });
    expect([known.status, known.text]).toEqual([unknown.status, unknown.text]);
    const anonymous = request.agent(server);
    const a = await call(anonymous, 'post', '/auth/password/reset/request', { email: 'cliente@example.test' });
    const b = await call(anonymous, 'post', '/auth/password/reset/request', { email: 'nadie.existe@example.test' });
    expect([a.status, a.text]).toEqual([b.status, b.text]);
  });

  it('sesión restringida y administrador sin segundo factor: todo lo demás devuelve 403', async () => {
    await database.query(`UPDATE f01.usuario SET alias_canonico=alias_canonico WHERE id=$1`, [ids.workerA2]);
    const agent = await login('alfa.caja2');
    await database.query(`UPDATE f01.sesion SET restringida_motivo='CAMBIO_CLAVE' WHERE usuario_id=$1`, [ids.workerA2]);
    for (const [method, path] of [['get', '/me/memberships'], ['get', '/me/profile'], ['get', '/me/sessions'], ['get', `/pharmacies/${pharmacyA}/staff`],
      ['get', '/me/invitations'], ['post', '/me/mfa/enroll'], ['get', '/platform/role-assignments']] as const) {
      expect((await call(agent, method, path)).status, path).toBe(403);
    }
    const noMfa = await login('admin@example.test');
    expect((await call(noMfa, 'get', '/platform/role-assignments')).status).toBe(403);
    expect((await call(noMfa, 'post', '/platform/role-assignments', { userId: ids.rita, role: 'ADMINISTRADOR_PLATAFORMA', approvalId: randomUUID() })).status).toBe(403);
  });

  it('roles directos: el rol de aplicación no puede ejecutar funciones privilegiadas sin contexto ni tocar tablas de identidad', async () => {
    const direct = new Client({ connectionString: tenantUrl }); await direct.connect();
    try {
      const rejected = async (sql: string, code: string) => { await direct.query('BEGIN'); try { await direct.query(sql); throw new Error('debió rechazarse'); } catch (error) { expect((error as { code?: string }).code, sql).toBe(code); } finally { await direct.query('ROLLBACK'); } };
      // Sin contexto de actor, las funciones de personal rechazan (42501).
      await rejected(`SELECT * FROM f01.create_staff_account('${pharmacyA}','sin.contexto','Sin contexto','$argon2id$x','$argon2id$y',ARRAY[]::text[])`, '42501');
      await rejected(`SELECT f01.issue_temporary_key('${pharmacyA}','${ids.workerA}','$argon2id$x')`, '42501');
      // Tablas sin permiso directo para el rol de aplicación.
      for (const table of ['credencial_temporal', 'token_cuenta', 'mfa_totp']) await rejected(`SELECT * FROM f01.${table}`, '42501');
      // La tabla de invitaciones es legible solo bajo RLS: sin contexto de actor no devuelve filas (aunque existe una).
      expect(await count('SELECT count(*)::int AS n FROM f01.invitacion_personal')).toBeGreaterThan(0);
      expect((await direct.query('SELECT * FROM f01.invitacion_personal')).rows).toEqual([]);
      await rejected(`INSERT INTO f01.platform_role_assignment(usuario_id,role_code,approval_id) VALUES ('${ids.rita}','ADMINISTRADOR_PLATAFORMA','${randomUUID()}')`, '42501');
      await rejected(`SELECT f01.complete_mfa('VERIFY', 1)`, '42501');
      await rejected(`SELECT f01.begin_mfa_enrollment('\\x00'::bytea,'\\x000000000000000000000000'::bytea)`, '42501');
      // Actor sin gestión en la farmacia: la función definer lo rechaza aunque el contexto exista.
      await direct.query('BEGIN');
      await direct.query(`SELECT set_config('app.actor_user_id',$1,true), set_config('app.farmacia_id',$2,true)`, [ids.workerA, pharmacyA]);
      await expect(direct.query(`SELECT * FROM f01.create_staff_account('${pharmacyA}','por.sql.directo','Directo','$argon2id$x','$argon2id$y',ARRAY[]::text[])`)).rejects.toMatchObject({ code: '42501' });
      await direct.query('ROLLBACK');
      // Conexión reutilizada: el contexto era local a la transacción y no queda nada para la siguiente.
      const leftover = await direct.query(`SELECT current_setting('app.actor_user_id', true) AS actor, current_setting('app.farmacia_id', true) AS pharmacy`);
      expect([null, '']).toContain(leftover.rows[0].actor); expect([null, '']).toContain(leftover.rows[0].pharmacy);
      expect(await count(`SELECT count(*)::int AS n FROM f01.usuario WHERE alias_canonico IN ('sin.contexto','por.sql.directo')`)).toBe(0);
    } finally { await direct.end(); }
  });

  it('conexión única reutilizada entre Alfa y Beta: ninguna petición hereda el contexto de la anterior', async () => {
    const ownerA = await login('dueno-alfa@example.test'); const ownerB = await login('dueno-beta@example.test');
    for (let round = 0; round < 3; round++) {
      const a = await ownerA.get(`/api/v1/pharmacies/${pharmacyA}/staff`); const b = await ownerB.get(`/api/v1/pharmacies/${pharmacyB}/staff`);
      expect(a.status).toBe(200); expect(b.status).toBe(200);
      expect((a.body as Array<{ userId: string }>).map(item => item.userId)).not.toContain(ids.workerB);
      expect((b.body as Array<{ userId: string }>).map(item => item.userId)).not.toContain(ids.workerA);
      expect((await ownerA.get(`/api/v1/pharmacies/${pharmacyB}/staff`)).status).toBe(404);
      expect((await ownerB.get(`/api/v1/pharmacies/${pharmacyA}/staff`)).status).toBe(404);
    }
  });
});
