import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client, Pool } from 'pg';
import { randomBytes, randomUUID } from 'node:crypto';
import request from 'supertest';
import { migrateTestDatabase } from '../../src/modules/usuarios/infrastructure/db/migrate.js';
import { migrateF02TestDatabase } from '../../src/modules/inventario/infrastructure/migrate.js';
import { migrateF04TestDatabase } from '../../src/modules/reservas/infrastructure/migrate.js';
import { createLocalIdentityApp } from '../../src/identity-app.js';
import { loadReservationConfig } from '../../src/config/reservations.js';
import { Argon2PasswordHasher } from '../../src/modules/usuarios/infrastructure/argon2-password.js';

const baseUrl = process.env.F01_TEST_DATABASE_URL;
const group = baseUrl ? describe : describe.skip;
const origin = 'http://127.0.0.1:5173';
const password = 'clave-ficticia-segura-123';
type Agent = ReturnType<typeof request.agent>;

/**
 * F08.1: el menú es solo presentación. Cada ruta privada de la farmacia se prueba DIRECTO contra el servidor con actores
 * sin permiso, de otra farmacia, clientes y anónimos, y se contrasta con un control positivo del propietario.
 */
group('F08.1 matriz de rutas directas (HTTP + PostgreSQL + RLS)', () => {
  let admin: Client; let database: Client; let composed: Awaited<ReturnType<typeof createLocalIdentityApp>>;
  let server: ReturnType<typeof composed.app.listen>; let databaseName = ''; let authRole = ''; let tenantRole = '';
  const ids: Record<string, string> = {}; let pharmacyA = ''; let pharmacyB = ''; let medication = '';

  beforeAll(async () => {
    const base = new URL(baseUrl!);
    if (!/^\/farmafind_f01_test_[a-f0-9]{12}$/.test(base.pathname)) throw new Error('F08.1: solo fixture TEST marcado');
    admin = new Client({ connectionString: baseUrl }); await admin.connect();
    const suffix = randomBytes(6).toString('hex'); databaseName = `farmafind_f01_test_${suffix}`; authRole = `f081_a_${suffix}`; tenantRole = `f081_t_${suffix}`;
    await admin.query(`CREATE DATABASE "${databaseName}"`); base.pathname = `/${databaseName}`;
    database = new Client({ connectionString: base.toString() }); await database.connect();
    const connect = async (url: string) => { const c = new Client({ connectionString: url }); await c.connect(); return c; };
    await migrateTestDatabase(base.toString(), connect); await migrateF02TestDatabase(base.toString(), connect); await migrateF04TestDatabase(base.toString(), connect);
    const authPassword = randomBytes(32).toString('hex'); const tenantPassword = randomBytes(32).toString('hex');
    await admin.query(`CREATE ROLE "${authRole}" LOGIN NOSUPERUSER NOBYPASSRLS PASSWORD '${authPassword}'`);
    await admin.query(`CREATE ROLE "${tenantRole}" LOGIN NOSUPERUSER NOBYPASSRLS PASSWORD '${tenantPassword}'`);
    await admin.query(`GRANT f01_auth TO "${authRole}"`); await admin.query(`GRANT f01_runtime TO "${tenantRole}"`);
    const auth = new URL(base); auth.username = authRole; auth.password = authPassword;
    const tenant = new URL(base); tenant.username = tenantRole; tenant.password = tenantPassword;
    const hash = await new Argon2PasswordHasher().hash(password);
    pharmacyA = randomUUID(); pharmacyB = randomUUID(); medication = randomUUID();
    await database.query('INSERT INTO f01.farmacia_referencia(id,nombre_publico) VALUES($1,$2),($3,$4)', [pharmacyA, 'Farmacia ficticia Alfa', pharmacyB, 'Farmacia ficticia Beta']);
    for (const [label, email] of [['ownerA', 'dueno-alfa@example.test'], ['ownerB', 'dueno-beta@example.test'], ['customer', 'cliente@example.test'], ['worker', 'trabajador@example.test']] as const) {
      ids[label] = randomUUID();
      await database.query('INSERT INTO f01.usuario(id,email_canonico,password_hash) VALUES($1,$2,$3)', [ids[label], email, hash]);
    }
    const all = ['membership.manage', 'reservation.read', 'reservation.accept', 'reservation.deliver', 'reservation.settings', 'inventory.read', 'inventory.write',
      'inventory.import.preview', 'inventory.import.confirm', 'inventory.history'];
    for (const [user, pharmacy, role, capabilities] of [['ownerA', pharmacyA, 'DUENO', all], ['ownerB', pharmacyB, 'DUENO', all], ['worker', pharmacyA, 'TRABAJADOR', []]] as const) {
      const member = (await database.query('INSERT INTO f01.usuario_farmacia(usuario_id,farmacia_id,rol) VALUES($1,$2,$3) RETURNING id', [ids[user], pharmacy, role])).rows[0].id;
      for (const capability of capabilities) await database.query('INSERT INTO f01.delegacion(membresia_id,farmacia_id,capacidad,granted_by_usuario_id) VALUES($1,$2,$3,$4)', [member, pharmacy, capability, ids[user]]);
    }
    await database.query("INSERT INTO f02.medicamento(id,nombre,concentracion,presentacion,clasificacion) VALUES($1,'ficticio','10 mg','tableta','venta libre')", [medication]);
    await database.query('INSERT INTO f02.inventario(farmacia_id,medicamento_id,precio_centavos,cantidad_fisica,ultima_revision_at) VALUES($1,$3,1000,10,now()),($2,$3,1000,10,now())', [pharmacyA, pharmacyB, medication]);
    composed = await createLocalIdentityApp({ authDatabaseUrl: auth.toString(), tenantDatabaseUrl: tenant.toString(), csrfKey: Buffer.alloc(32, 111), abuseKey: Buffer.alloc(32, 112),
      allowedOrigin: origin, cookieSecure: false, reservations: loadReservationConfig({}) }, url => new Pool({ connectionString: url, max: 6 }));
    server = composed.app.listen(0, '127.0.0.1');
  }, 120000);

  afterAll(async () => {
    if (server) await new Promise<void>(resolve => server.close(() => resolve()));
    if (composed) await composed.close(); if (database) await database.end();
    if (admin) {
      if (databaseName) await admin.query(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`);
      for (const role of [authRole, tenantRole]) if (role) await admin.query(`DROP ROLE IF EXISTS "${role}"`);
      await admin.end();
    }
  });

  const csrf = async (agent: Agent) => (await agent.get('/api/v1/auth/csrf').expect(200)).body.csrfToken as string;
  async function login(email: string): Promise<Agent> {
    const agent = request.agent(server); const token = await csrf(agent);
    await agent.post('/api/v1/auth/login').set('Origin', origin).set('X-CSRF-Token', token).send({ email, password }).expect(200);
    return agent;
  }
  async function call(agent: Agent | null, method: 'get' | 'post' | 'put' | 'patch' | 'delete', path: string, body?: unknown) {
    const target = agent ?? request.agent(server); const token = await csrf(target);
    const pending = target[method](`/api/v1${path}`).set('Origin', origin).set('X-CSRF-Token', token).set('Idempotency-Key', `matrix-${randomUUID()}`);
    return body === undefined ? pending : pending.send(body as object);
  }

  /** Rutas privadas de una farmacia (lecturas y mutaciones). `{p}` = farmacia, `{m}` = medicamento, `{r}` = una reserva inexistente. */
  const routes: Array<[string, string, unknown?]> = [
    ['get', '/pharmacies/{p}/memberships'], ['post', '/pharmacies/{p}/memberships', { userId: randomUUID(), role: 'DUENO' }],
    ['get', '/pharmacies/{p}/staff'], ['post', '/pharmacies/{p}/staff', { alias: 'ruta.directa', displayName: 'Directa' }],
    ['get', '/pharmacies/{p}/staff/invitations'], ['post', '/pharmacies/{p}/staff/invitations', { email: 'otro@example.test' }],
    ['get', '/farmacias/{p}/inventario'], ['get', '/farmacias/{p}/inventario/movimientos'], ['get', '/farmacias/{p}/inventario/resumen'],
    ['put', '/farmacias/{p}/inventario/{m}', { precioReferencial: 1, cantidadFisica: 1, motivo: 'ruta directa' }],
    ['get', '/farmacias/{p}/importaciones'], ['get', '/farmacias/{p}/importaciones/perfiles'],
    ['get', '/farmacias/{p}/reservas'], ['get', '/farmacias/{p}/reservas/centro'], ['get', '/farmacias/{p}/reservas/historial'],
    ['get', '/farmacias/{p}/reservas/historial/exportar'], ['get', '/farmacias/{p}/reservas/resumen'], ['get', '/farmacias/{p}/reservas/configuracion'],
    ['put', '/farmacias/{p}/reservas/configuracion', { pickupWindowHours: 8 }],
    ['post', '/farmacias/{p}/reservas/{r}/confirmar'], ['post', '/farmacias/{p}/reservas/{r}/entregar'], ['post', '/farmacias/{p}/reservas/{r}/falta-fisica'],
  ];
  const fill = (path: string, pharmacy: string) => path.replace('{p}', pharmacy).replace('{m}', medication).replace('{r}', randomUUID());
  // 410: la concesión directa de membresía fue retirada en F01.1 (decisión A); no concede nada a nadie.
  const isDenied = (status: number) => [401, 403, 404, 410].includes(status);

  it('control positivo: el propietario de Alfa puede usar las rutas de lectura (el resto de la matriz no es vacía por error)', async () => {
    const owner = await login('dueno-alfa@example.test');
    for (const path of ['/pharmacies/{p}/staff', '/farmacias/{p}/inventario', '/farmacias/{p}/inventario/resumen', '/farmacias/{p}/reservas/centro',
      '/farmacias/{p}/reservas/historial', '/farmacias/{p}/reservas/resumen', '/farmacias/{p}/reservas/configuracion', '/farmacias/{p}/importaciones']) {
      expect((await call(owner, 'get', fill(path, pharmacyA))).status, path).toBe(200);
    }
  });

  it.each([
    ['anónimo', null], ['cliente sin membresías', 'cliente@example.test'], ['trabajador de Alfa sin permisos', 'trabajador@example.test'],
  ])('%s: ninguna ruta privada de Alfa responde con datos', async (_label, email) => {
    const agent = email ? await login(email) : null;
    const before = JSON.stringify([(await database.query('SELECT id,estado FROM f04.reserva ORDER BY id')).rows, (await database.query('SELECT medicamento_id,precio_centavos,cantidad_fisica,version FROM f02.inventario ORDER BY farmacia_id')).rows,
      (await database.query('SELECT count(*)::int n FROM f01.usuario')).rows, (await database.query('SELECT count(*)::int n FROM f01.usuario_farmacia')).rows]);
    for (const [method, path, body] of routes) {
      const response = await call(agent, method as 'get', fill(path, pharmacyA), body);
      expect(isDenied(response.status), `${method} ${path} → ${response.status}`).toBe(true);
      expect(JSON.stringify(response.body)).not.toMatch(/ficticio|1000|ruta\.directa/);
    }
    expect(JSON.stringify([(await database.query('SELECT id,estado FROM f04.reserva ORDER BY id')).rows, (await database.query('SELECT medicamento_id,precio_centavos,cantidad_fisica,version FROM f02.inventario ORDER BY farmacia_id')).rows,
      (await database.query('SELECT count(*)::int n FROM f01.usuario')).rows, (await database.query('SELECT count(*)::int n FROM f01.usuario_farmacia')).rows])).toBe(before);
  }, 120000);

  it('el propietario de Beta no alcanza ninguna ruta de Alfa (ni al revés), con datos intactos', async () => {
    const ownerB = await login('dueno-beta@example.test'); const ownerA = await login('dueno-alfa@example.test');
    for (const [method, path, body] of routes) {
      const cross = await call(ownerB, method as 'get', fill(path, pharmacyA), body);
      expect(isDenied(cross.status), `Beta→Alfa ${method} ${path} → ${cross.status}`).toBe(true);
      const reverse = await call(ownerA, method as 'get', fill(path, pharmacyB), body);
      expect(isDenied(reverse.status), `Alfa→Beta ${method} ${path} → ${reverse.status}`).toBe(true);
    }
    expect((await database.query("SELECT count(*)::int n FROM f01.usuario WHERE alias_canonico='ruta.directa'")).rows[0].n).toBe(0);
    expect((await database.query('SELECT precio_centavos,cantidad_fisica FROM f02.inventario WHERE farmacia_id=$1', [pharmacyB])).rows[0]).toEqual({ precio_centavos: '1000', cantidad_fisica: 10 });
    expect((await database.query('SELECT plazo_recogida_horas FROM f04.configuracion_farmacia')).rows).toEqual([]);
  }, 120000);

  it('una sesión revocada pierde de inmediato el acceso a todas las rutas aunque la pantalla siga abierta', async () => {
    const owner = await login('dueno-alfa@example.test');
    expect((await call(owner, 'get', fill('/farmacias/{p}/reservas/resumen', pharmacyA))).status).toBe(200);
    await database.query("UPDATE f01.sesion SET estado='REVOCADA',revoked_at=now() WHERE usuario_id=$1", [ids.ownerA]);
    for (const [method, path, body] of routes.slice(0, 12)) {
      expect(isDenied((await call(owner, method as 'get', fill(path, pharmacyA), body)).status), `${method} ${path}`).toBe(true);
    }
  }, 60000);

  it('quitar la capacidad a un propietario cierra esa ruta en la siguiente petición sin cambiar las demás', async () => {
    const owner = await login('dueno-beta@example.test');
    expect((await call(owner, 'get', fill('/farmacias/{p}/reservas/resumen', pharmacyB))).status).toBe(200);
    await database.query("UPDATE f01.delegacion SET estado='REVOCADA',revoked_at=now() WHERE farmacia_id=$1 AND capacidad='reservation.read'", [pharmacyB]);
    for (const path of ['/farmacias/{p}/reservas/resumen', '/farmacias/{p}/reservas/centro', '/farmacias/{p}/reservas/historial', '/farmacias/{p}/reservas/historial/exportar']) {
      expect(isDenied((await call(owner, 'get', fill(path, pharmacyB))).status), path).toBe(true);
    }
    expect((await call(owner, 'get', fill('/farmacias/{p}/inventario/resumen', pharmacyB))).status).toBe(200);
  }, 60000);
});
