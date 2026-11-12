import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { Pool } from 'pg';
import { createLocalIdentityApp } from '../../backend/dist/identity-app.js';
import { validateLocalIdentityRuntime } from '../../backend/dist/config/identity-runtime.js';

async function main() {
  const env = parseEnv(readFileSync(new URL('../../backend/.env.f01.local', import.meta.url), 'utf8'));
  const config = validateLocalIdentityRuntime(env);
  const identity = await createLocalIdentityApp(config, url => new Pool({ connectionString: url, max: 4 }));
  const server = identity.app.listen(3000, '127.0.0.1', () => {
    console.log('F01 API local: http://127.0.0.1:3000/health');
  });
  server.on('error', async () => { await identity.close(); process.exitCode = 1; });
  let closing = false;
  const stop = () => {
    if (closing) return;
    closing = true;
    server.close(() => { void identity.close(); });
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}

main().catch(() => {
  console.error('F01: configuración local o conexión PostgreSQL inválida');
  process.exitCode = 1;
});
