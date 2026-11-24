import { afterAll, describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
// @ts-expect-error script .mjs sin tipos
import { readTicket } from '../../../scripts/f01/reset-mfa.mjs';

const root = process.cwd();
const cache = path.join(root, '.cache');
mkdirSync(cache, { recursive: true });
const inside = mkdtempSync(path.join(cache, 'f011-reset-test-'));
const outside = mkdtempSync(path.join(os.tmpdir(), 'f011-reset-out-'));
const ticket = { userId: randomUUID(), motivo: 'Dispositivo perdido (fixture)', autorizadoPor: 'Operador TEST' };
const write = (dir: string, value: unknown) => { const file = path.join(dir, `${randomUUID()}.json`); writeFileSync(file, JSON.stringify(value)); return file; };

afterAll(() => { rmSync(inside, { recursive: true, force: true }); rmSync(outside, { recursive: true, force: true }); });

describe('F01.1 US4: procedimiento técnico offline de reinicio del segundo factor', () => {
  it('acepta solo un expediente válido bajo .cache/ (ignorado por Git)', () => {
    expect(readTicket(root, write(inside, ticket)).userId).toBe(ticket.userId);
    expect(() => readTicket(root, write(outside, ticket))).toThrow(/\.cache/);
    expect(() => readTicket(root, undefined)).toThrow(/expediente/i);
    for (const bad of [{ ...ticket, userId: 'no-uuid' }, { ...ticket, motivo: 'corto' }, { ...ticket, autorizadoPor: '' }]) {
      expect(() => readTicket(root, write(inside, bad))).toThrow();
    }
  });

  it('rechaza la base persistente y las bases no locales antes de conectarse', () => {
    const file = write(inside, ticket);
    for (const url of ['postgresql://u:p@127.0.0.1:55431/farmafind_f01_test', 'postgresql://u:p@db.ejemplo.test:5432/farmafind_f01_test_aaaaaaaaaaaa']) {
      const result = spawnSync(process.execPath, ['scripts/f01/reset-mfa.mjs', '--expediente', file], {
        cwd: root, encoding: 'utf8', env: { ...process.env, F01_RESET_DATABASE_URL: url } });
      expect(result.status).toBe(1);
      expect(result.stderr).toContain('Reinicio rechazado');
      expect(result.stderr).not.toContain('p@');
    }
  });

  it('no existe ruta ni pantalla de reinicio en la aplicación', () => {
    const grep = spawnSync('git', ['grep', '-il', 'mfa/reset\|reset-mfa', '--', 'backend/src', 'frontend/src'], { cwd: root, encoding: 'utf8' });
    expect(grep.stdout.trim()).toBe('');
  });
});
