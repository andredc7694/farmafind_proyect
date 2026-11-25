/**
 * F08.1 — fixture TEST aislado para E2E y DEMO (integrado F01–F07). Solo datos ficticios y bases marcadas
 * `farmafind_f01_test_<12 hex>`; nunca la base persistente. Estado privado en `.cache/f081-demo/` (ignorado por Git).
 * Requiere los contenedores TEST de PostgreSQL (F01) y Redis (F03). Uso: node scripts/f081/harness.mjs prepare | serve | drop
 */
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client, Pool } from 'pg';
import { fixtureAdminUrl } from '../f01/fixture-admin-url.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const privateDir = path.join(root, '.cache/f081-demo');
const stateFile = path.join(privateDir, 'state.local.json');
const markedDatabase = /^farmafind_f01_test_[a-f0-9]{12}$/;
const origin = 'http://127.0.0.1:5173';
const hex = length => randomBytes(length).toString('hex');

function adminUrl(database) { const url = new URL(fixtureAdminUrl(root)); if (database) url.pathname = `/${database}`; return url.toString(); }
async function connect(url) { const client = new Client({ connectionString: url }); await client.connect(); return client; }
function readState() {
  const value = JSON.parse(readFileSync(stateFile, 'utf8'));
  assert.equal(value.kind, 'F081_TEST_DEMO_ONLY'); assert.match(value.database, markedDatabase);
  for (const key of ['authUrl', 'runtimeUrl']) {
    const url = new URL(value[key]); assert.equal(url.hostname, '127.0.0.1'); assert.equal(url.port, '55431'); assert.equal(url.pathname, `/${value.database}`);
  }
  return value;
}

async function prepare() {
  assert(!existsSync(stateFile), 'Fixture F08.1 ya preparado; ejecuta «drop» antes de crear otro');
  const { migrateTestDatabase } = await import('../../backend/dist/modules/usuarios/infrastructure/db/migrate.js');
  const { migrateF02TestDatabase } = await import('../../backend/dist/modules/inventario/infrastructure/migrate.js');
  const { migrateF03TestDatabase, migrateF07TestDatabase } = await import('../../backend/dist/modules/busqueda/infrastructure/migrate.js');
  const { migrateF04TestDatabase } = await import('../../backend/dist/modules/reservas/infrastructure/migrate.js');
  const { Argon2PasswordHasher } = await import('../../backend/dist/modules/usuarios/infrastructure/argon2-password.js');
  const redisSecret = readFileSync(path.join(root, '.cache/f03-docker/redis-password.txt'), 'utf8').trim();
  assert.match(redisSecret, /^[a-f0-9]{64}$/i);
  const base = await connect(adminUrl());
  let demo;
  try {
    assert.match((await base.query('SELECT current_database() AS db')).rows[0].db, markedDatabase, 'La conexión administrativa debe ser un fixture marcado');
    const suffix = hex(6); const database = `farmafind_f01_test_${suffix}`;
    const authRole = `f081_demo_auth_${suffix}`; const runtimeRole = `f081_demo_runtime_${suffix}`; const authPassword = hex(32); const runtimePassword = hex(32);
    await base.query(`CREATE DATABASE "${database}"`);
    await base.query(`COMMENT ON DATABASE "${database}" IS 'FarmaFind F07 TEST efimera'`); // marcador exigido por el migrador de F07
    for (const migrate of [migrateTestDatabase, migrateF02TestDatabase, migrateF03TestDatabase, migrateF04TestDatabase, migrateF07TestDatabase]) await migrate(adminUrl(database), connect);
    for (const [role, password, group] of [[authRole, authPassword, 'f01_auth'], [runtimeRole, runtimePassword, 'f01_runtime']]) {
      await base.query(`CREATE ROLE "${role}" LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD '${password}'`);
      await base.query(`GRANT ${group} TO "${role}"`);
    }
    demo = await connect(adminUrl(database));
    const hasher = new Argon2PasswordHasher(); const accounts = {}; const pharmacies = {};
    await demo.query('BEGIN');
    try {
      for (const [key, name, address, latitude, longitude] of [['alfa', 'Farmacia Alfa', 'Av. Alfa 100, Lima', -12.0464, -77.0428], ['beta', 'Farmacia Beta', 'Av. Beta 200, Lima', -12.08, -77.06]]) {
        pharmacies[key] = (await demo.query('INSERT INTO f01.farmacia_referencia(nombre_publico) VALUES($1) RETURNING id', [name])).rows[0].id;
        await demo.query('INSERT INTO f03.farmacia_publica(farmacia_id,direccion_texto,latitud,longitud) VALUES($1,$2,$3,$4)', [pharmacies[key], address, latitude, longitude]);
      }
      const allCapabilities = ['membership.manage', 'inventory.read', 'inventory.write', 'inventory.import.preview', 'inventory.import.confirm', 'inventory.history',
        'reservation.read', 'reservation.accept', 'reservation.deliver', 'reservation.settings', 'GEO_LOCATION_PROPOSE'];
      for (const [key, pharmacy, role, capabilities] of [['duenoAlfa', 'alfa', 'DUENO', allCapabilities], ['duenoBeta', 'beta', 'DUENO', allCapabilities],
        ['trabajador', 'alfa', 'TRABAJADOR', ['inventory.read', 'reservation.read', 'reservation.accept']], ['revisor', 'alfa', 'ADMINISTRADOR', ['GEO_LOCATION_REVIEW']], ['cliente', null, null, []], ['cliente2', null, null, []]]) {
        const email = `f081-${key.toLowerCase()}-${suffix}@example.test`; const password = `${randomBytes(18).toString('base64url')}Aa1!`;
        const id = (await demo.query('INSERT INTO f01.usuario(email_canonico,password_hash) VALUES($1,$2) RETURNING id', [email, await hasher.hash(password)])).rows[0].id;
        accounts[key] = { id, email, password };
        if (pharmacy) {
          const membership = (await demo.query('INSERT INTO f01.usuario_farmacia(usuario_id,farmacia_id,rol) VALUES($1,$2,$3) RETURNING id', [id, pharmacies[pharmacy], role])).rows[0].id;
          for (const capability of capabilities) await demo.query('INSERT INTO f01.delegacion(membresia_id,farmacia_id,capacidad,granted_by_usuario_id) VALUES($1,$2,$3,$4)', [membership, pharmacies[pharmacy], capability, id]);
        }
      }
      const medication = async (name, active, concentration, presentation) => (await demo.query(`INSERT INTO f02.medicamento(nombre,principio_activo,concentracion,presentacion,clasificacion)
        VALUES($1,$2,$3,$4,'venta libre') RETURNING id`, [name, active, concentration, presentation])).rows[0].id;
      const meds = { paracetamol: await medication('paracetamol ficticio', 'principio ficticio uno', '500 mg', 'tabletas'),
        paracetamolJarabe: await medication('paracetamol ficticio', 'principio ficticio uno', '120 mg', 'jarabe'), ibuprofeno: await medication('ibuprofeno ficticio', 'principio ficticio dos', '400 mg', 'capsulas') };
      for (const [pharmacy, medicationKey, cents, quantity] of [['alfa', 'paracetamol', 1250, 40], ['beta', 'paracetamol', 990, 25], ['alfa', 'paracetamolJarabe', 1800, 10], ['alfa', 'ibuprofeno', 2100, 30], ['beta', 'ibuprofeno', 1900, 12]]) {
        await demo.query('INSERT INTO f02.inventario(farmacia_id,medicamento_id,precio_centavos,cantidad_fisica,ultima_revision_at) VALUES($1,$2,$3,$4,now())', [pharmacies[pharmacy], meds[medicationKey], cents, quantity]);
      }
      for (const [pharmacy, proposer, reviewer] of [['alfa', 'duenoAlfa', 'revisor'], ['beta', 'duenoBeta', 'revisor']]) {
        await demo.query(`UPDATE f03.farmacia_publica SET ciudad='lima',fuente='Fixture DEMO local',estado_ubicacion='PUBLICADA_VERIFICADA',propuesta_por=$2,revisada_por=$3,
          fecha_verificacion=now(),updated_at=now() WHERE farmacia_id=$1`, [pharmacies[pharmacy], accounts[proposer].id, accounts[reviewer].id]);
      }
      await demo.query('COMMIT');
    } catch (error) { await demo.query('ROLLBACK'); throw error; }
    const authUrl = new URL(adminUrl(database)); authUrl.username = authRole; authUrl.password = authPassword;
    const runtimeUrl = new URL(adminUrl(database)); runtimeUrl.username = runtimeRole; runtimeUrl.password = runtimePassword;
    const redisUrl = new URL('redis://127.0.0.1:56379/0'); redisUrl.password = redisSecret;
    mkdirSync(privateDir, { recursive: true });
    writeFileSync(stateFile, `${JSON.stringify({ kind: 'F081_TEST_DEMO_ONLY', database, authRole, runtimeRole, authUrl: authUrl.toString(), runtimeUrl: runtimeUrl.toString(),
      redisUrl: redisUrl.toString(), csrfKey: hex(32), abuseKey: hex(32), accounts, pharmacies }, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
    console.log(`F08.1 TEST preparado: ${database}; 2 farmacias, 6 cuentas ficticias (2 propietarios, trabajador, revisor, 2 clientes) y 5 ofertas públicas.`);
  } finally { if (demo) await demo.end(); await base.end(); }
}

async function serve() {
  const state = readState();
  const { createLocalIdentityApp } = await import('../../backend/dist/identity-app.js');
  const { validateLocalIdentityRuntime } = await import('../../backend/dist/config/identity-runtime.js');
  const { loadReservationConfig } = await import('../../backend/dist/config/reservations.js');
  const { loadSearchConfig } = await import('../../backend/dist/config/search.js');
  const identity = validateLocalIdentityRuntime({ APP_MODE: 'identity', HOST: '127.0.0.1', PORT: '3000',
    F01_AUTH_DATABASE_URL: state.authUrl, F01_DATABASE_URL: state.runtimeUrl, F01_CSRF_KEY_HEX: state.csrfKey, F01_ABUSE_KEY_HEX: state.abuseKey,
    F01_ALLOWED_ORIGIN: origin, F01_CSRF_TRUSTED_ORIGIN: origin, F01_COOKIE_SECURE: 'false', F01_ALLOW_HTTP_LOOPBACK: 'true' });
  const search = loadSearchConfig({ SEARCH_REDIS_URL: state.redisUrl, SEARCH_CACHE_TTL_SECONDS: '60', SEARCH_CACHE_TIMEOUT_MS: '150', SEARCH_CANDIDATE_LIMIT: '200' });
  const reservations = loadReservationConfig({ RESERVATION_PENDING_MINUTES: '20', RESERVATION_EXPIRATION_BATCH_SIZE: '100' });
  delete process.env.FARMAFIND_AI_PROVIDER; // el asistente queda en modo mock determinista (sin proveedor externo)
  const composed = await createLocalIdentityApp({ ...identity, search, reservations, geolocationTest: true }, url => new Pool({ connectionString: url, max: 6 }));
  const server = composed.app.listen(3000, '127.0.0.1', () => console.log(`F08.1 API TEST ${state.database}: http://127.0.0.1:3000/health`));
  let closing = false;
  const stop = () => { if (closing) return; closing = true; server.close(() => void composed.close()); };
  process.on('SIGINT', stop); process.on('SIGTERM', stop);
  server.on('error', async error => { console.error(`F08.1 API: ${error.code || 'error'}`); await composed.close(); process.exitCode = 1; });
}

async function drop() {
  if (!existsSync(stateFile)) { console.log('Sin fixture F08.1 que eliminar.'); return; }
  const state = readState(); const base = await connect(adminUrl());
  try {
    await base.query(`DROP DATABASE IF EXISTS "${state.database}" WITH (FORCE)`);
    for (const role of [state.authRole, state.runtimeRole]) await base.query(`DROP ROLE IF EXISTS "${role}"`);
  } finally { await base.end(); }
  rmSync(privateDir, { recursive: true, force: true });
  console.log(`Fixture F08.1 eliminado: ${state.database} y sus roles.`);
}

const mode = process.argv[2];
if (mode === 'prepare') await prepare();
else if (mode === 'serve') await serve();
else if (mode === 'drop') await drop();
else throw new Error('Uso: node scripts/f081/harness.mjs prepare|serve|drop');
