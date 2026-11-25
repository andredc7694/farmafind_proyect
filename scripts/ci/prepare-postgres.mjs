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
console.log('Secreto efímero del runner preparado (no se imprime).');
