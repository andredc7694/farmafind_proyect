// Swagger UI navegable con todos los contratos OpenAPI de specs/*/contracts (Sprint 2 IS-488).
// Usa la imagen oficial swaggerapi/swagger-ui en http://127.0.0.1:8088, con los contratos montados en solo lectura.
// No toca el código, la DEMO (3000/5173) ni ninguna base de datos.
//   node scripts/swagger/start.mjs        → enciende
//   node scripts/swagger/start.mjs stop   → apaga (el contenedor se borra solo al detenerse)
import { readdirSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const IMAGE = 'swaggerapi/swagger-ui:v5.34.1';
const NAME = 'farmafind-swagger-ui';
const PORT = 8088;

const docker = (...args) => spawnSync('docker', args, { encoding: 'utf8' });

if (process.argv[2] === 'stop') {
  const r = docker('stop', NAME);
  console.log(r.status === 0 ? 'Swagger UI apagado.' : 'Swagger UI no estaba encendido.');
  process.exit(0);
}

function listContracts(base = root) {
  const specs = path.join(base, 'specs');
  return readdirSync(specs).sort().flatMap(dir => {
    const contracts = path.join(specs, dir, 'contracts');
    if (!existsSync(contracts)) return [];
    return readdirSync(contracts).filter(f => /\.ya?ml$/.test(f)).sort()
      .map(file => ({ name: `${dir.replace(/^\d+-/, '')} · ${file.replace(/\.openapi\.ya?ml$/, '')}`, url: `./specs/${dir}/contracts/${file}` }));
  });
}

const free = await new Promise(resolve => {
  const s = net.createServer().once('error', () => resolve(false)).once('listening', () => s.close(() => resolve(true)));
  s.listen(PORT, '127.0.0.1');
});
if (!free) {
  console.error(`El puerto ${PORT} está ocupado; no se enciende Swagger UI.`);
  process.exit(1);
}

const urls = listContracts();
const result = docker('run', '-d', '--rm', '--name', NAME, '-p', `127.0.0.1:${PORT}:8080`,
  '-v', `${path.join(root, 'specs')}:/usr/share/nginx/html/specs:ro`,
  '-e', `URLS=${JSON.stringify(urls)}`, '-e', 'URLS_PRIMARY_NAME=' + urls[0].name,
  '-e', 'DOC_EXPANSION=list', IMAGE);
if (result.status !== 0) {
  console.error(result.stderr.trim());
  process.exit(1);
}
console.log(`Swagger UI con ${urls.length} contratos en http://127.0.0.1:${PORT}/ (elegir el contrato arriba a la derecha).`);
