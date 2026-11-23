/** F02.1 browser TEST: mounts only test code and dependency package; never mounts the repository. */
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { Client } from 'pg';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { migrateF02TestDatabase } from '../../backend/dist/modules/inventario/infrastructure/migrate.js';
import { migrateF03TestDatabase } from '../../backend/dist/modules/busqueda/infrastructure/migrate.js';
import { ensureFree, launch, stop } from '../f00/process-supervisor.mjs';
import { waitForHttp } from '../f00/http-checks.mjs';

const root = process.cwd();
const state = JSON.parse(readFileSync(path.join(root, '.cache/f02-fixture/state.local.json'), 'utf8'));
assert.equal(state.kind, 'F02_FIX01_TEST_ONLY');
assert.match(state.database, /^farmafind_f01_test_[a-f0-9]{12}$/);
const url = new URL(state.authUrl);
assert.equal(url.hostname, '127.0.0.1');
assert.equal(url.port, '55431');
assert.equal(url.pathname, `/${state.database}`);
const password = readFileSync(path.join(root, '.cache/f01-docker/postgres-password.txt'), 'utf8').trim();
assert.match(password, /^[a-f0-9]{64}$/i);
url.username = 'f01_migrator'; url.password = password;
const client = new Client({ connectionString: url.toString() });
await client.connect();
try {
  const identity = (await client.query("SELECT current_database() AS db, shobj_description(oid,'pg_database') AS marker FROM pg_database WHERE datname=current_database()"));
  assert.equal(identity.rows[0].db, state.database);
  assert.equal(identity.rows[0].marker, 'FarmaFind F02 FIX-01 TEST ficticio');
} finally { await client.end(); }
const applied = await migrateF02TestDatabase(url.toString(), async connection => {
  const database = new Client({ connectionString: connection }); await database.connect(); return database;
});
assert(applied.every(name => name === '005_smart_import.sql'), 'Migración ajena a F02.1 pendiente');
console.log('F02.1 TEST: migración F02.1 comprobada en fixture efímero.');
const appliedSearch = await migrateF03TestDatabase(url.toString(), async connection => {
  const database = new Client({ connectionString: connection }); await database.connect(); return database;
});
assert(appliedSearch.every(name => /^00[12]_/.test(name)), 'Migración F03 ajena al fixture pendiente');
const publicFixture = new Client({ connectionString: url.toString() });
await publicFixture.connect();
try {
  const catalog = await publicFixture.query(`SELECT id FROM f02.medicamento
    WHERE nombre='producto ficticio' AND concentracion='10 mg' AND presentacion='tabletas'`);
  assert.equal(catalog.rows.length, 1, 'Catálogo TEST inesperado');
  await publicFixture.query(`UPDATE f02.medicamento SET principio_activo='producto ficticio'
    WHERE id=$1 AND principio_activo IS NULL`, [catalog.rows[0].id]);
  await publicFixture.query(`INSERT INTO f03.farmacia_publica(farmacia_id,direccion_texto)
    VALUES($1,'Dirección ficticia Alfa') ON CONFLICT(farmacia_id) DO NOTHING`, [state.pharmacies.alfa]);
} finally { await publicFixture.end(); }

for (const command of ['scripts/f02/prepare-browser-env.mjs', 'scripts/f02/smoke.mjs']) {
  const result = spawnSync(process.execPath, [command], { cwd: root, stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
const logDir = mkdtempSync(path.join(tmpdir(), 'farmafind f021 browser '));
const active = [];
try {
  for (const service of [
    { id: 'f021-api', port: 3000, url: 'http://127.0.0.1:3000/health',
      args: ['scripts/f021/start-browser-api.mjs'] },
    { id: 'f021-web', port: 5173, url: 'http://127.0.0.1:5173/inventory',
      args: ['node_modules/vite/bin/vite.js', 'frontend', '--config', 'frontend/vite.config.js',
        '--host', '127.0.0.1', '--port', '5173', '--strictPort'] },
  ]) {
    await ensureFree(service.port);
    const child = launch({ id: service.id,
      args: service.args.map(value => value.includes('/') ? path.join(root, value) : value), logDir });
    active.push(child); await waitForHttp(service.url, child, 60000);
  }
  const mount = (source, target) => `type=bind,source=${path.join(root, source)},target=${target},readonly`;
  const result = spawnSync('docker', ['run', '--rm', '--add-host=host.docker.internal:host-gateway',
    '--env-file', path.join(root, '.cache/f02-e2e/vars.local.env'),
    '--mount', mount('package.json', '/work/package.json'),
    '--mount', mount('node_modules', '/work/node_modules'),
    '--mount', mount('frontend/e2e/f021-import.spec.js', '/work/frontend/e2e/f021-import.spec.js'),
    '--mount', mount('scripts/f021/run-browser-container.mjs', '/work/scripts/f021/run-browser-container.mjs'),
    '-w', '/work', 'mcr.microsoft.com/playwright:v1.65.0-noble',
    'node', 'scripts/f021/run-browser-container.mjs'], { cwd: root, stdio: 'inherit', shell: false });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} finally {
  for (const child of active.reverse()) await stop(child);
  for (const port of [3000, 5173]) await ensureFree(port);
  assert(logDir.startsWith(path.join(tmpdir(), 'farmafind f021 browser ')));
  rmSync(logDir, { recursive: true, force: true });
}
