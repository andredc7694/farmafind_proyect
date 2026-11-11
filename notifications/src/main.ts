import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { createApp } from './app.js';
import { validateConfig } from './config/index.js';

const file = new URL('../.env.local', import.meta.url);
let config;
try {
  config = validateConfig(parseEnv(readFileSync(file, 'utf8')), [5173, 4173, 3000]);
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Configuración inválida');
  process.exitCode = 1;
  throw error;
}
const server = createApp().listen(config.port, config.host, () => {
  console.log(`farmafind-notifications bootstrap: http://${config.host}:${config.port}/health`);
});
server.on('error', error => { console.error(`Notificaciones: ${error.message}`); process.exitCode = 1; });
process.on('SIGINT', () => server.close());
process.on('SIGTERM', () => server.close());
