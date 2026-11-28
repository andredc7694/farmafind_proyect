// Ejecuta la colección Postman con newman contra la copia temporal (nunca la DEMO 3000/5173).
//   node scripts/postman/run.mjs .cache/<copia>/state.local.json
// Las credenciales ficticias de la copia se pasan como variables en memoria; los reportes (texto y JUnit) no las incluyen.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const statePath = process.argv[2];
if (!statePath) { console.error('Uso: node scripts/postman/run.mjs .cache/<copia>/state.local.json'); process.exit(2); }
const state = JSON.parse(readFileSync(path.resolve(statePath), 'utf8'));
const baseUrl = process.env.FARMAFIND_POSTMAN_BASE_URL ?? 'http://127.0.0.1:3001';
const port = new URL(baseUrl).port;
if (['3000', '5173'].includes(port) || !['127.0.0.1', 'localhost'].includes(new URL(baseUrl).hostname)) {
  console.error('Postman detenido: solo la copia temporal local, nunca los puertos de la DEMO.');
  process.exit(1);
}
const out = path.join(root, 'docs/sprint2/evidencias/postman');
mkdirSync(out, { recursive: true });
const newman = process.env.NEWMAN_BIN ?? 'newman';
const result = spawnSync(newman, ['run', path.join(root, 'tests/postman/farmafind-sprint2.postman_collection.json'),
  '-e', path.join(root, 'tests/postman/copia-local.postman_environment.json'),
  '--env-var', `baseUrl=${baseUrl}`, '--env-var', `ownerEmail=${state.credentials.dueno.email}`,
  '--env-var', `ownerPassword=${state.credentials.dueno.password}`,
  '-r', 'cli,junit', '--reporter-junit-export', path.join(out, 'newman-junit.xml'), '--color', 'off', '--disable-unicode'],
{ cwd: root, encoding: 'utf8', shell: process.platform === 'win32' });
const scrub = value => value.replace(/\u001b\[[0-9;]*m/g, '').replaceAll(state.credentials.dueno.email, '<correo-ficticio>').replaceAll(state.credentials.dueno.password, '<clave>');
const text = scrub(`${result.stdout ?? ''}${result.stderr ?? ''}`);
const junit = path.join(out, 'newman-junit.xml');
try { writeFileSync(junit, scrub(readFileSync(junit, 'utf8'))); } catch { /* sin JUnit si newman no llegó a correr */ }
writeFileSync(path.join(out, 'newman-resumen.txt'), `Ejecutado ${new Date().toISOString()} contra ${baseUrl} (copia TEST)\n\n${text}`);
console.log(text.split('\n').slice(-40).join('\n'));
process.exit(result.status ?? 1);
