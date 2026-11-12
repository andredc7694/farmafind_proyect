/** Local F01 TEST/DEMO fixture only. Never part of the application bootstrap. */
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client, Pool } from 'pg';
import request from 'supertest';
import { migrateTestDatabase } from '../../backend/dist/modules/usuarios/infrastructure/db/migrate.js';
import { Argon2PasswordHasher } from '../../backend/dist/modules/usuarios/infrastructure/argon2-password.js';
import { createLocalIdentityApp } from '../../backend/dist/identity-app.js';
import { validateLocalIdentityRuntime } from '../../backend/dist/config/identity-runtime.js';

const root = fileURLToPath(new URL('../../', import.meta.url));
const privateDir = path.join(root, '.cache/f01-demo');
const stateFile = path.join(privateDir, 'state.local.json');
const clusterSecretFile = path.join(root, '.cache/f01-docker/postgres-password.txt');
const databasePattern = /^farmafind_f01_test_[a-f0-9]{12}$/;
const origin = 'http://127.0.0.1:5173';
const hex = length => randomBytes(length).toString('hex');

function adminUrl(database = 'farmafind_f01_test') {
  const password = readFileSync(clusterSecretFile, 'utf8').trim();
  assert.match(password, /^[a-f0-9]{64}$/i, 'Secreto local de PostgreSQL inválido');
  const url = new URL('postgresql://127.0.0.1:55431/farmafind_f01_test');
  url.username = 'f01_migrator';
  url.password = password;
  url.pathname = `/${database}`;
  return url.toString();
}

function state() {
  const value = JSON.parse(readFileSync(stateFile, 'utf8'));
  assert.equal(value.kind, 'F01_TEST_DEMO_ONLY');
  assert.match(value.database, databasePattern);
  for (const key of ['authUrl', 'runtimeUrl']) {
    const url = new URL(value[key]);
    assert.equal(url.hostname, '127.0.0.1');
    assert.equal(url.port, '55431');
    assert.equal(url.pathname, `/${value.database}`);
  }
  return value;
}

function runtimeConfig(value) {
  return validateLocalIdentityRuntime({
    APP_MODE: 'identity', HOST: '127.0.0.1', PORT: '3000',
    F01_AUTH_DATABASE_URL: value.authUrl,
    F01_DATABASE_URL: value.runtimeUrl,
    F01_CSRF_KEY_HEX: value.csrfKey,
    F01_ABUSE_KEY_HEX: value.abuseKey,
    F01_ALLOWED_ORIGIN: origin,
    F01_CSRF_TRUSTED_ORIGIN: origin,
    F01_COOKIE_SECURE: 'false', F01_ALLOW_HTTP_LOOPBACK: 'true',
  });
}

async function connect(url) {
  const client = new Client({ connectionString: url });
  await client.connect();
  return client;
}

async function counts(client) {
  return (await client.query(`SELECT
    (SELECT count(*)::int FROM f01.usuario) AS users,
    (SELECT count(*)::int FROM f01.sesion) AS sessions,
    (SELECT count(*)::int FROM f01.farmacia_referencia) AS pharmacies,
    (SELECT count(*)::int FROM f01.usuario_farmacia) AS memberships`)).rows[0];
}

async function prepare() {
  assert.equal(execFileSync('git', ['branch', '--show-current'], { cwd: root, encoding: 'utf8' }).trim(),
    'feat/f01-identidad-multitenant', 'Solo se permite preparar el fixture en la rama F01');
  assert.equal(existsSync(stateFile), false, 'El fixture DEMO ya existe; no se sobrescribe');
  const base = await connect(adminUrl());
  let demo;
  try {
    const identity = (await base.query('SELECT current_database() AS db, current_user AS role')).rows[0];
    assert.deepEqual(identity, { db: 'farmafind_f01_test', role: 'f01_migrator' });
    const baseBefore = await counts(base);
    const suffix = hex(6);
    const database = `farmafind_f01_test_${suffix}`;
    const authRole = `f01_demo_auth_${suffix}`;
    const runtimeRole = `f01_demo_runtime_${suffix}`;
    const authPassword = hex(32);
    const runtimePassword = hex(32);
    await base.query(`CREATE DATABASE "${database}"`);
    await base.query(`COMMENT ON DATABASE "${database}" IS 'FarmaFind F01 TEST/DEMO aislado; datos ficticios'`);
    await migrateTestDatabase(adminUrl(database), connect);
    await base.query(`CREATE ROLE "${authRole}" LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD '${authPassword}'`);
    await base.query(`CREATE ROLE "${runtimeRole}" LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD '${runtimePassword}'`);
    await base.query(`GRANT f01_auth TO "${authRole}"`);
    await base.query(`GRANT f01_runtime TO "${runtimeRole}"`);
    demo = await connect(adminUrl(database));
    const hasher = new Argon2PasswordHasher();
    const accounts = {};
    await demo.query('BEGIN');
    try {
      for (const label of ['multi', 'alfa', 'beta']) {
        const email = `f01-demo-${label}-${suffix}@example.test`;
        const password = `${hex(24)}Aa1!`;
        const hash = await hasher.hash(password);
        const inserted = await demo.query(`INSERT INTO f01.usuario(email_canonico,password_hash)
          VALUES($1,$2) RETURNING id`, [email, hash]);
        accounts[label] = { email, password, id: inserted.rows[0].id };
      }
      const pharmacies = {};
      for (const [label, name] of [['alfa', 'Farmacia Alfa'], ['beta', 'Farmacia Beta']]) {
        const inserted = await demo.query(`INSERT INTO f01.farmacia_referencia(nombre_publico)
          VALUES($1) RETURNING id`, [name]);
        pharmacies[label] = inserted.rows[0].id;
      }
      for (const [user, pharmacy] of [['multi', 'alfa'], ['multi', 'beta'], ['alfa', 'alfa'], ['beta', 'beta']]) {
        await demo.query(`INSERT INTO f01.usuario_farmacia(usuario_id,farmacia_id,rol)
          VALUES($1,$2,'TRABAJADOR')`, [accounts[user].id, pharmacies[pharmacy]]);
      }
      await demo.query('COMMIT');
      const authUrl = new URL(adminUrl(database));
      authUrl.username = authRole; authUrl.password = authPassword;
      const runtimeUrl = new URL(adminUrl(database));
      runtimeUrl.username = runtimeRole; runtimeUrl.password = runtimePassword;
      const value = { kind: 'F01_TEST_DEMO_ONLY', database, createdAt: new Date().toISOString(),
        authUrl: authUrl.toString(), runtimeUrl: runtimeUrl.toString(),
        csrfKey: hex(32), abuseKey: hex(32), accounts, pharmacies, baseBefore };
      runtimeConfig(value);
      mkdirSync(privateDir, { recursive: true });
      writeFileSync(stateFile, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
      assert.deepEqual(await counts(base), baseBefore, 'La base persistente cambió durante la carga');
      console.log(`F01 TEST/DEMO preparada: ${database}; 3 usuarios ficticios, 2 farmacias, 4 membresías TRABAJADOR.`);
      console.log(`Credenciales privadas: ${path.relative(root, stateFile)} (ignorado por Git).`);
    } catch (error) {
      await demo.query('ROLLBACK').catch(() => {});
      throw error;
    }
  } finally {
    if (demo) await demo.end();
    await base.end();
  }
}

async function verify() {
  const value = state();
  const demo = await connect(adminUrl(value.database));
  try {
    const current = await counts(demo);
    assert.equal(current.users, 3);
    assert.equal(current.pharmacies, 2);
    assert.equal(current.memberships, 4);
    const rows = (await demo.query(`SELECT DISTINCT rol FROM f01.usuario_farmacia`)).rows;
    assert.deepEqual(rows, [{ rol: 'TRABAJADOR' }]);
    const rls = (await demo.query(`SELECT relrowsecurity, relforcerowsecurity FROM pg_class
      WHERE oid='f01.usuario_farmacia'::regclass`)).rows[0];
    assert.deepEqual(rls, { relrowsecurity: true, relforcerowsecurity: true });
  } finally { await demo.end(); }

  const runtime = await connect(value.runtimeUrl);
  try {
    const role = (await runtime.query(`SELECT rolsuper,rolbypassrls,rolcreatedb,rolcreaterole
      FROM pg_roles WHERE rolname=current_user`)).rows[0];
    assert.deepEqual(role, { rolsuper: false, rolbypassrls: false, rolcreatedb: false, rolcreaterole: false });
    assert.equal((await runtime.query('SELECT count(*)::int n FROM f01.usuario_farmacia')).rows[0].n, 0);
    for (const label of ['multi', 'alfa', 'beta']) {
      await runtime.query('BEGIN');
      try {
        await runtime.query("SELECT set_config('app.actor_user_id',$1,true)", [value.accounts[label].id]);
        const visible = (await runtime.query(`SELECT farmacia_id FROM f01.usuario_farmacia ORDER BY farmacia_id`)).rows;
        const expected = label === 'multi' ? [value.pharmacies.alfa, value.pharmacies.beta] : [value.pharmacies[label]];
        assert.deepEqual(visible.map(row => row.farmacia_id).sort(), expected.sort());
        if (label !== 'multi') {
          const foreign = label === 'alfa' ? value.pharmacies.beta : value.pharmacies.alfa;
          const hidden = await runtime.query(`SELECT count(*)::int n FROM f01.usuario_farmacia
            WHERE farmacia_id=$1`, [foreign]);
          assert.equal(hidden.rows[0].n, 0);
        }
      } finally { await runtime.query('ROLLBACK'); }
      assert.equal((await runtime.query('SELECT count(*)::int n FROM f01.usuario_farmacia')).rows[0].n, 0);
    }
  } finally { await runtime.end(); }

  const app = await createLocalIdentityApp(runtimeConfig(value), url => new Pool({ connectionString: url, max: 4 }));
  try {
    const agents = {};
    for (const label of ['multi', 'alfa', 'beta']) {
      const agent = request.agent(app.app);
      const csrf = (await agent.get('/api/v1/auth/csrf').expect(200)).body.csrfToken;
      await agent.post('/api/v1/auth/login').set('Origin', origin).set('X-CSRF-Token', csrf)
        .send({ email: value.accounts[label].email, password: value.accounts[label].password }).expect(200);
      agents[label] = agent;
    }
    const lists = {};
    for (const label of ['multi', 'alfa', 'beta']) {
      lists[label] = (await agents[label].get('/api/v1/me/memberships').expect(200)).body;
    }
    assert.deepEqual(lists.multi.map(item => item.pharmacyName).sort(), ['Farmacia Alfa', 'Farmacia Beta']);
    assert.deepEqual(lists.alfa.map(item => item.pharmacyName), ['Farmacia Alfa']);
    assert.deepEqual(lists.beta.map(item => item.pharmacyName), ['Farmacia Beta']);
    for (const [label, allowed, denied] of [
      ['multi', 'beta', null], ['alfa', 'alfa', 'beta'], ['beta', 'beta', 'alfa'],
    ]) {
      const agent = agents[label];
      const csrf = (await agent.get('/api/v1/auth/csrf').expect(200)).body.csrfToken;
      await agent.put('/api/v1/me/active-pharmacy').set('Origin', origin).set('X-CSRF-Token', csrf)
        .send({ pharmacyId: value.pharmacies[allowed] }).expect(200);
      if (denied) await agent.put('/api/v1/me/active-pharmacy').set('Origin', origin)
        .set('X-CSRF-Token', csrf).send({ pharmacyId: value.pharmacies[denied] }).expect(404);
    }
  } finally { await app.close(); }
  console.log('F01 TEST/DEMO: RLS runtime A/B y API real positivos/negativos correctos; no se mostraron credenciales.');
}

async function start() {
  const value = state();
  const app = await createLocalIdentityApp(runtimeConfig(value), url => new Pool({ connectionString: url, max: 4 }));
  const server = app.app.listen(3000, '127.0.0.1', () => {
    console.log(`F01 TEST/DEMO ${value.database}: API en http://127.0.0.1:3000`);
  });
  server.on('error', () => { void app.close(); process.exitCode = 1; });
  let closing = false;
  const stop = () => {
    if (closing) return;
    closing = true;
    server.close(() => { void app.close(); });
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}

try {
  const mode = process.argv[2];
  if (mode === 'prepare') await prepare();
  else if (mode === 'verify') await verify();
  else if (mode === 'start') await start();
  else throw new Error('Uso: node scripts/f01/demo.mjs <prepare|verify|start>');
} catch (error) {
  console.error(`F01 TEST/DEMO: ${error instanceof Error ? error.message : 'fallo'}`);
  process.exitCode = 1;
}
