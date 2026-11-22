import { existsSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const testsDir = path.join(root, 'backend/tests/identity');
const groups = {
  unit: name => name.endsWith('.unit.test.ts'),
  api: name => name.endsWith('.http.test.ts') || [
    'data-minimization.test.ts',
    'global-authorization.test.ts',
  ].includes(name),
  rls: name => name.endsWith('.rls.test.ts') || [
    'migrations.test.ts',
    'tenant-transaction.test.ts',
    'membership-isolation.test.ts',
    'pool-isolation.test.ts',
    'rls-direct.test.ts',
  ].includes(name),
};

const mode = process.argv[2];
if (mode === '--list') {
  console.log('F01: unit, api, rls; requieren archivos de prueba F01 antes de ejecutarse');
  process.exit(0);
}
if (!Object.hasOwn(groups, mode)) {
  console.error('Uso: node scripts/f01/check.mjs <unit|api|rls|--list>');
  process.exit(2);
}
if (!existsSync(testsDir)) {
  console.error(`F01 ${mode}: faltan pruebas en backend/tests/identity; no se declara éxito`);
  process.exit(1);
}
const allTests = readdirSync(testsDir).filter(name => name.endsWith('.test.ts'));
const uncategorized = allTests.filter(name => !Object.values(groups).some(select => select(name)));
if (uncategorized.length > 0) {
  console.error(`F01: pruebas sin grupo unit/api/rls: ${uncategorized.join(', ')}`);
  process.exit(1);
}
const files = allTests.filter(groups[mode]).sort();
if (files.length === 0) {
  console.error(`F01 ${mode}: no existen pruebas del grupo; no se declara éxito`);
  process.exit(1);
}
if (mode === 'api' && !files.some(name => name.endsWith('.http.test.ts'))) {
  console.error('F01 api: faltan pruebas de contrato HTTP; las pruebas de proyección no acreditan la API');
  process.exit(1);
}
if (mode === 'rls' && !process.env.F01_TEST_DATABASE_URL) {
  console.error('F01 rls: falta F01_TEST_DATABASE_URL de una base PostgreSQL de prueba autorizada');
  process.exit(1);
}

const vitest = path.join(root, 'node_modules/vitest/vitest.mjs');
const result = spawnSync(process.execPath, [vitest, 'run', ...files.map(name => path.join(testsDir, name))], {
  cwd: root,
  env: process.env,
  stdio: 'inherit',
});
if (result.error) {
  console.error(`F01 ${mode}: no se pudo iniciar Vitest: ${result.error.message}`);
  process.exit(1);
}
process.exit(result.status ?? 1);
