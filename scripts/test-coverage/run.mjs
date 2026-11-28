// Cobertura de pruebas (Sprint 2 IS-488). Corre las mismas suites sin base de datos que el CI
// (unitarias y de API con dobles F01–F07, más el frontend), guarda un informe parcial por suite
// y los fusiona en coverage/ (HTML en coverage/index.html, lcov y resumen JSON).
// No usa PostgreSQL, Redis ni puertos de la DEMO.
import { mkdirSync, readFileSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const blobs = path.join(root, '.vitest-reports');
const vitest = path.join(root, 'node_modules/vitest/vitest.mjs');
export const suites = [
  ['f01', 'unit'], ['f02', 'unit'], ['f03', 'unit'], ['f04', 'unit'], ['f05', 'unit'], ['f06', 'unit'],
  ['f061', 'unit'], ['f07', 'unit'], ['f01', 'api'], ['f04', 'api'], ['f05', 'api'], ['f06', 'api'], ['f061', 'api'],
];

rmSync(blobs, { recursive: true, force: true });
rmSync(path.join(root, 'coverage'), { recursive: true, force: true });
mkdirSync(blobs, { recursive: true });

function run(label, args, blob) {
  console.log(`\n== ${label} ==`);
  const env = { ...process.env, FARMAFIND_COVERAGE_BLOB: blob };
  const result = spawnSync(process.execPath, args, { cwd: root, env, stdio: 'inherit' });
  if (result.status !== 0) {
    console.error(`Cobertura: falló ${label}; no se genera informe.`);
    process.exit(result.status ?? 1);
  }
}

suites.forEach(([phase, mode], index) => {
  run(`${phase} ${mode}`, [path.join(root, `scripts/${phase}/check.mjs`), mode], path.join(blobs, `blob-${index}.json`));
});
run('frontend', [vitest, 'run', 'frontend/tests/', '--exclude', '**/*.spec.js'], path.join(blobs, 'blob-frontend.json'));

console.log('\n== fusión de cobertura ==');
const merged = spawnSync(process.execPath, [vitest, '--merge-reports', blobs, '--coverage.enabled', '--reporter=dot'], {
  cwd: root, env: { ...process.env, FARMAFIND_COVERAGE_BLOB: '' }, stdio: 'inherit',
});
if (merged.status !== 0) {
  console.error('Cobertura: la fusión de informes falló.');
  process.exit(merged.status ?? 1);
}
const total = JSON.parse(readFileSync(path.join(root, 'coverage/coverage-summary.json'), 'utf8')).total;
const pct = key => `${total[key].pct}% (${total[key].covered}/${total[key].total})`;
console.log(`\nCobertura total — líneas ${pct('lines')} · sentencias ${pct('statements')} · funciones ${pct('functions')} · ramas ${pct('branches')}`);
console.log('Informe HTML: coverage/index.html');
