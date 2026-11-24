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

group('F01.1 US2: invitaciones, permisos y revocación inmediata (HTTP + PostgreSQL)', () => {
  let admin: Client; let database: Client; let composed: Awaited<ReturnType<typeof createLocalIdentityApp>>;
  let server: ReturnType<typeof composed.app.listen>;
  let databaseName = ''; let authRole = ''; let tenantRole = '';
  let pharmacyA: string; let pharmacyB: string; let hash: string;
  const ids: Record<string, string> = {};

  async function createUser(label: string, email: string) {
    ids[label] = randomUUID();
    await database.query('INSERT INTO f01.usuario(id,email_canonico,password_hash) VALUES($1,$2,$3)', [ids[label], email, hash]);
  }
  async function makeOwner(label: string, email: string, pharmacy: string) {
    await createUser(label, email);
    const membership = (await database.query(`INSERT INTO f01.usuario_farmacia(usuario_id,farmacia_id,rol) VALUES($1,$2,'DUENO') RETURNING id`, [ids[label], pharmacy])).rows[0];
    await database.query(`INSERT INTO f01.delegacion(membresia_id,farmacia_id,capacidad,granted_by_usuario_id) VALUES($1,$2,'membership.manage',$3)`, [membership.id, pharmacy, ids[label]]);
  }

  beforeAll(async () => {
    const base = new URL(baseUrl!);
    if (!/^\/farmafind_f01_test_[a-f0-9]{12}$/.test(base.pathname)) throw new Error('F01.1: solo fixture TEST marcado');
    admin = new Client({ connectionString: baseUrl }); await admin.connect();
    const suffix = randomBytes(6).toString('hex');
    databaseName = `farmafind_f01_test_${suffix}`; authRole = `f011_a2_${suffix}`; tenantRole = `f011_t2_${suffix}`;
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
    await makeOwner('ownerA', 'dueno-alfa@example.test', pharmacyA);
    await makeOwner('ownerB', 'dueno-beta@example.test', pharmacyB);
    for (const [label, email] of [['ana', 'ana@example.test'], ['beto', 'beto@example.test'], ['carla', 'carla@example.test'], ['otro', 'otro@example.test']]) await createUser(label, email);
    composed = await createLocalIdentityApp({ authDatabaseUrl: auth.toString(), tenantDatabaseUrl: tenant.toString(),
      csrfKey: Buffer.alloc(32, 51), abuseKey: Buffer.alloc(32, 52), allowedOrigin: origin, cookieSecure: false },
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
  });

  const csrf = async (agent: Agent) => (await agent.get('/api/v1/auth/csrf').expect(200)).body.csrfToken as string;
  async function login(email: string): Promise<Agent> {
    const agent = request.agent(server);
    const token = await csrf(agent);
    await agent.post('/api/v1/auth/login').set('Origin', origin).set('X-CSRF-Token', token).send({ email, password }).expect(200);
    return agent;
  }
  async function send(agent: Agent, method: 'post' | 'put' | 'delete' | 'patch', path: string, body?: unknown) {
    const token = await csrf(agent);
    const call = agent[method](`/api/v1${path}`).set('Origin', origin).set('X-CSRF-Token', token);
    return body === undefined ? call : call.send(body as object);
  }
  const countInvitations = async (where: string, values: unknown[]) =>
    (await database.query(`SELECT count(*)::int AS n FROM f01.invitacion_personal WHERE ${where}`, values)).rows[0].n as number;

  let ownerA: Agent; let ownerB: Agent; let ana: Agent; let invitationAna = '';

  it('invitar es silencioso: la respuesta es idéntica exista o no la cuenta y no crea invitaciones indebidas', async () => {
    ownerA = await login('dueno-alfa@example.test'); ownerB = await login('dueno-beta@example.test'); ana = await login('ana@example.test');
    const existing = await send(ownerA, 'post', `/pharmacies/${pharmacyA}/staff/invitations`, { email: 'ana@example.test' });
    const missing = await send(ownerA, 'post', `/pharmacies/${pharmacyA}/staff/invitations`, { email: 'no-existe@example.test' });
    expect(existing.status).toBe(202); expect(missing.status).toBe(202);
    expect(existing.text).toBe(missing.text);
    expect(Object.keys(existing.headers).filter(key => key.startsWith('x-')).sort()).toEqual(Object.keys(missing.headers).filter(key => key.startsWith('x-')).sort());
    expect(await countInvitations('usuario_destino_id=$1', [ids.ana])).toBe(1);
    await send(ownerA, 'post', `/pharmacies/${pharmacyA}/staff/invitations`, { email: 'ana@example.test' }).then(r => expect(r.status).toBe(202));
    expect(await countInvitations('usuario_destino_id=$1', [ids.ana])).toBe(1); // sin duplicados
    await send(ownerA, 'post', `/pharmacies/${pharmacyA}/staff/invitations`, { email: 'dueno-alfa@example.test' }).then(r => expect(r.status).toBe(202));
    expect(await countInvitations('usuario_destino_id=$1', [ids.ownerA])).toBe(0); // no se autoinvita
    await send(ownerA, 'post', `/pharmacies/${pharmacyA}/staff/invitations`, { email: 'correo-invalido' }).then(r => expect(r.status).toBe(400));
    await send(ownerA, 'post', `/pharmacies/${pharmacyA}/staff/invitations`, { email: 'x@example.test', rol: 'DUENO' }).then(r => expect(r.status).toBe(400));
  });

  it('el propietario ve la invitación con el destino enmascarado; Beta no ve ni opera sobre Alfa', async () => {
    const list = await ownerA.get(`/api/v1/pharmacies/${pharmacyA}/staff/invitations`).expect(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0]).toMatchObject({ destination: 'a***@example.test', state: 'PENDIENTE' });
    expect(JSON.stringify(list.body)).not.toContain('ana@example.test');
    invitationAna = list.body[0].id;
    await ownerB.get(`/api/v1/pharmacies/${pharmacyA}/staff/invitations`).expect(404);
    (await send(ownerB, 'post', `/pharmacies/${pharmacyA}/staff/invitations`, { email: 'beto@example.test' })).status === 404 || (() => { throw new Error('Beta pudo invitar en Alfa'); })();
    expect((await send(ownerB, 'delete', `/pharmacies/${pharmacyA}/staff/invitations/${invitationAna}`)).status).toBe(404);
    expect(await countInvitations('usuario_destino_id=$1', [ids.beto])).toBe(0);
  });

  it('solo la persona invitada ve y responde su invitación', async () => {
    const mine = await ana.get('/api/v1/me/invitations').expect(200);
    expect(mine.body).toHaveLength(1);
    expect(mine.body[0]).toMatchObject({ id: invitationAna, pharmacyName: 'Farmacia ficticia Alfa', state: 'PENDIENTE' });
    const other = await login('otro@example.test');
    expect((await other.get('/api/v1/me/invitations').expect(200)).body).toEqual([]);
    expect((await send(other, 'post', `/me/invitations/${invitationAna}/accept`)).status).toBe(404);
    expect((await send(other, 'post', `/me/invitations/${invitationAna}/decline`)).status).toBe(404);
    expect((await send(ownerA, 'post', `/me/invitations/${invitationAna}/accept`)).status).toBe(404);
    expect((await database.query('SELECT estado FROM f01.invitacion_personal WHERE id=$1', [invitationAna])).rows[0].estado).toBe('PENDIENTE');
  });

  it('dos aceptaciones simultáneas: exactamente una prospera y no hay membresía duplicada', async () => {
    const ana2 = await login('ana@example.test');
    const results = await Promise.all([send(ana, 'post', `/me/invitations/${invitationAna}/accept`), send(ana2, 'post', `/me/invitations/${invitationAna}/accept`)]);
    expect(results.map(r => r.status).sort()).toEqual([204, 409]);
    const memberships = await database.query(`SELECT rol,estado FROM f01.usuario_farmacia WHERE usuario_id=$1 AND farmacia_id=$2`, [ids.ana, pharmacyA]);
    expect(memberships.rows).toEqual([{ rol: 'TRABAJADOR', estado: 'ACTIVA' }]);
    expect((await database.query(`SELECT count(*)::int AS n FROM f01.delegacion d JOIN f01.usuario_farmacia m ON m.id=d.membresia_id WHERE m.usuario_id=$1`, [ids.ana])).rows[0].n).toBe(0);
    const own = await ana.get('/api/v1/me/memberships').expect(200);
    expect(own.body.map((row: { pharmacyId: string }) => row.pharmacyId)).toEqual([pharmacyA]);
  });

  let anaMembership = '';

  it('el propietario concede y revoca permisos; no puede delegar la gestión de personal ni actuar sobre sí mismo o sobre Beta', async () => {
    const staff = await ownerA.get(`/api/v1/pharmacies/${pharmacyA}/staff`).expect(200);
    anaMembership = staff.body.find((row: { userId: string }) => row.userId === ids.ana).membershipId;
    const path = `/pharmacies/${pharmacyA}/staff/${anaMembership}/capabilities`;
    expect((await send(ownerA, 'put', path, { capabilities: ['inventory.read', 'reservation.read'] })).status).toBe(204);
    const after = await ownerA.get(`/api/v1/pharmacies/${pharmacyA}/staff`).expect(200);
    expect(after.body.find((row: { userId: string }) => row.userId === ids.ana).capabilities).toEqual(['inventory.read', 'reservation.read']);
    expect((await send(ownerA, 'put', path, { capabilities: ['membership.manage'] })).status).toBe(400);
    expect((await send(ownerA, 'put', path, { capabilities: ['otra.cosa'] })).status).toBe(400);
    expect((await send(ownerA, 'put', path, { capabilities: 'inventory.read' })).status).toBe(400);
    expect((await send(ownerA, 'put', path, { capabilities: [], extra: 1 })).status).toBe(400);
    expect((await send(ownerB, 'put', path, { capabilities: ['inventory.read'] })).status).toBe(404);
    expect((await send(ana, 'put', path, { capabilities: ['inventory.write'] })).status).toBe(403);
    const ownerMembership = (await database.query(`SELECT id FROM f01.usuario_farmacia WHERE usuario_id=$1`, [ids.ownerA])).rows[0].id;
    expect((await send(ownerA, 'put', `/pharmacies/${pharmacyA}/staff/${ownerMembership}/capabilities`, { capabilities: ['inventory.read'] })).status).toBe(404);
    // Reemplazo: quita reservation.read, añade inventory.write; lo revocado queda auditado y no reaparece.
    expect((await send(ownerA, 'put', path, { capabilities: ['inventory.read', 'inventory.write'] })).status).toBe(204);
    const rows = await database.query(`SELECT capacidad,estado FROM f01.delegacion WHERE membresia_id=$1 ORDER BY capacidad`, [anaMembership]);
    expect(rows.rows).toEqual([{ capacidad: 'inventory.read', estado: 'ACTIVA' }, { capacidad: 'inventory.write', estado: 'ACTIVA' }, { capacidad: 'reservation.read', estado: 'REVOCADA' }]);
    const own = await ana.get('/api/v1/me/memberships').expect(200);
    expect(own.body[0].delegationCodes.sort()).toEqual(['inventory.read', 'inventory.write']);
  });

  it('revocar la membresía rige de inmediato: delegaciones revocadas y sesiones cerradas al quedar sin membresías', async () => {
    const response = await send(ownerA, 'patch', `/pharmacies/${pharmacyA}/memberships/${anaMembership}`, { status: 'REVOCADA' });
    expect(response.status).toBe(200);
    await ana.get('/api/v1/me/memberships').expect(401); // sesión cerrada en la siguiente petición
    await ana.get('/api/v1/auth/session').expect(401);
    const delegations = await database.query(`SELECT count(*)::int AS n FROM f01.delegacion WHERE membresia_id=$1 AND estado='ACTIVA'`, [anaMembership]);
    expect(delegations.rows[0].n).toBe(0);
    const audit = await database.query(`SELECT accion FROM f01.auditoria_identidad WHERE objetivo_usuario_id=$1 AND farmacia_id=$2 ORDER BY accion`, [ids.ana, pharmacyA]);
    const actions = new Set(audit.rows.map(row => row.accion));
    for (const expected of ['INVITE_CREATE', 'INVITE_ACCEPT', 'CAPABILITY_GRANT', 'CAPABILITY_REVOKE', 'MEMBERSHIP_REVOKE', 'SESSION_REVOKE']) expect(actions.has(expected), expected).toBe(true);
  });

  it('una nueva invitación reactiva la misma membresía sin heredar permisos', async () => {
    await send(ownerA, 'post', `/pharmacies/${pharmacyA}/staff/invitations`, { email: 'ana@example.test' }).then(r => expect(r.status).toBe(202));
    const anaAgain = await login('ana@example.test');
    const mine = await anaAgain.get('/api/v1/me/invitations').expect(200);
    expect(mine.body).toHaveLength(1);
    expect((await send(anaAgain, 'post', `/me/invitations/${mine.body[0].id}/accept`)).status).toBe(204);
    const membership = await database.query(`SELECT id,estado FROM f01.usuario_farmacia WHERE usuario_id=$1 AND farmacia_id=$2`, [ids.ana, pharmacyA]);
    expect(membership.rows).toEqual([{ id: anaMembership, estado: 'ACTIVA' }]);
    expect((await database.query(`SELECT count(*)::int AS n FROM f01.delegacion WHERE membresia_id=$1 AND estado='ACTIVA'`, [anaMembership])).rows[0].n).toBe(0);
  });

  it('rechazar, revocar y vencer una invitación impiden aceptarla', async () => {
    const beto = await login('beto@example.test'); const carla = await login('carla@example.test');
    for (const email of ['beto@example.test', 'carla@example.test']) await send(ownerA, 'post', `/pharmacies/${pharmacyA}/staff/invitations`, { email });
    const betoInvitation = (await beto.get('/api/v1/me/invitations').expect(200)).body[0].id;
    expect((await send(beto, 'post', `/me/invitations/${betoInvitation}/decline`)).status).toBe(204);
    expect((await send(beto, 'post', `/me/invitations/${betoInvitation}/accept`)).status).toBe(409);
    expect((await beto.get('/api/v1/me/invitations').expect(200)).body).toEqual([]);
    const carlaInvitation = (await carla.get('/api/v1/me/invitations').expect(200)).body[0].id;
    expect((await send(ownerA, 'delete', `/pharmacies/${pharmacyA}/staff/invitations/${carlaInvitation}`)).status).toBe(204);
    expect((await send(ownerA, 'delete', `/pharmacies/${pharmacyA}/staff/invitations/${carlaInvitation}`)).status).toBe(404);
    expect((await send(carla, 'post', `/me/invitations/${carlaInvitation}/accept`)).status).toBe(409);
    // Vencimiento (7 días): se envejece la invitación directamente en la base de prueba.
    await send(ownerA, 'post', `/pharmacies/${pharmacyA}/staff/invitations`, { email: 'carla@example.test' });
    await database.query(`UPDATE f01.invitacion_personal SET creada_at=now()-interval '8 days',expira_at=now()-interval '1 day' WHERE usuario_destino_id=$1 AND estado='PENDIENTE'`, [ids.carla]);
    expect((await carla.get('/api/v1/me/invitations').expect(200)).body).toEqual([]);
    const staleId = (await database.query(`SELECT id FROM f01.invitacion_personal WHERE usuario_destino_id=$1 AND estado='PENDIENTE'`, [ids.carla])).rows[0].id;
    expect((await send(carla, 'post', `/me/invitations/${staleId}/accept`)).status).toBe(409);
    const listed = await ownerA.get(`/api/v1/pharmacies/${pharmacyA}/staff/invitations`).expect(200);
    expect(listed.body.find((row: { id: string }) => row.id === staleId).state).toBe('VENCIDA');
    expect((await database.query(`SELECT count(*)::int AS n FROM f01.usuario_farmacia WHERE usuario_id IN ($1,$2)`, [ids.beto, ids.carla])).rows[0].n).toBe(0);
  });

  it('un trabajador no puede invitar ni delegar, y la concesión directa heredada responde 410', async () => {
    const anaSession = await login('ana@example.test');
    expect((await send(anaSession, 'post', `/pharmacies/${pharmacyA}/staff/invitations`, { email: 'otro@example.test' })).status).toBe(403);
    expect((await send(ownerA, 'post', `/pharmacies/${pharmacyA}/memberships`, { userId: ids.otro, role: 'TRABAJADOR' })).status).toBe(410);
    expect(await countInvitations('usuario_destino_id=$1', [ids.otro])).toBe(0);
    expect((await database.query(`SELECT count(*)::int AS n FROM f01.usuario_farmacia WHERE usuario_id=$1`, [ids.otro])).rows[0].n).toBe(0);
  });
});
