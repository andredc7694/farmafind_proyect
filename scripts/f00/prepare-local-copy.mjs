import { copyFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sourceManifest } from './source-manifest.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const preparationId = process.argv[2];
if (!['A', 'B'].includes(preparationId)) throw new Error('Preparación debe ser A o B');
const source = sourceManifest(root);
if (!source.lockfileHash) throw new Error('Lockfile ausente');
const base = path.resolve(root, 'artifacts', 'f00', 'preparations', source.hash.slice(0, 16));
const target = path.resolve(base, `Preparation ${preparationId}`);
if (!target.startsWith(base + path.sep) || existsSync(target)) throw new Error('Destino de preparación inseguro o existente');
mkdirSync(target, { recursive: true });
for (const file of source.files) {
  const destination = path.resolve(target, file.path);
  if (!destination.startsWith(target + path.sep)) throw new Error('Ruta de fuente insegura');
  mkdirSync(path.dirname(destination), { recursive: true });
  copyFileSync(path.join(root, file.path), destination);
}
for (const workspace of ['frontend', 'backend', 'notifications']) {
  copyFileSync(path.join(target, workspace, '.env.example'), path.join(target, workspace, '.env.local'));
}
const manifest = sourceManifest(target);
if (manifest.hash !== source.hash || manifest.lockfileHash !== source.lockfileHash) throw new Error('Copia distinta de la fuente');
writeFileSync(path.join(target, 'preparation.json'), JSON.stringify({ preparationId, sourceHash: source.hash, lockfileHash: source.lockfileHash, kind: 'local-copy', status: 'prepared' }, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ preparationId, sourceHash: source.hash, lockfileHash: source.lockfileHash, relativeDirectory: path.relative(root, target).replaceAll('\\', '/') }));
