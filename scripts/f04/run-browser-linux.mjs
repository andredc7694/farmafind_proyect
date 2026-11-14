import { spawnSync } from 'node:child_process';

const image = 'mcr.microsoft.com/playwright:v1.65.0-noble';
const workspace = process.cwd();
const result = spawnSync('docker', [
  'run', '--rm',
  '--add-host=host.docker.internal:host-gateway',
  '-e', 'F04_E2E_CONTAINER=1',
  '-v', `${workspace}:/work`,
  '-w', '/work',
  image,
  'node', 'scripts/f04/run-browser-container.mjs',
], { stdio: 'inherit', shell: false });

if (result.error) {
  console.error(`No se pudo iniciar Docker: ${result.error.message}`);
  process.exit(1);
}
process.exit(result.status ?? 1);
