import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const excluded = new Set(['.git', '.agents', '.codex', '.cache', '.npm', '.aws', 'node_modules', 'dist', 'build', 'coverage', 'artifacts', 'docs', 'playwright-report', 'test-results', 'preparation.json']);
export function sourceManifest(root) {
  const files = [];
  function visit(dir, relative = '') {
    for (const name of readdirSync(dir).sort()) {
      if (excluded.has(name) || (name.startsWith('.env') && name !== '.env.example') || name.endsWith('.log')) continue;
      const rel = path.posix.join(relative.replaceAll('\\', '/'), name);
      const full = path.join(dir, name);
      if (statSync(full).isDirectory()) visit(full, rel);
      else files.push({ path: rel, hash: createHash('sha256').update(readFileSync(full)).digest('hex') });
    }
  }
  visit(root);
  const hash = createHash('sha256').update(JSON.stringify(files)).digest('hex');
  return { hash, lockfileHash: files.find(file => file.path === 'package-lock.json')?.hash ?? null, files };
}
