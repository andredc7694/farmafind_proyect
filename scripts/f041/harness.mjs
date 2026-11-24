/**
 * F04.1 — fixture TEST aislado para E2E, medición y DEMO. Solo datos ficticios y bases marcadas
 * `farmafind_f01_test_<12 hex>`; nunca la base persistente. Estado privado en `.cache/f041-demo/` (ignorado por Git).
 * Uso: node scripts/f041/harness.mjs prepare | serve | drop | measure
 */
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { Client, Pool } from 'pg';
import { fixtureAdminUrl } from '../f01/fixture-admin-url.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const privateDir = path.join(root, '.cache/f041-demo');
const stateFile = path.join(privateDir, 'state.local.json');
const markedDatabase = /^farmafind_f01_test_[a-f0-9]{12}$/;
const origin = 'http://127.0.0.1:5173';
const hex = length => randomBytes(length).toString('hex');

function adminUrl(database) { const url = new URL(fixtureAdminUrl(root)); if (database) url.pathname = `/${database}`; return url.toString(); }
async function connect(url) { const client = new Client({ connectionString: url }); await client.connect(); return client; }
function readState() {
  const value = JSON.parse(readFileSync(stateFile, 'utf8'));
  assert.equal(value.kind, 'F041_TEST_DEMO_ONLY'); assert.match(value.database, markedDatabase);
  for (const key of ['authUrl', 'runtimeUrl']) {
    const url = new URL(value[key]); assert.equal(url.hostname, '127.0.0.1'); assert.equal(url.port, '55431'); assert.equal(url.pathname, `/${value.database}`);
  }
  return value;
}

async function prepare() {
  assert(!existsSync(stateFile), 'Fixture F04.1 ya preparado; ejecuta «drop» antes de crear otro');
  const { migrateTestDatabase } = await import('../../backend/dist/modules/usuarios/infrastructure/db/migrate.js');
  const { migrateF02TestDatabase } = await import('../../backend/dist/modules/inventario/infrastructure/migrate.js');
  const { migrateF04TestDatabase } = await import('../../backend/dist/modules/reservas/infrastructure/migrate.js');
  const { Argon2PasswordHasher } = await import('../../backend/dist/modules/usuarios/infrastructure/argon2-password.js');
  const base = await connect(adminUrl());
  let demo;
  try {
    assert.match((await base.query('SELECT current_database() AS db')).rows[0].db, markedDatabase, 'La conexión administrativa debe ser un fixture marcado');
    const suffix = hex(6); const database = `farmafind_f01_test_${suffix}`;
    const authRole = `f041_demo_auth_${suffix}`; const runtimeRole = `f041_demo_runtime_${suffix}`; const authPassword = hex(32); const runtimePassword = hex(32);
    await base.query(`CREATE DATABASE "${database}"`);
    await base.query(`COMMENT ON DATABASE "${database}" IS 'FarmaFind F04.1 TEST/DEMO efimero; datos ficticios'`);
    await migrateTestDatabase(adminUrl(database), connect); await migrateF02TestDatabase(adminUrl(database), connect); await migrateF04TestDatabase(adminUrl(database), connect);
    for (const [role, password, group] of [[authRole, authPassword, 'f01_auth'], [runtimeRole, runtimePassword, 'f01_runtime']]) {
      await base.query(`CREATE ROLE "${role}" LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD '${password}'`);
      await base.query(`GRANT ${group} TO "${role}"`);
    }
    demo = await connect(adminUrl(database));
    const hasher = new Argon2PasswordHasher(); const accounts = {}; const pharmacies = {};
    await demo.query('BEGIN');
    try {
      for (const [key, name] of [['alfa', 'Farmacia Alfa'], ['beta', 'Farmacia Beta']]) {
        pharmacies[key] = (await demo.query('INSERT INTO f01.farmacia_referencia(nombre_publico) VALUES($1) RETURNING id', [name])).rows[0].id;
      }
      for (const [key, pharmacy] of [['duenoAlfa', 'alfa'], ['duenoBeta', 'beta'], ['cliente', null], ['cliente2', null]]) {
        const email = `f041-${key.toLowerCase()}-${suffix}@example.test`; const password = `${randomBytes(18).toString('base64url')}Aa1!`;
        const id = (await demo.query('INSERT INTO f01.usuario(email_canonico,password_hash) VALUES($1,$2) RETURNING id', [email, await hasher.hash(password)])).rows[0].id;
        accounts[key] = { id, email, password };
        if (pharmacy) {
          const membership = (await demo.query(`INSERT INTO f01.usuario_farmacia(usuario_id,farmacia_id,rol) VALUES($1,$2,'DUENO') RETURNING id`, [id, pharmacies[pharmacy]])).rows[0].id;
          for (const capability of ['reservation.read', 'reservation.accept', 'reservation.deliver', 'reservation.settings']) {
            await demo.query('INSERT INTO f01.delegacion(membresia_id,farmacia_id,capacidad,granted_by_usuario_id) VALUES($1,$2,$3,$4)', [membership, pharmacies[pharmacy], capability, id]);
          }
        }
      }
      const medication = (await demo.query(`INSERT INTO f02.medicamento(nombre,concentracion,presentacion,clasificacion) VALUES('producto ficticio','10 mg','tabletas','venta libre') RETURNING id`)).rows[0].id;
      for (const key of ['alfa', 'beta']) {
        await demo.query('INSERT INTO f02.inventario(farmacia_id,medicamento_id,precio_centavos,cantidad_fisica,ultima_revision_at) VALUES($1,$2,1500,200,now())', [pharmacies[key], medication]);
      }
      await demo.query('COMMIT');
      const authUrl = new URL(adminUrl(database)); authUrl.username = authRole; authUrl.password = authPassword;
      const runtimeUrl = new URL(adminUrl(database)); runtimeUrl.username = runtimeRole; runtimeUrl.password = runtimePassword;
      mkdirSync(privateDir, { recursive: true });
      writeFileSync(stateFile, `${JSON.stringify({ kind: 'F041_TEST_DEMO_ONLY', database, authRole, runtimeRole, authUrl: authUrl.toString(), runtimeUrl: runtimeUrl.toString(),
        csrfKey: hex(32), abuseKey: hex(32), accounts, pharmacies, medication }, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
      console.log(`F04.1 TEST preparado: ${database}; 2 farmacias ficticias, 2 propietarios, 2 clientes, 1 medicamento con 200 unidades por farmacia.`);
    } catch (error) { await demo.query('ROLLBACK'); throw error; }
  } finally { if (demo) await demo.end(); await base.end(); }
}

async function compose() {
  const state = readState();
  const { createLocalIdentityApp } = await import('../../backend/dist/identity-app.js');
  const { validateLocalIdentityRuntime } = await import('../../backend/dist/config/identity-runtime.js');
  const { loadReservationConfig } = await import('../../backend/dist/config/reservations.js');
  const identity = validateLocalIdentityRuntime({ APP_MODE: 'identity', HOST: '127.0.0.1', PORT: '3000',
    F01_AUTH_DATABASE_URL: state.authUrl, F01_DATABASE_URL: state.runtimeUrl, F01_CSRF_KEY_HEX: state.csrfKey, F01_ABUSE_KEY_HEX: state.abuseKey,
    F01_ALLOWED_ORIGIN: origin, F01_CSRF_TRUSTED_ORIGIN: origin, F01_COOKIE_SECURE: 'false', F01_ALLOW_HTTP_LOOPBACK: 'true' });
  const reservations = loadReservationConfig({ RESERVATION_PENDING_MINUTES: '20', RESERVATION_EXPIRATION_BATCH_SIZE: '100' });
  return { state, composed: await createLocalIdentityApp({ ...identity, reservations }, url => new Pool({ connectionString: url, max: 6 })) };
}

async function serve() {
  const { state, composed } = await compose();
  const server = composed.app.listen(3000, '127.0.0.1', () => console.log(`F04.1 API TEST ${state.database}: http://127.0.0.1:3000/health`));
  let closing = false;
  const stop = () => { if (closing) return; closing = true; server.close(() => void composed.close()); };
  process.on('SIGINT', stop); process.on('SIGTERM', stop);
  server.on('error', async error => { console.error(`F04.1 API: ${error.code || 'error'}`); await composed.close(); process.exitCode = 1; });
}

async function drop() {
  if (!existsSync(stateFile)) { console.log('Sin fixture F04.1 que eliminar.'); return; }
  const state = readState(); const base = await connect(adminUrl());
  try {
    await base.query(`DROP DATABASE IF EXISTS "${state.database}" WITH (FORCE)`);
    for (const role of [state.authRole, state.runtimeRole]) await base.query(`DROP ROLE IF EXISTS "${role}"`);
  } finally { await base.end(); }
  rmSync(privateDir, { recursive: true, force: true });
  console.log(`Fixture F04.1 eliminado: ${state.database} y sus roles.`);
}

/** T016: tiempo de la instantánea y de la exportación con 5000 reservas cerradas ficticias (HTTP en proceso, sin red externa). */
async function measure() {
  await prepare();
  try {
    const state = readState(); const owner = await connect(adminUrl(state.database));
    const customer = state.accounts.cliente.id; const alfa = state.pharmacies.alfa;
    const inventory = (await owner.query('SELECT id FROM f02.inventario WHERE farmacia_id=$1', [alfa])).rows[0].id;
    await owner.query(`INSERT INTO f04.reserva(usuario_id,farmacia_id,inventario_id,medicamento_id,cantidad,estado,respuesta_expira_en,creado_en,motivo_cierre)
      SELECT $1,$2,$3,$4,1,'CANCELADA',now()+interval '20 minutes',now()-(g||' minutes')::interval,'CANCELADA_POR_USUARIO' FROM generate_series(1,5000) g`,
    [customer, alfa, inventory, state.medication]);
    await owner.query(`INSERT INTO f04.reserva(usuario_id,farmacia_id,inventario_id,medicamento_id,cantidad,estado,respuesta_expira_en)
      SELECT $1,$2,$3,$4,1,'PENDIENTE',now()+interval '20 minutes' FROM generate_series(1,200)`, [customer, alfa, inventory, state.medication]);
    await owner.end();
    const { default: request } = await import('supertest');
    const { composed } = await compose();
    try {
      const agent = request.agent(composed.app);
      const csrf = (await agent.get('/api/v1/auth/csrf')).body.csrfToken;
      await agent.post('/api/v1/auth/login').set('Origin', origin).set('X-CSRF-Token', csrf).send({ email: state.accounts.duenoAlfa.email, password: state.accounts.duenoAlfa.password }).expect(200);
      const timed = async (label, path, reps = 7) => {
        const values = []; let size = 0;
        for (let i = 0; i < reps; i++) { const start = performance.now(); const response = await agent.get(`/api/v1/farmacias/${alfa}/reservas${path}`).expect(200); values.push(performance.now() - start); size = response.text.length; }
        values.sort((a, b) => a - b);
        return `| ${label} | ${values[0].toFixed(0)} ms | ${values[Math.floor(values.length / 2)].toFixed(0)} ms | ${values.at(-1).toFixed(0)} ms | ${(size / 1024).toFixed(0)} KiB |`;
      };
      console.log('# Medición F04.1 (5000 reservas cerradas + 200 pendientes, TEST local, 7 repeticiones)');
      console.log('| Operación | mín | mediana | máx | tamaño |\n|---|---|---|---|---|');
      console.log(await timed('instantánea de la cola (200 pendientes)', '/centro'));
      console.log(await timed('historial, página de 25', '/historial?limite=25'));
      console.log(await timed('historial, página de 100', '/historial?limite=100'));
      console.log(await timed('exportación CSV (5000 filas)', '/historial/exportar'));
      const exported = await agent.get(`/api/v1/farmacias/${alfa}/reservas/historial/exportar`);
      console.log(`Exportación: ${exported.text.split('\r\n').length - 2} filas, truncado=${exported.headers['x-export-truncated']}.`);
    } finally { await composed.close(); }
  } finally { await drop(); }
}

const mode = process.argv[2];
if (mode === 'prepare') await prepare();
else if (mode === 'serve') await serve();
else if (mode === 'drop') await drop();
else if (mode === 'measure') await measure();
else throw new Error('Uso: node scripts/f041/harness.mjs prepare|serve|drop|measure');
