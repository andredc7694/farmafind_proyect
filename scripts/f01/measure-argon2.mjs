/**
 * F01.1 T054 — costo de verificación Argon2id con los MISMOS parámetros que F01 (argon2-password.ts):
 * argon2id, memoria 64 MiB, 3 pasadas, 1 hilo. Sin base de datos ni red; solo claves ficticias.
 * Mide, en un proceso limpio: un hash, una verificación correcta, una incorrecta y N verificaciones concurrentes
 * (el login verifica una o dos veces: clave definitiva y, si falla, clave temporal ficticia/real).
 * No define umbrales: solo registra lo medido.
 * Uso: node scripts/f01/measure-argon2.mjs [repeticiones=10]
 */
import { performance } from 'node:perf_hooks';
import { cpus, totalmem } from 'node:os';
import argon2 from 'argon2';

const parameters = { type: argon2.argon2id, memoryCost: 65536, timeCost: 3, parallelism: 1 };
const runs = Math.max(3, Number(process.argv[2] ?? 10));
const stat = values => {
  const sorted = [...values].sort((a, b) => a - b);
  const at = fraction => sorted[Math.min(sorted.length - 1, Math.floor(fraction * sorted.length))];
  return { n: sorted.length, min: sorted[0], mediana: at(0.5), p95: at(0.95), max: sorted[sorted.length - 1],
    media: sorted.reduce((sum, value) => sum + value, 0) / sorted.length };
};
const ms = value => `${value.toFixed(1)} ms`;
const row = (label, s) => `| ${label} | ${s.n} | ${ms(s.min)} | ${ms(s.mediana)} | ${ms(s.p95)} | ${ms(s.max)} |`;
async function timed(work) { const start = performance.now(); await work(); return performance.now() - start; }

const secret = 'clave-ficticia-medicion-123';
const heapBefore = process.memoryUsage().rss;
const hash = await argon2.hash(secret, parameters); // calentamiento + hash de referencia
const hashing = []; const verifyOk = []; const verifyBad = [];
for (let i = 0; i < runs; i++) hashing.push(await timed(() => argon2.hash(secret + i, parameters)));
for (let i = 0; i < runs; i++) verifyOk.push(await timed(() => argon2.verify(hash, secret)));
for (let i = 0; i < runs; i++) verifyBad.push(await timed(() => argon2.verify(hash, 'incorrecta-' + i)));
// Login con clave temporal: dos verificaciones seguidas (definitiva + temporal).
const doubleLogin = [];
for (let i = 0; i < runs; i++) doubleLogin.push(await timed(async () => { await argon2.verify(hash, 'x' + i); await argon2.verify(hash, secret); }));
// Concurrencia: varias verificaciones a la vez (el pool de libuv tiene 4 hilos por defecto).
const concurrent = [];
for (const width of [4, 8]) {
  const wall = await timed(() => Promise.all(Array.from({ length: width }, () => argon2.verify(hash, secret))));
  concurrent.push([width, wall]);
}
const rssPeak = process.memoryUsage().rss;

console.log(`# Medición Argon2id F01.1 (${new Date().toISOString().slice(0, 10)})`);
console.log(`Parámetros: argon2id, memoria ${parameters.memoryCost / 1024} MiB, ${parameters.timeCost} pasadas, ${parameters.parallelism} hilo.`);
console.log(`Equipo: ${cpus().length} CPU lógicas (${cpus()[0]?.model.trim()}), ${(totalmem() / 2 ** 30).toFixed(1)} GiB RAM, Node ${process.version}, ${runs} repeticiones por caso.\n`);
console.log('| Operación | n | mín | mediana | p95 | máx |\n|---|---|---|---|---|---|');
console.log(row('hash (cambio de clave / alta)', stat(hashing)));
console.log(row('verificación correcta (login)', stat(verifyOk)));
console.log(row('verificación incorrecta (login fallido)', stat(verifyBad)));
console.log(row('login con 2 verificaciones (definitiva + temporal)', stat(doubleLogin)));
for (const [width, wall] of concurrent) console.log(`\n${width} verificaciones concurrentes: ${ms(wall)} en total (${ms(wall / width)} por verificación en promedio).`);
console.log(`\nRSS del proceso: ${((heapBefore) / 2 ** 20).toFixed(0)} MiB antes → ${(rssPeak / 2 ** 20).toFixed(0)} MiB tras las mediciones.`);
console.log('Sin umbrales definidos: son valores medidos en este equipo, no objetivos.');
