/** F06.1 local test runner. No external provider or database is started here. */
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

const mode = process.argv[2] ?? 'unit';
if (!['unit', 'api'].includes(mode)) throw new Error('Uso: node scripts/f061/check.mjs unit|api');
const files = ['backend/tests/assistant', 'frontend/tests/assistant']
  .flatMap(directory => readdirSync(directory).filter(name => name.startsWith('conversation') && /\.test\.(ts|jsx)$/.test(name))
    .map(name => join(directory, name)))
  .filter(path => mode === 'api' ? path.includes('.http.test.') : !path.includes('.http.test.'));
if (files.length === 0) throw new Error(`No hay pruebas F06.1 del grupo ${mode}; no se declara resultado satisfactorio.`);
const result = spawnSync(process.execPath, ['node_modules/vitest/vitest.mjs', 'run', ...files], { stdio: 'inherit', shell: false });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
