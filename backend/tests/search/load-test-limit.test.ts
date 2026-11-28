import { describe, expect, it } from 'vitest';
import { resolvePublicRateLimit } from '../../src/config/load-test-limit.js';

describe('límite público configurable solo para la copia de carga (Sprint 2)', () => {
  it('sin valor conserva el límite estándar de la DEMO', () => {
    expect(resolvePublicRateLimit(60, undefined, false)).toBe(60);
    expect(resolvePublicRateLimit(120, undefined, true)).toBe(120);
  });
  it('con valor en la copia TEST aislada usa ese valor', () => {
    expect(resolvePublicRateLimit(60, 1_000_000, true)).toBe(1_000_000);
  });
  it('rechaza el valor fuera de la copia TEST aislada o inválido', () => {
    expect(() => resolvePublicRateLimit(60, 1_000_000, false)).toThrow(/solo copia TEST/);
    for (const bad of [0, -5, 1.5, 10_000_001, Number.NaN]) expect(() => resolvePublicRateLimit(60, bad, true)).toThrow();
  });
});
