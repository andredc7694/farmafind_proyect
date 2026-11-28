/** Enciende una copia temporal de revisión (API + web) tras comprobar los puertos.
 *  Uso: node scripts/copy/start-copy.mjs .cache/<copia> [--api-port 3001] [--web-port 5174]
 *  No usar `npm run dev` para una copia: ese comando fija el puerto 5173 de la DEMO. */
import { spawn } from 'node:child_process';
import { existsSync, openSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { assertCopyPort, assertPortFree, COPY_DEFAULTS, CopyPortError } from './ports.mjs';

const repository = path.resolve(fileURLToPath(new URL('../../', import.meta.url)));

async function main() {
  const { values, positionals } = parseArgs({ allowPositionals: true,
    options: { 'api-port': { type: 'string' }, 'web-port': { type: 'string' } } });
  // Los puertos se revisan antes que nada.
  const apiPort = assertCopyPort(values['api-port'] ?? COPY_DEFAULTS.apiPort, 'la API');
  const webPort = assertCopyPort(values['web-port'] ?? COPY_DEFAULTS.webPort, 'la web');
  if (apiPort === webPort) throw new CopyPortError('Copia temporal detenida: la API y la web no pueden usar el mismo puerto.');
  await assertPortFree(apiPort, 'la API');
  await assertPortFree(webPort, 'la web');

  if (positionals.length !== 1) throw new Error('Indica la carpeta de la copia, por ejemplo .cache/f062-copy');
  const directory = path.resolve(positionals[0]);
  const serve = path.join(directory, 'serve.mjs');
  if (!existsSync(serve)) throw new Error(`No existe ${serve}`);
  if (!readFileSync(serve, 'utf8').includes('copyApiPort(')) {
    throw new Error('Copia temporal detenida: su serve.mjs debe tomar el puerto con copyApiPort() de scripts/copy/ports.mjs.');
  }

  const vite = [path.join(repository, 'node_modules/vite/bin/vite.js'), path.join(repository, 'frontend/node_modules/vite/bin/vite.js')]
    .find(existsSync);
  if (!vite) throw new Error('No se encontró Vite; instala las dependencias.');
  const start = (name, args, cwd, env) => {
    const child = spawn(process.execPath, args, { cwd, env: { ...process.env, ...env }, detached: true, windowsHide: true,
      stdio: ['ignore', openSync(path.join(directory, `${name}.log`), 'w'), openSync(path.join(directory, `${name}.err.log`), 'w')] });
    child.unref();
    return child.pid;
  };
  const apiPid = start('api', [serve], repository, { FARMAFIND_COPY_API_PORT: String(apiPort) });
  const webPid = start('web', [vite], path.join(repository, 'frontend'),
    { VITE_APP_MODE: 'bootstrap', FARMAFIND_DEV_WEB_PORT: String(webPort), FARMAFIND_DEV_API_PORT: String(apiPort) });
  writeFileSync(path.join(directory, 'processes.json'), JSON.stringify({ apiPid, webPid, apiPort, webPort }, null, 2));
  console.log(`Copia temporal iniciada: web http://localhost:${webPort}/ · API 127.0.0.1:${apiPort} (procesos ${apiPid} y ${webPid}).`);
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
