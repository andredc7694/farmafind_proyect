import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ensureFree, launch, stop } from './process-supervisor.mjs';
import { waitForHttp, healthCheck } from './http-checks.mjs';
import { sourceManifest } from './source-manifest.mjs';
import { createReport, writeReport } from './report.mjs';
import { executionStates } from './report-states.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const index = process.argv.indexOf('--preparation');
const preparationId = index >= 0 ? process.argv[index + 1] : 'A';
if (!['A', 'B'].includes(preparationId)) throw new Error('--preparation debe ser A o B');
const source = sourceManifest(root);
const report = createReport({ preparationId, scope: 'local', source, requirementIds: ['F00-FR-001', 'F00-FR-002', 'F00-FR-005', 'F00-FR-006', 'F00-FR-013', 'F00-FR-018', 'F00-SC-002', 'F00-SC-007'] });
const logDir = path.join(root, 'artifacts', 'f00', report.runId);
mkdirSync(logDir, { recursive: true });
const children = [];
const ports = [4173, 3000, 3001];
const checks = [];
let interrupted = false;
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { interrupted = true; for (const child of children) stop(child).catch(() => {}); });

function run(command, args) {
  if (interrupted) throw new Error('Verificación interrumpida');
  const started = new Date().toISOString();
  const result = spawnSync(process.execPath, args, { cwd: root, stdio: 'inherit', windowsHide: true });
  const code = result.status ?? 1;
  report.commands.push({ command, directory: 'repository-root', started, finished: new Date().toISOString(), exitCode: code });
  if (code !== 0) throw new Error(`${command}: código ${code}`);
  checks.push({ id: command, group: 'local', state: 'passed' });
}

try {
  const npmVersion = spawnSync(path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'cmd.exe'), ['/d', '/s', '/c', 'npm.cmd --version'], { cwd: root, encoding: 'utf8', windowsHide: true });
  if (npmVersion.status !== 0) throw new Error('No se pudo observar la versión de npm');
  const viteVersion = JSON.parse(readFileSync(path.join(root, 'node_modules/vite/package.json'), 'utf8')).version;
  const vitestVersion = JSON.parse(readFileSync(path.join(root, 'node_modules/vitest/package.json'), 'utf8')).version;
  report.versions = { ...report.versions, npm: npmVersion.stdout.trim(), vite: viteVersion, vitest: vitestVersion };
  report.expected = ['check, check:config, test:base, build pasan', 'tres HTTP locales identificables', 'procesos independientes y limpieza'];
  if (process.platform !== 'win32') throw new Error('verify:local F00 requiere Windows');
  if (!source.lockfileHash) throw new Error('package-lock.json ausente');
  for (const workspace of ['frontend', 'backend', 'notifications']) {
    if (!existsSync(path.join(root, workspace, '.env.local'))) throw new Error(`${workspace}/.env.local ausente; copiar ejemplo ficticio propio`);
  }
  run('check', ['scripts/f00/check.mjs']);
  run('check:config', ['scripts/f00/check-config.mjs']);
  run('test:base', ['node_modules/vitest/vitest.mjs', 'run']);
  run('build', ['scripts/f00/build.mjs']);
  for (const port of ports) await ensureFree(port);

  const components = [
    { id: 'frontend', args: ['node_modules/vite/bin/vite.js', 'preview', 'frontend', '--config', 'frontend/vite.config.js', '--host', '127.0.0.1', '--port', '4173', '--strictPort'], url: 'http://127.0.0.1:4173/', service: null },
    { id: 'api', args: ['backend/dist/main.js'], url: 'http://127.0.0.1:3000/health', service: 'farmafind-api' },
    { id: 'notifications', args: ['notifications/dist/main.js'], url: 'http://127.0.0.1:3001/health', service: 'farmafind-notifications' },
  ];
  const active = new Map();
  async function assertComponent(component) {
    if (component.service) await healthCheck(component.url, component.service);
    else {
      const response = await fetch(component.url, { signal: AbortSignal.timeout(5000) });
      const html = await response.text();
      if (response.status !== 200 || !html.includes('FarmaFind') || !html.includes('/assets/')) throw new Error('HTML frontend incorrecto');
    }
  }
  async function startComponent(component) {
    if (interrupted) throw new Error('Verificación interrumpida');
    const started = Date.now();
    const child = launch({ id: component.id, args: component.args.map(arg => arg.includes('/') && !arg.startsWith('--') ? path.join(root, arg) : arg), logDir });
    children.push(child);
    active.set(component.id, child);
    await waitForHttp(component.url, child, 60000);
    await assertComponent(component);
    checks.push({ id: component.id, group: 'local', state: 'passed' });
    report.actual.push({ component: component.id, pid: child.pid, result: 'HTTP 200', durationMs: Date.now() - started });
    return child;
  }
  for (const component of components) await startComponent(component);
  for (const component of components) {
    await stop(active.get(component.id));
    await ensureFree(Number(new URL(component.url).port));
    for (const other of components.filter(c => c.id !== component.id)) await assertComponent(other);
    await startComponent(component);
    report.actual.push({ component: component.id, result: 'parada/reinicio independiente; otros dos HTTP correctos' });
  }
  checks.push({ id: 'separacion', group: 'local', state: 'passed' });
  report.actual.push({ component: 'separacion', result: 'tres paradas y reinicios independientes; React en navegador pendiente' });
} catch (error) {
  checks.push({ id: 'ejecucion', group: 'local', state: 'failed' });
  report.errors.push(error instanceof Error ? error.message : 'Fallo desconocido');
} finally {
  for (const child of children.reverse()) {
    try { await stop(child); } catch (error) { checks.push({ id: 'cleanup', group: 'local', state: 'failed' }); report.errors.push(error.message); }
  }
  for (const port of ports) {
    try { await ensureFree(port); } catch (error) { checks.push({ id: 'cleanup', group: 'local', state: 'failed' }); report.errors.push(error.message); }
  }
  report.cleanup = checks.some(c => c.id === 'cleanup') ? 'failed' : 'passed';
  report.controls = checks.concat({ id: 'playwright-ui', group: 'complete', state: 'pending' });
  Object.assign(report, executionStates(report.controls, 'local'));
  report.artifacts.push({ kind: 'process-logs', state: 'recorded', directory: 'this-run' });
  const target = writeReport(report, logDir);
  console.log(`F00 local=${report.local}, overall=${report.overall}, acceptance=${report.acceptance}`);
  console.log(`Reporte: ${target}`);
  if (report.errors.length) console.error(report.errors.join('\n'));
  process.exitCode = report.local === 'passed' ? 0 : 1;
}
