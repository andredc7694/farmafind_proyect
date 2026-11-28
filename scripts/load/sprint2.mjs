// Lanza k6 (imagen grafana/k6:1.8.2) contra la copia temporal y guarda la evidencia. Nunca la DEMO (3000/5173).
//   node scripts/load/sprint2.mjs .cache/<copia> <etiqueta> [ramp|limit]
// Guarda en docs/sprint2/evidencias/k6/: resumen de k6, resultado por etapa y muestras de CPU/memoria cada 10 s.
import { execFile, spawn } from 'node:child_process';
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const run = promisify(execFile);
const root = fileURLToPath(new URL('../../', import.meta.url));
const [copy, label, mode = 'ramp'] = process.argv.slice(2);
if (!copy || !/^[a-z0-9-]+$/.test(label ?? '') || !['ramp', 'limit'].includes(mode)) {
  console.error('Uso: node scripts/load/sprint2.mjs .cache/<copia> <etiqueta> [ramp|limit]');
  process.exit(2);
}
const read = name => JSON.parse(readFileSync(path.resolve(copy, name), 'utf8'));
const { apiPid, apiPort } = read('processes.json');
if ([3000, 5173].includes(apiPort)) { console.error('k6 detenido: nunca contra la DEMO'); process.exit(1); }
const state = read('state.local.json');
const redisContainer = 'farmafind-s2-redis';
const out = path.join(root, 'docs/sprint2/evidencias/k6');
mkdirSync(out, { recursive: true });

const health = async () => {
  try { return (await fetch(`http://127.0.0.1:${apiPort}/health`, { signal: AbortSignal.timeout(5000) })).status; }
  catch { return 'sin respuesta'; }
};
const redisStats = async () => {
  const env = { ...process.env, REDISCLI_AUTH: decodeURIComponent(new URL(state.redisUrl).password) };
  const { stdout } = await run('docker', ['exec', '-e', 'REDISCLI_AUTH', redisContainer, 'redis-cli', 'INFO', 'stats'], { env });
  const value = key => Number(stdout.match(new RegExp(`${key}:(\\d+)`))?.[1] ?? 0);
  return { aciertos: value('keyspace_hits'), fallos: value('keyspace_misses') };
};

const samples = [];
const started = Date.now();
let sampling = false;
const sample = async () => {
  if (sampling) return;
  sampling = true;
  const t = Math.round((Date.now() - started) / 1000);
  try {
    const [stats, api] = await Promise.all([
      run('docker', ['stats', '--no-stream', '--format', '{{.Name}};{{.CPUPerc}};{{.MemUsage}}']),
      run('powershell', ['-NoProfile', '-Command', `$p=Get-Process -Id ${Number(apiPid)}; "$($p.TotalProcessorTime.TotalSeconds);$($p.WorkingSet64)"`]),
    ]);
    const [cpu, memory] = api.stdout.trim().split(';').map(v => Number(v.replace(',', '.')));
    samples.push({ t, apiCpuSegundos: cpu, apiMemoriaMB: Math.round(memory / 1048576),
      equipoMemoriaLibreMB: Math.round(os.freemem() / 1048576),
      contenedores: stats.stdout.trim().split('\n').map(line => line.split(';')) });
  } catch (error) { samples.push({ t, error: String(error.message).slice(0, 200) }); }
  sampling = false;
};

const before = { salud: await health(), redis: await redisStats() };
if (before.salud !== 200) { console.error(`La API de la copia no responde (${before.salud})`); process.exit(1); }
const timer = setInterval(sample, 10_000);
const k6 = spawn('docker', ['run', '--rm', '--name', 'farmafind-s2-k6', '--add-host=host.docker.internal:host-gateway',
  '-v', `${path.join(root, 'tests/load/sprint2-ramp.js')}:/script.js:ro`, '-v', `${out}:/out`,
  '-e', `MODE=${mode}`, '-e', `BASE_URL=http://host.docker.internal:${apiPort}`,
  'grafana/k6:1.8.2', 'run', '--quiet', '/script.js'], { cwd: root });
let log = '';
for (const stream of [k6.stdout, k6.stderr]) stream.on('data', chunk => { log = (log + chunk).slice(-60_000); });
const code = await new Promise(resolve => k6.on('close', resolve));
clearInterval(timer);

const after = { salud: await health(), redis: await redisStats() };
let summary;
try {
  renameSync(path.join(out, 'summary.json'), path.join(out, `${label}-k6.json`));
  summary = JSON.parse(readFileSync(path.join(out, `${label}-k6.json`), 'utf8'));
} catch { /* k6 no llegó a escribir el resumen */ }
const metric = name => summary?.metrics?.[name]?.values;
const round = value => value === undefined ? null : Math.round(value * 100) / 100;
const row = (suffix, seconds) => {
  const duration = metric(`http_req_duration${suffix}`);
  const count = metric(`http_reqs${suffix}`)?.count;
  const failed = metric(`http_req_failed${suffix}`)?.rate;
  return { peticiones: count ?? null, porSegundo: count === undefined || !seconds ? null : round(count / seconds),
    medianaMs: round(duration?.med), p95Ms: round(duration?.['p(95)']), p99Ms: round(duration?.['p(99)']), maxMs: round(duration?.max),
    errorPct: round(failed === undefined ? undefined : failed * 100) };
};
const result = {
  etiqueta: label, modo: mode, fecha: new Date(started).toISOString(), duracionSegundos: Math.round((Date.now() - started) / 1000),
  codigoSalidaK6: code, saludAntes: before.salud, saludDespues: after.salud,
  redis: { aciertos: after.redis.aciertos - before.redis.aciertos, fallos: after.redis.fallos - before.redis.fallos },
  total: row('', summary ? summary.state.testRunDurationMs / 1000 : 0),
  // Cada meseta dura 45 s con todos los usuarios activos.
  etapas: mode === 'ramp' ? Object.fromEntries([50, 250, 500, 1000, 2000].map(level => [level, row(`{etapa:${level}}`, 45)])) : undefined,
  respuestas429: metric('respuestas_429')?.count ?? 0,
  comprobaciones: summary?.root_group?.checks?.map(c => ({ nombre: c.name, bien: c.passes, mal: c.fails })),
};
writeFileSync(path.join(out, `${label}-resultado.json`), JSON.stringify(result, null, 2) + '\n');
writeFileSync(path.join(out, `${label}-recursos.json`), JSON.stringify(samples) + '\n');
writeFileSync(path.join(out, `${label}-salida.txt`), log.replace(/\u001b\[[0-9;]*m/g, ''));
console.log(JSON.stringify(result, null, 2));
process.exit(summary ? 0 : 1);
