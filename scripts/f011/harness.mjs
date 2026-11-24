/**
 * F01.1 — fixture TEST aislado para E2E (T053) y DEMO manual (T055). Solo datos ficticios, solo bases marcadas
 * `farmafind_f01_test_<12 hex>`; nunca la base persistente `farmafind_f01_test`. El estado privado vive en
 * `.cache/f011-demo/` (ignorado por Git): credenciales, claves y bandeja del simulador de correo.
 *
 * Uso: node scripts/f011/harness.mjs prepare | serve | drop
 */
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client, Pool } from 'pg';
import { fixtureAdminUrl } from '../f01/fixture-admin-url.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const privateDir = path.join(root, '.cache/f011-demo');
const stateFile = path.join(privateDir, 'state.local.json');
const markedDatabase = /^farmafind_f01_test_[a-f0-9]{12}$/;
const origin = 'http://127.0.0.1:5173';
const hex = length => randomBytes(length).toString('hex');

/** URL del migrador sobre una base concreta (parte siempre del fixture marcado, no de la base persistente). */
function adminUrl(database) {
  const url = new URL(fixtureAdminUrl(root));
  if (database) url.pathname = `/${database}`;
  return url.toString();
}
async function connect(url) { const client = new Client({ connectionString: url }); await client.connect(); return client; }

function readState() {
  const value = JSON.parse(readFileSync(stateFile, 'utf8'));
  assert.equal(value.kind, 'F011_TEST_DEMO_ONLY');
  assert.match(value.database, markedDatabase);
  for (const key of ['authUrl', 'runtimeUrl']) {
    const url = new URL(value[key]);
    assert.equal(url.hostname, '127.0.0.1'); assert.equal(url.port, '55431'); assert.equal(url.pathname, `/${value.database}`);
  }
  return value;
}

async function prepare() {
  assert(!existsSync(stateFile), 'Fixture F01.1 ya preparado; ejecuta «drop» antes de crear otro');
  const { migrateTestDatabase } = await import('../../backend/dist/modules/usuarios/infrastructure/db/migrate.js');
  const { Argon2PasswordHasher } = await import('../../backend/dist/modules/usuarios/infrastructure/argon2-password.js');
  const base = await connect(adminUrl());
  let demo;
  try {
    const current = (await base.query('SELECT current_database() AS db')).rows[0].db;
    assert.match(current, markedDatabase, 'La conexión administrativa debe ser un fixture marcado, nunca farmafind_f01_test');
    const suffix = hex(6); const database = `farmafind_f01_test_${suffix}`;
    const authRole = `f011_demo_auth_${suffix}`; const runtimeRole = `f011_demo_runtime_${suffix}`;
    const authPassword = hex(32); const runtimePassword = hex(32);
    await base.query(`CREATE DATABASE "${database}"`);
    await base.query(`COMMENT ON DATABASE "${database}" IS 'FarmaFind F01.1 TEST/DEMO efimero; datos ficticios'`);
    await migrateTestDatabase(adminUrl(database), connect);
    for (const [role, password, group] of [[authRole, authPassword, 'f01_auth'], [runtimeRole, runtimePassword, 'f01_runtime']]) {
      await base.query(`CREATE ROLE "${role}" LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD '${password}'`);
      await base.query(`GRANT ${group} TO "${role}"`);
    }
    demo = await connect(adminUrl(database));
    const hasher = new Argon2PasswordHasher();
    const accounts = {}; const pharmacies = {};
    await demo.query('BEGIN');
    try {
      for (const [key, name] of [['alfa', 'Farmacia Alfa'], ['beta', 'Farmacia Beta']]) {
        pharmacies[key] = (await demo.query('INSERT INTO f01.farmacia_referencia(nombre_publico) VALUES($1) RETURNING id', [name])).rows[0].id;
      }
      for (const [key, pharmacy, role] of [['duenoAlfa', 'alfa', 'DUENO'], ['duenoBeta', 'beta', 'DUENO'], ['cliente', null, null],
        ['cliente2', null, null], ['admin', null, null]]) {
        const email = `f011-${key.toLowerCase()}-${suffix}@example.test`;
        const password = `${randomBytes(18).toString('base64url')}Aa1!`;
        const id = (await demo.query('INSERT INTO f01.usuario(email_canonico,password_hash) VALUES($1,$2) RETURNING id',
          [email, await hasher.hash(password)])).rows[0].id;
        accounts[key] = { id, email, password };
        if (pharmacy) {
          const membership = (await demo.query(`INSERT INTO f01.usuario_farmacia(usuario_id,farmacia_id,rol) VALUES($1,$2,$3) RETURNING id`,
            [id, pharmacies[pharmacy], role])).rows[0].id;
          await demo.query(`INSERT INTO f01.delegacion(membresia_id,farmacia_id,capacidad,granted_by_usuario_id) VALUES($1,$2,'membership.manage',$3)`,
            [membership, pharmacies[pharmacy], id]);
        }
      }
      const approval = randomUUID();
      await demo.query(`INSERT INTO f01.privileged_approval(id,operation,target_usuario_id,role_code,reason,expires_at,integrity_hash)
        VALUES($1,'INITIAL_PLATFORM_ADMIN',$2,'ADMINISTRADOR_PLATAFORMA','Fixture sintetico TEST',now()+interval '1 day',$3)`,
      [approval, accounts.admin.id, 'a'.repeat(64)]);
      await demo.query(`INSERT INTO f01.platform_role_assignment(usuario_id,role_code,approval_id) VALUES($1,'ADMINISTRADOR_PLATAFORMA',$2)`,
        [accounts.admin.id, approval]);
      await demo.query('COMMIT');
    } catch (error) { await demo.query('ROLLBACK'); throw error; }
    const authUrl = new URL(adminUrl(database)); authUrl.username = authRole; authUrl.password = authPassword;
    const runtimeUrl = new URL(adminUrl(database)); runtimeUrl.username = runtimeRole; runtimeUrl.password = runtimePassword;
    mkdirSync(path.join(privateDir, 'mailbox'), { recursive: true });
    writeFileSync(stateFile, `${JSON.stringify({ kind: 'F011_TEST_DEMO_ONLY', database, authRole, runtimeRole,
      authUrl: authUrl.toString(), runtimeUrl: runtimeUrl.toString(), csrfKey: hex(32), abuseKey: hex(32), mfaKey: hex(32),
      accounts, pharmacies }, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
    console.log(`F01.1 TEST preparado: ${database}; 2 farmacias ficticias, 5 cuentas (2 propietarios, 2 clientes, 1 administrador).`);
  } finally { if (demo) await demo.end(); await base.end(); }
}

async function serve() {
  const state = readState();
  const { createLocalIdentityApp } = await import('../../backend/dist/identity-app.js');
  const { validateLocalIdentityRuntime } = await import('../../backend/dist/config/identity-runtime.js');
  const config = validateLocalIdentityRuntime({ APP_MODE: 'identity', HOST: '127.0.0.1', PORT: '3000',
    F01_AUTH_DATABASE_URL: state.authUrl, F01_DATABASE_URL: state.runtimeUrl,
    F01_CSRF_KEY_HEX: state.csrfKey, F01_ABUSE_KEY_HEX: state.abuseKey, F01_MFA_KEY_HEX: state.mfaKey,
    F01_MAILBOX_DIR: path.join(privateDir, 'mailbox'),
    F01_ALLOWED_ORIGIN: origin, F01_CSRF_TRUSTED_ORIGIN: origin, F01_COOKIE_SECURE: 'false', F01_ALLOW_HTTP_LOOPBACK: 'true' });
  const composed = await createLocalIdentityApp(config, url => new Pool({ connectionString: url, max: 6 }));
  const server = composed.app.listen(3000, '127.0.0.1', () => console.log(`F01.1 API TEST ${state.database}: http://127.0.0.1:3000/health`));
  let closing = false;
  const stop = () => { if (closing) return; closing = true; server.close(() => void composed.close()); };
  process.on('SIGINT', stop); process.on('SIGTERM', stop);
  server.on('error', async error => { console.error(`F01.1 API: ${error.code || 'error'}`); await composed.close(); process.exitCode = 1; });
}

/** Elimina SOLO la base efímera creada por «prepare» (marcada y registrada en el estado) y su estado local. */
async function drop() {
  if (!existsSync(stateFile)) { console.log('Sin fixture F01.1 que eliminar.'); return; }
  const state = readState();
  const base = await connect(adminUrl());
  try {
    await base.query(`DROP DATABASE IF EXISTS "${state.database}" WITH (FORCE)`);
    for (const role of [state.authRole, state.runtimeRole]) await base.query(`DROP ROLE IF EXISTS "${role}"`);
  } finally { await base.end(); }
  rmSync(privateDir, { recursive: true, force: true });
  console.log(`Fixture F01.1 eliminado: ${state.database} y sus roles.`);
}

const mode = process.argv[2];
if (mode === 'prepare') await prepare();
else if (mode === 'serve') await serve();
else if (mode === 'drop') await drop();
else throw new Error('Uso: node scripts/f011/harness.mjs prepare|serve|drop');
