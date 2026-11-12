import { describe, expect, it } from 'vitest';
import { createOpaqueSession, rotateOpaqueSession, sessionIsAuthorized } from '../../src/modules/usuarios/domain/session-policy.js';

const userId = '00000000-0000-4000-8000-000000000001';
const issuedAt = new Date('2026-11-11T12:00:00.000Z');

describe('reglas locales de sesión opaca', () => {
  it('emite secretos aleatorios de 32 bytes y almacena solo la huella', () => {
    const first = createOpaqueSession(userId, issuedAt);
    const second = createOpaqueSession(userId, issuedAt);
    expect(first.secret).toMatch(/^[a-f0-9]{64}$/);
    expect(second.secret).not.toBe(first.secret);
    expect(first.session.tokenFingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(first.session.tokenFingerprint).not.toBe(first.secret);
    expect(first.session.idleExpiresAt.toISOString()).toBe('2026-11-11T12:30:00.000Z');
    expect(first.session.absoluteExpiresAt.toISOString()).toBe('2026-11-11T20:00:00.000Z');
  });

  it('deniega expiración inactiva/absoluta, revocación y usuario inactivo, incluso en el límite exacto', () => {
    const { session } = createOpaqueSession(userId, issuedAt);
    expect(sessionIsAuthorized(session, 'ACTIVO', new Date('2026-11-11T12:29:59.999Z'))).toBe(true);
    expect(sessionIsAuthorized(session, 'ACTIVO', session.idleExpiresAt)).toBe(false);
    expect(sessionIsAuthorized({ ...session, idleExpiresAt: session.absoluteExpiresAt }, 'ACTIVO', session.absoluteExpiresAt)).toBe(false);
    expect(sessionIsAuthorized({ ...session, state: 'REVOCADA', revokedAt: issuedAt }, 'ACTIVO', issuedAt)).toBe(false);
    expect(sessionIsAuthorized(session, 'INACTIVO', issuedAt)).toBe(false);
  });

  it('la rotación revoca el secreto previo y produce otro sin extender una sesión vencida', () => {
    const first = createOpaqueSession(userId, issuedAt);
    const rotated = rotateOpaqueSession(first.session, 'ACTIVO', new Date('2026-11-11T12:10:00.000Z'));
    expect(rotated.previous.state).toBe('REVOCADA');
    expect(rotated.previous.revokedAt?.toISOString()).toBe('2026-11-11T12:10:00.000Z');
    expect(rotated.next.secret).not.toBe(first.secret);
    expect(rotated.next.session.tokenFingerprint).not.toBe(first.session.tokenFingerprint);
    expect(sessionIsAuthorized(rotated.previous, 'ACTIVO', new Date('2026-11-11T12:10:01.000Z'))).toBe(false);
    expect(() => rotateOpaqueSession(first.session, 'ACTIVO', first.session.idleExpiresAt)).toThrow('No autorizado');
  });
});
