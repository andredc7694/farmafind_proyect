/**
 * F08.1 T019 — recorridos E2E en Chromium (Playwright Linux en contenedor) sobre un fixture TEST efímero.
 * Crea el fixture, levanta API y web locales, ejecuta el spec y SIEMPRE elimina el fixture propio al terminar.
 * El contenedor solo recibe el código de prueba, node_modules y la bandeja del simulador (solo lectura).
 */
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { ensureFree, launch, stop } from '../f00/process-supervisor.mjs';
import { waitForHttp } from '../f00/http-checks.mjs';

const root = process.cwd();
const run = (args, options = {}) => spawnSync(process.execPath, args, { cwd: root, stdio: 'inherit', ...options });
const resultsDir = path.join(root, '.cache/f081-results'); mkdirSync(resultsDir, { recursive: true });
const logDir = mkdtempSync(path.join(tmpdir(), 'farmafind f081 browser '));
const active = []; let prepared = false;
try {
  const created = run(['scripts/f081/harness.mjs', 'prepare']);
  if (created.status !== 0) process.exit(created.status ?? 1);
  prepared = true;
  const state = JSON.parse(readFileSync(path.join(root, '.cache/f081-demo/state.local.json'), 'utf8'));
  assert.equal(state.kind, 'F081_TEST_DEMO_ONLY');
  const values = { F081_E2E_CONTAINER: '1', F081_ALFA_ID: state.pharmacies.alfa, F081_MED_ID: state.meds?.paracetamol ?? '', F081_BETA_ID: state.pharmacies.beta,
    F081_OWNER_EMAIL: state.accounts.duenoAlfa.email, F081_OWNER_PASSWORD: state.accounts.duenoAlfa.password,
    F081_OWNER_B_EMAIL: state.accounts.duenoBeta.email, F081_OWNER_B_PASSWORD: state.accounts.duenoBeta.password,
    F081_WORKER_EMAIL: state.accounts.trabajador.email, F081_WORKER_PASSWORD: state.accounts.trabajador.password,
    F081_REVIEWER_EMAIL: state.accounts.revisor.email, F081_REVIEWER_PASSWORD: state.accounts.revisor.password,
    F081_CLIENT_EMAIL: state.accounts.cliente.email, F081_CLIENT_PASSWORD: state.accounts.cliente.password };
  for (const value of Object.values(values)) assert(typeof value === 'string' && !/[\r\n]/.test(value), 'Valor privado inválido');
  const envFile = path.join(root, '.cache/f081-demo/e2e.env');
  writeFileSync(envFile, Object.entries(values).map(([key, value]) => `${key}=${value}`).join('\n') + '\n', { mode: 0o600 });

  for (const service of [
    { id: 'f081-api', port: 3000, url: 'http://127.0.0.1:3000/health', args: ['scripts/f081/harness.mjs', 'serve'] },
    { id: 'f081-web', port: 5173, url: 'http://127.0.0.1:5173/',
      args: ['node_modules/vite/bin/vite.js', 'frontend', '--config', 'frontend/vite.config.js', '--host', '127.0.0.1', '--port', '5173', '--strictPort'] },
  ]) {
    await ensureFree(service.port);
    const child = launch({ id: service.id, args: service.args.map(value => value.includes('/') ? path.join(root, value) : value), logDir });
    active.push(child); await waitForHttp(service.url, child, 60000);
  }
  const specFile = process.env.F081_SPEC || 'frontend/e2e/f081-experience.spec.js';
  const mount = (source, target) => `type=bind,source=${path.join(root, source)},target=${target},readonly`;
  const result = spawnSync('docker', ['run', '--rm', '--add-host=host.docker.internal:host-gateway', '--env-file', envFile, '-e', 'F081_SPEC=' + specFile, '-e', 'REDIS_DOWN=' + (process.env.REDIS_DOWN || ''),
    '--mount', mount('package.json', '/work/package.json'), '--mount', mount('node_modules', '/work/node_modules'),
    '--mount', mount(specFile, '/work/' + specFile),
    '--mount', mount('scripts/f081/run-browser-container.mjs', '/work/scripts/f081/run-browser-container.mjs'),
    '--mount', `type=bind,source=${resultsDir},target=/results`,
    '-w', '/work', 'mcr.microsoft.com/playwright:v1.65.0-noble', 'node', 'scripts/f081/run-browser-container.mjs'],
  { cwd: root, stdio: 'inherit', shell: false });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} finally {
  for (const child of active.reverse()) await stop(child);
  for (const port of [3000, 5173]) await ensureFree(port);
  if (prepared) { const dropped = run(['scripts/f081/harness.mjs', 'drop']); if (dropped.status !== 0) process.exitCode = dropped.status ?? 1; }
  assert(logDir.startsWith(path.join(tmpdir(), 'farmafind f081 browser ')));
  rmSync(logDir, { recursive: true, force: true });
}
