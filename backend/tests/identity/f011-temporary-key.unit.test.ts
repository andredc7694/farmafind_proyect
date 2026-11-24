import { describe, expect, it } from 'vitest';
import { randomBytes } from 'node:crypto';
import { assessTemporaryKey, generateTemporaryKey, normalizeTemporaryKey, temporaryKeyExpiry,
  TEMPORARY_KEY_TTL_HOURS } from '../../src/modules/usuarios/domain/temporary-key-policy.js';
import { assessSingleBudget } from '../../src/modules/usuarios/domain/abuse-policy.js';

describe('F01.1 clave temporal', () => {
  it('genera claves de 160 bits con formato legible y sin repetirse', () => {
    const keys = new Set(Array.from({ length: 200 }, () => generateTemporaryKey()));
    expect(keys.size).toBe(200);
    for (const key of keys) expect(key).toMatch(/^[0-9A-HJKMNP-TV-Z]{8}(-[0-9A-HJKMNP-TV-Z]{8}){3}$/);
  });

  it('rechaza una fuente aleatoria corta', () => {
    expect(() => generateTemporaryKey(() => randomBytes(8))).toThrow();
  });

  it('normaliza lo que digita el trabajador y rechaza lo que no pertenece al alfabeto', () => {
    const key = generateTemporaryKey();
    expect(normalizeTemporaryKey(key)).toBe(key.replace(/-/g, ''));
    expect(normalizeTemporaryKey(` ${key.toLowerCase().replace(/-/g, ' ')} `)).toBe(key.replace(/-/g, ''));
    for (const bad of [undefined, 7, '', 'ABC', key + 'A', 'IIIIIIII-IIIIIIII-IIIIIIII-IIIIIIII']) {
      expect(normalizeTemporaryKey(bad)).toBeNull();
    }
  });

  it('vence a las 24 horas exactas', () => {
    const issued = new Date('2026-11-23T10:00:00.000Z');
    expect(TEMPORARY_KEY_TTL_HOURS).toBe(24);
    expect(temporaryKeyExpiry(issued).toISOString()).toBe('2026-11-24T10:00:00.000Z');
  });

  it('un solo uso: vigente, consumida o vencida', () => {
    const expiresAt = new Date('2026-11-24T10:00:00.000Z');
    expect(assessTemporaryKey({ consumedAt: null, expiresAt, now: new Date('2026-11-24T09:59:59.000Z') })).toBe('VIGENTE');
    expect(assessTemporaryKey({ consumedAt: null, expiresAt, now: expiresAt })).toBe('VENCIDA');
    expect(assessTemporaryKey({ consumedAt: new Date('2026-11-23T11:00:00.000Z'), expiresAt, now: new Date('2026-11-23T12:00:00.000Z') })).toBe('CONSUMIDA');
  });

  it('bloquea 15 minutos tras 5 intentos fallidos por cuenta', () => {
    const now = new Date('2026-11-23T10:15:00.000Z');
    const attempts = (count: number) => Array.from({ length: count }, () => new Date('2026-11-23T10:15:00.000Z'));
    expect(assessSingleBudget(attempts(4), now)).toEqual({ allowed: true });
    expect(assessSingleBudget(attempts(5), now)).toEqual({ allowed: false, status: 429, retryAfterSeconds: 900 });
    const later = new Date('2026-11-23T10:30:00.000Z');
    expect(assessSingleBudget(attempts(5), later)).toEqual({ allowed: true });
  });
});
