import { describe, expect, it } from 'vitest';
import { assessLoginLimit, assessRegistrationLimit } from '../../src/modules/usuarios/domain/abuse-policy.js';

const now = new Date('2026-11-11T12:15:00.000Z');
const recent = (count: number, minute = 14) => Array.from({ length: count }, () => new Date(`2026-11-11T12:${String(minute).padStart(2, '0')}:00.000Z`));

describe('ABUSE-01: cinco intentos en ventana móvil de 15 minutos', () => {
  it('permite hasta cinco fallos de login por cuenta y por IP; el sexto devuelve 429 genérico', () => {
    expect(assessLoginLimit(recent(4), recent(4), now).allowed).toBe(true);
    expect(assessLoginLimit(recent(5), [], now)).toEqual({ allowed: false, status: 429, retryAfterSeconds: 840 });
    expect(assessLoginLimit([], recent(5), now)).toEqual({ allowed: false, status: 429, retryAfterSeconds: 840 });
  });

  it('usa el mayor plazo pendiente cuando ambos límites de login se exceden', () => {
    const result = assessLoginLimit(recent(5, 14), recent(5, 13), now);
    expect(result).toEqual({ allowed: false, status: 429, retryAfterSeconds: 840 });
  });

  it('limita registro por IP y deja caducar intentos antiguos sin bloqueo permanente', () => {
    expect(assessRegistrationLimit(recent(4), now).allowed).toBe(true);
    expect(assessRegistrationLimit(recent(5), now)).toEqual({ allowed: false, status: 429, retryAfterSeconds: 840 });
    expect(assessRegistrationLimit(recent(5, 0), now).allowed).toBe(true);
  });

  it('la ventana es móvil y Retry-After redondea hacia arriba', () => {
    const failures = Array.from({ length: 5 }, () => new Date('2026-11-11T12:00:00.500Z'));
    expect(assessRegistrationLimit(failures, now)).toEqual({ allowed: false, status: 429, retryAfterSeconds: 1 });
  });
});
