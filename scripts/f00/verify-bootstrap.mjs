import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { browserEnvironment } from './browser-environment.mjs';
import { createReport, writeReport } from './report.mjs';
import { executionStates } from './report-states.mjs';
import { sourceManifest } from './source-manifest.mjs';
import { ensureFree } from './process-supervisor.mjs';
import { chromium } from '@playwright/test';

const root = fileURLToPath(new URL('../../', import.meta.url));
const index = process.argv.indexOf('--preparation');
const preparationId = index >= 0 ? process.argv[index + 1] : 'A';
if (!['A', 'B'].includes(preparationId)) throw new Error('--preparation debe ser A o B');
const source = sourceManifest(root);
const report = createReport({ preparationId, scope: 'complete', source, requirementIds: ['F00-FR-001', 'F00-FR-013', 'F00-FR-018', 'F00-SC-001', 'F00-SC-002', 'F00-SC-007', 'RUBRICA-05', 'RUBRICA-06', 'RUBRICA-07'] });
report.workingDirectory = createHash('sha256').update(root.toLowerCase()).digest('hex');
report.versions = { ...report.versions, npm: '11.13.0', vite: '7.3.8', vitest: '4.1.12' };
report.expected = ['grupo local passed', 'Playwright con DOM visible y separación completa', 'limpieza de procesos y captura técnica'];
const logDir = path.join(root, 'artifacts', 'f00', report.runId);
mkdirSync(logDir, { recursive: true });
const environment = browserEnvironment();
report.actual.push({ component: 'platform', result: `Windows build ${environment.windowsBuild}; compatible=${environment.compatible}; browserPrepared=${environment.browserPrepared}`, durationMs: 0 });
const controls = [];
if (!environment.compatible || !environment.browserPrepared) {
  controls.push({ id: 'platform', group: 'local', state: 'pending' }, { id: 'playwright-ui', group: 'complete', state: 'pending' });
  report.errors.push('Prerrequisito de navegador o plataforma pendiente; no se ejecutaron controles completos.');
} else {
  function run(label, args) {
    const started = new Date().toISOString();
    const result = spawnSync(process.execPath, args, { cwd: root, stdio: 'inherit', windowsHide: true });
    report.commands.push({ command: label, directory: 'repository-root', started, finished: new Date().toISOString(), exitCode: result.status ?? 1 });
    return result.status ?? 1;
  }
  const localExit = run('verify:local', ['scripts/f00/verify-local.mjs', '--preparation', preparationId]);
  controls.push({ id: 'local-controls', group: 'local', state: localExit === 0 ? 'passed' : 'failed' });
  if (localExit !== 0) report.errors.push('Controles locales fallaron; navegador no ejecutado.');
  else {
    const browserExit = run('playwright', ['node_modules/@playwright/test/cli.js', 'test', '--config', 'playwright.config.js']);
    controls.push({ id: 'playwright-ui', group: 'complete', state: browserExit === 0 ? 'passed' : 'failed' });
    if (browserExit !== 0) report.errors.push('Pruebas Playwright fallaron.');
    else {
      const browserVersion = spawnSync(chromium.executablePath(), ['--version'], { cwd: root, encoding: 'utf8', windowsHide: true });
      if (browserVersion.status === 0) report.versions.browser = browserVersion.stdout.trim();
      else { controls.push({ id: 'browser-version', group: 'complete', state: 'failed' }); report.errors.push('Versión de navegador no verificable.'); }
      function findCapture(directory) {
        if (!existsSync(directory)) return null;
        for (const item of readdirSync(directory, { withFileTypes: true })) {
          const file = path.join(directory, item.name);
          if (item.isDirectory()) { const found = findCapture(file); if (found) return found; }
          else if (item.name === 'bootstrap.png') return file;
        }
        return null;
      }
      const capture = findCapture(path.join(root, 'test-results'));
      if (capture) {
        mkdirSync(path.join(logDir, 'captures'), { recursive: true });
        copyFileSync(capture, path.join(logDir, 'captures', 'bootstrap.png'));
        report.artifacts = [{ kind: 'browser-capture', state: 'recorded', path: 'captures/bootstrap.png' }];
      } else { controls.push({ id: 'capture', group: 'complete', state: 'failed' }); report.errors.push('Captura técnica obligatoria ausente.'); }
    }
  }
}
report.cleanup = environment.compatible && environment.browserPrepared ? 'passed' : 'pending';
if (environment.compatible && environment.browserPrepared) {
  for (const port of [4173, 3000, 3001]) {
    try { await ensureFree(port); }
    catch { report.cleanup = 'failed'; report.errors.push(`Puerto ${port} ocupado tras controles completos`); }
  }
}
report.controls = controls;
Object.assign(report, executionStates(controls, 'complete'));
if (report.cleanup === 'failed') { report.controls.push({ id: 'cleanup', group: 'complete', state: 'failed' }); Object.assign(report, executionStates(report.controls, 'complete')); }
const target = writeReport(report, logDir);
console.log(`F00 complete: local=${report.local}, overall=${report.overall}, acceptance=${report.acceptance}`);
console.log(`Reporte: ${target}`);
process.exitCode = report.overall === 'passed' ? 0 : 1;
