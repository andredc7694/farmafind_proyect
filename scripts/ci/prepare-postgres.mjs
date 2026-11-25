/**
 * CI (spec 019): genera el secreto ALEATORIO del PostgreSQL efímero del runner y lo guarda en .cache/ (ignorado por Git),
 * donde los scripts de prueba existentes lo esperan. No es un secreto del repositorio y nunca se imprime:
 * solo se registra con ::add-mask:: para que GitHub lo oculte si aparece por error.
 */
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

if (process.env.GITHUB_ACTIONS !== 'true') {
  console.error('scripts/ci/prepare-postgres.mjs solo se ejecuta dentro de GitHub Actions (no sobrescribe secretos locales).');
  process.exit(1);
}
const dir = path.join(process.cwd(), '.cache/f01-docker');
const file = path.join(dir, 'postgres-password.txt');
if (existsSync(file)) { console.error('El secreto ya existe; no se sobrescribe.'); process.exit(1); }
const secret = randomBytes(32).toString('hex');
console.log(`::add-mask::${secret}`);
mkdirSync(dir, { recursive: true });
writeFileSync(file, `${secret}\n`, { mode: 0o600 });
// Los scripts de fixture F03 también leen el secreto de Redis (no se usa Redis en este job; valor aleatorio y efímero).
const redisDir = path.join(process.cwd(), '.cache/f03-docker');
const redisSecret = randomBytes(32).toString('hex');
console.log(`::add-mask::${redisSecret}`);
mkdirSync(redisDir, { recursive: true });
writeFileSync(path.join(redisDir, 'redis-password.txt'), `${redisSecret}
`, { mode: 0o600 });
console.log('Secretos efímeros del runner preparados (no se imprimen).');
