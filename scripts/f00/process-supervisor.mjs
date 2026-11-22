import { spawn, spawnSync } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import net from 'node:net';
import path from 'node:path';
const owned = new WeakSet();

export function isOwned(child) { return owned.has(child); }

export async function ensureFree(port) {
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Puerto inválido');
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once('error', () => reject(new Error(`Puerto ${port} ocupado`)));
    server.listen(port, '127.0.0.1', resolve);
  });
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
}

export function launch({ id, args, env = {}, logDir }) {
  if (!/^[a-z0-9-]+$/.test(id) || !Array.isArray(args) || !args.length) throw new Error('Lanzamiento inválido');
  const output = createWriteStream(path.join(logDir, `${id}.log`), { flags: 'a' });
  const child = spawn(process.execPath, args, {
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { SystemRoot: process.env.SystemRoot, WINDIR: process.env.WINDIR, PATH: process.env.PATH, TEMP: process.env.TEMP, TMP: process.env.TMP, ...env },
  });
  owned.add(child);
  child.stdout.pipe(output, { end: false });
  child.stderr.pipe(output, { end: false });
  child.once('close', () => output.end());
  return child;
}

export async function stop(child, timeout = 10000) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  if (!owned.has(child) || !Number.isInteger(child.pid)) throw new Error('Proceso no pertenece al supervisor');
  const closed = new Promise(resolve => child.once('close', resolve));
  child.kill('SIGTERM');
  let timer;
  try {
    await Promise.race([closed, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Limpieza excedió 10 s')), Math.min(timeout, 8000)); })]);
  } catch (error) {
    if (timeout < 1000 || process.platform !== 'win32' || child.exitCode !== null || child.signalCode !== null) throw error;
    const tree = spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, encoding: 'utf8' });
    if (tree.status !== 0) throw error;
    clearTimeout(timer);
    await Promise.race([closed, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Limpieza de descendientes excedió 10 s')), Math.max(1, timeout - 8000)); })]);
  } finally {
    clearTimeout(timer);
  }
}
