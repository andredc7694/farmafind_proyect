import { afterAll, describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { deliverAfterCommit } from '../../src/modules/usuarios/application/account-messages.js';
import { FileMailboxSimulator } from '../../src/modules/usuarios/infrastructure/mailbox-simulator.js';

const cacheRoot = path.join(process.cwd(), '.cache');
const directories: string[] = [];
function tempDirectory(): string {
  mkdirSync(cacheRoot, { recursive: true });
  const directory = mkdtempSync(path.join(cacheRoot, 'f011-test-mailbox-'));
  directories.push(directory);
  return directory;
}
afterAll(() => { for (const directory of directories) rmSync(directory, { recursive: true, force: true }); });

const message = { kind: 'RESTABLECER_CLAVE' as const, to: 'dueno@example.test', code: 'TOKEN-FICTICIO-123', expiresAt: new Date('2026-11-23T10:30:00.000Z') };

describe('F01.1 simulador local de mensajes de cuenta', () => {
  it('escribe una línea JSON por mensaje y la lee por destino', async () => {
    const simulator = new FileMailboxSimulator(tempDirectory(), () => new Date('2026-11-23T10:00:00.000Z'));
    await simulator.deliver(message);
    await simulator.deliver({ ...message, to: 'otro@example.test', code: 'OTRO' });
    const mine = await simulator.read('dueno@example.test');
    expect(mine).toHaveLength(1);
    expect(mine[0]).toMatchObject({ kind: 'RESTABLECER_CLAVE', code: 'TOKEN-FICTICIO-123', expiresAt: '2026-11-23T10:30:00.000Z' });
    expect(await simulator.read()).toHaveLength(2);
  });

  it('una bandeja inexistente se lee vacía', async () => {
    expect(await new FileMailboxSimulator(tempDirectory()).read()).toEqual([]);
  });

  it('rechaza directorios fuera de .cache (ignorado por Git)', () => {
    expect(() => new FileMailboxSimulator(path.join(process.cwd(), 'docs', 'bandeja'))).toThrow(/\.cache/);
    expect(() => new FileMailboxSimulator('C:/Windows/Temp/bandeja')).toThrow(/\.cache/);
  });

  it('la entrega posterior al commit no propaga fallos ni expone el código', async () => {
    const failures: string[] = [];
    const broken = { deliver: async () => { throw new Error(`fallo con ${message.code}`); } };
    const delivered = await deliverAfterCommit(broken, message, reason => failures.push(reason));
    expect(delivered).toBe(false);
    expect(failures).toEqual(['Error']);
    expect(failures.join('')).not.toContain(message.code);
    expect(await deliverAfterCommit(new FileMailboxSimulator(tempDirectory()), message)).toBe(true);
  });

  it('el directorio de la bandeja de TEST está ignorado por Git', () => {
    const ignore = readFileSync(path.join(process.cwd(), '.gitignore'), 'utf8');
    expect(ignore).toMatch(/^\.cache\/$/m);
  });
});
