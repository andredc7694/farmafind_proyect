import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { assertCopyPort, assertPortFree, copyApiPort, CopyPortError } from '../../scripts/copy/ports.mjs';

const directories = [];
afterEach(() => { while (directories.length) rmSync(directories.pop(), { recursive: true, force: true }); });

function run(...args) {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'ff-copy-'));
  directories.push(directory);
  writeFileSync(path.join(directory, 'serve.mjs'), '// copyApiPort(\n');
  const result = spawnSync(process.execPath, ['scripts/copy/start-copy.mjs', directory, ...args], { encoding: 'utf8', timeout: 20_000 });
  return { ...result, started: existsSync(path.join(directory, 'processes.json')) };
}

describe('puertos de la copia temporal', () => {
  it.each([3000, 5173, '3000', '5173'])('rechaza el puerto de la DEMO %s con un mensaje claro', port => {
    expect(() => assertCopyPort(port, 'la web')).toThrow(CopyPortError);
    expect(() => assertCopyPort(port, 'la web')).toThrow(/es de la DEMO \(3000 y 5173\).*No se inició nada/);
  });

  it('acepta los puertos de copia y rechaza valores no válidos', () => {
    expect(assertCopyPort(3001, 'la API')).toBe(3001);
    expect(assertCopyPort('5174', 'la web')).toBe(5174);
    for (const bad of [80, 70000, 'abc', '', 3001.5]) expect(() => assertCopyPort(bad, 'la API')).toThrow(/no es válido/);
    expect(copyApiPort({})).toBe(3001);
    expect(() => copyApiPort({ FARMAFIND_COPY_API_PORT: '3000' })).toThrow(/DEMO/);
  });

  it('un puerto ocupado detiene la copia sin tocar al proceso que lo usa', async () => {
    const server = net.createServer();
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address();
    try {
      await expect(assertPortFree(port, 'la web')).rejects.toThrow(/ya está en uso/);
      expect(server.listening).toBe(true);
    } finally { await new Promise(resolve => server.close(resolve)); }
    await expect(assertPortFree(port, 'la web')).resolves.toBeUndefined();
  });

  it.each([['--web-port', '5173'], ['--web-port', '3000'], ['--api-port', '3000'], ['--api-port', '5173']])(
    'el arrancador se detiene con %s %s y no inicia nada', (flag, port) => {
      const result = run(flag, port);
      expect(result.status).toBe(1);
      expect(result.stderr).toMatch(new RegExp(`el puerto ${port} es de la DEMO`));
      expect(result.started).toBe(false);
    });
});
