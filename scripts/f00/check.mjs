import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const base = fileURLToPath(new URL('../../', import.meta.url));
const files = [];
function collect(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', 'dist', '.git'].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) collect(full);
    else if (/\.(mjs|js|jsx)$/.test(entry.name)) files.push(full);
  }
}
for (const folder of ['scripts', 'frontend', 'tests']) collect(path.join(base, folder));
for (const file of files.filter(f => !f.endsWith('.jsx'))) {
  const result = spawnSync(process.execPath, ['--check', file], { cwd: base, stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status || 1);
}
for (const workspace of ['backend', 'notifications']) {
  const result = spawnSync(process.execPath, [path.join(base, 'node_modules/typescript/bin/tsc'), '--noEmit', '-p', path.join(base, workspace, 'tsconfig.json')], { cwd: base, stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status || 1);
}
for (const workspace of ['backend', 'notifications']) {
  const src = readFileSync(path.join(base, workspace, 'src/app.ts'), 'utf8');
  if (/\b(from|require)\s*\(?['"](?:pg|redis|ioredis|@aws-sdk)/.test(src)) throw new Error(`Integración operativa imprevista en ${workspace}`);
}
const architecture = spawnSync(process.execPath, [path.join(base, 'scripts/f00/check-architecture.mjs')], { cwd: base, stdio: 'inherit' });
if (architecture.status !== 0) process.exit(architecture.status ?? 1);
console.log(`check: ${files.length} archivos JS, TypeScript estricto y imports iniciales correctos`);
