/** Project check after F01/F02: retains F00 syntax and boundaries, permits approved business routes and PostgreSQL. */
import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { inspectArchitecture } from '../f00/check-architecture.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const files = [];
function collect(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (['node_modules','dist','.git'].includes(entry.name)) continue;
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) collect(full);
    else if (/\.(mjs|js|jsx)$/.test(entry.name)) files.push(full);
  }
}
for (const folder of ['scripts','frontend','tests']) collect(path.join(root, folder));
for (const file of files.filter(item => !item.endsWith('.jsx'))) {
  const result = spawnSync(process.execPath, ['--check',file], { cwd: root, stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
for (const workspace of ['backend','notifications']) {
  const result = spawnSync(process.execPath,
    [path.join(root,'node_modules/typescript/bin/tsc'),'--noEmit','-p',path.join(root,workspace,'tsconfig.json')],
    { cwd: root, stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
for (const workspace of ['backend','notifications']) {
  const source = readFileSync(path.join(root,workspace,'src/app.ts'),'utf8');
  if (/\b(from|require)\s*\(?['"](?:pg|redis|ioredis|@aws-sdk)/.test(source)) {
    throw new Error(`${workspace}/src/app.ts: integración directa no autorizada`);
  }
}
const issues = inspectArchitecture(root).filter(issue =>
  !issue.endsWith(': ruta de negocio fuera de F00') &&
  !issue.endsWith(': integración operativa fuera de F00'));
if (issues.length) { console.error(issues.join('\n')); process.exit(1); }
const forbidden = /(?:from\s*|require\s*\(|import\s*\(\s*)['"](?:redis|ioredis|@aws-sdk|openai)(?:['"/])/;
for (const workspace of ['backend','notifications']) {
  function visit(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(full);
      else if (entry.name.endsWith('.ts')) {
        const source = readFileSync(full,'utf8');
        if (forbidden.test(source)) throw new Error(`${path.relative(root,full)}: integración fuera del alcance F02`);
        if (full.replaceAll('\\','/').includes('/application/') &&
            /(?:from\s*|import\s*\(\s*)['"][^'"]*\/(?:infrastructure|presentation)\//.test(source)) {
          throw new Error(`${path.relative(root,full)}: aplicación depende de infraestructura o presentación`);
        }
      }
    }
  }
  visit(path.join(root,workspace,'src'));
}
console.log(`check F02: ${files.length} archivos JS, TypeScript estricto y límites modulares correctos`);
