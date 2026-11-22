import { it, expect } from 'vitest';
import net from 'node:net';
import { mkdtempSync, copyFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { launch, stop, ensureFree } from '../../scripts/f00/process-supervisor.mjs';
import { waitForHttp, healthCheck } from '../../scripts/f00/http-checks.mjs';
import { aggregate } from '../../scripts/f00/report-states.mjs';

async function freePort() {
  const server = net.createServer(); await new Promise(r => server.listen(0, '127.0.0.1', r));
  const port = server.address().port; await new Promise(r => server.close(r)); return port;
}
it('colisión y servidor incorrecto fallan; limpieza solo del proceso propio, ruta con espacios', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'farmafind process '));
  const fixture = path.join(dir, 'listener with spaces.mjs');
  copyFileSync('tests/fixtures/processes/listener.mjs', fixture);
  const port = await freePort(); let child;
  try {
    child = launch({ id: 'fixture', args: [fixture, String(port)], env: {}, logDir: dir });
    await waitForHttp(`http://127.0.0.1:${port}/health`, child, 5000);
    await expect(ensureFree(port)).rejects.toThrow('ocupado');
    await expect(healthCheck(`http://127.0.0.1:${port}/health`, 'farmafind-api')).rejects.toThrow('identidad');
    expect((await fetch(`http://127.0.0.1:${port}/health`)).status).toBe(200);
    await stop(child); child = undefined;
    await expect(ensureFree(port)).resolves.toBeUndefined();
    await expect(waitForHttp(`http://127.0.0.1:${port}/health`, undefined, 150)).rejects.toThrow();
  } finally {
    if (child) await stop(child);
    if (!dir.startsWith(path.join(tmpdir(), 'farmafind process '))) throw new Error('Unsafe cleanup target');
    rmSync(dir, { recursive: true, force: true });
  }
});

it('reinicia solo el listener propio y conserva un fallo previo tras limpiarlo', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'farmafind process '));
  const port = await freePort(); let child;
  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      child = launch({ id: `restart-${attempt}`, args: [path.resolve('tests/fixtures/processes/listener.mjs'), String(port)], logDir: dir });
      await waitForHttp(`http://127.0.0.1:${port}/health`, child, 5000);
      await stop(child); child = undefined;
      await ensureFree(port);
    }
    expect(aggregate(['failed', 'passed'])).toBe('failed');
  } finally {
    if (child) await stop(child);
    if (!dir.startsWith(path.join(tmpdir(), 'farmafind process '))) throw new Error('Unsafe cleanup target');
    rmSync(dir, { recursive: true, force: true });
  }
});

it('rechaza detener un PID ajeno sin afectar el listener propio', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'farmafind process '));
  const port = await freePort(); const child = launch({ id: 'owned', args: [path.resolve('tests/fixtures/processes/listener.mjs'), String(port)], logDir: dir });
  try {
    await waitForHttp(`http://127.0.0.1:${port}/health`, child, 5000);
    await expect(stop({ pid: process.pid, exitCode: null, signalCode: null })).rejects.toThrow('supervisor');
    expect((await fetch(`http://127.0.0.1:${port}/health`)).status).toBe(200);
  } finally {
    await stop(child);
    if (!dir.startsWith(path.join(tmpdir(), 'farmafind process '))) throw new Error('Unsafe cleanup target');
    rmSync(dir, { recursive: true, force: true });
  }
});

it('timeout HTTP y fallo de limpieza no se convierten en éxito', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'farmafind process '));
  const port = await freePort(); const child = launch({ id: 'hang', args: [path.resolve('tests/fixtures/processes/listener.mjs'), String(port), 'hang'], logDir: dir });
  try {
    await ensureFree(port).catch(() => {});
    await expect(waitForHttp(`http://127.0.0.1:${port}/health`, child, 200)).rejects.toThrow();
    await expect(stop(child, 0)).rejects.toThrow('Limpieza');
    expect(aggregate(['failed', 'passed'])).toBe('failed');
  } finally {
    await stop(child).catch(() => {});
    if (!dir.startsWith(path.join(tmpdir(), 'farmafind process '))) throw new Error('Unsafe cleanup target');
    rmSync(dir, { recursive: true, force: true });
  }
});
