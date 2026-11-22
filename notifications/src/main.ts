import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { createApp } from './app.js';
import { validateConfig,validateF05Config } from './config/index.js';
import {Pool} from 'pg';
import {PgEventRepository} from './events/repository.js';
import {ProcessEvent} from './events/process-event.js';
import {PgApplicationEventRepository} from './events/application-repository.js';

const file = new URL('../.env.local', import.meta.url);
let config;
try {
  const env=parseEnv(readFileSync(file,'utf8'));
  config = env.APP_MODE==='notifications'?validateF05Config(env,[5173,4173,3000]):validateConfig(env,[5173,4173,3000]);
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Configuración inválida');
  process.exitCode = 1;
  throw error;
}
const pool=config.mode==='notifications'?new Pool({connectionString:config.databaseUrl,max:4}):null;
const applicationTest=config.mode==='notifications'&&
  /^\/farmafind_f01_test_[a-f0-9]{12}$/.test(new URL(config.databaseUrl).pathname);
const retentionDays=Number(process.env.F025_NOTIFICATION_RETENTION_DAYS??'30');
if(applicationTest&&(!Number.isInteger(retentionDays)||retentionDays<1||retentionDays>365))
  throw new Error('F02.5: retención TEST inválida');
const events=config.mode==='notifications'?{processor:new ProcessEvent(new PgEventRepository(pool!),{now:()=>new Date()}),
  secret:config.hmacSecret,
  applicationRepository:applicationTest?new PgApplicationEventRepository(pool!,retentionDays):undefined}:undefined;
const server = createApp(events).listen(config.port, config.host, () => {
  console.log(`farmafind-notifications bootstrap: http://${config.host}:${config.port}/health`);
});
server.on('error', error => { console.error(`Notificaciones: ${error.message}`); process.exitCode = 1; });
const stop=()=>server.close(()=>void pool?.end());
process.on('SIGINT',stop);
process.on('SIGTERM',stop);
