import { describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { AbuseRepository, AuthUnitOfWork, SessionRepository, UserRepository } from '../../src/modules/usuarios/application/ports.js';
import { RateLimitedError } from '../../src/modules/usuarios/application/ports.js';
import type { Session, User } from '../../src/modules/usuarios/domain/identity.js';
import { IdentityUseCases } from '../../src/modules/usuarios/application/identity-use-cases.js';

const now = new Date('2026-11-11T12:00:00.000Z');
const user: User = {
  id: randomUUID(), canonicalEmail: 'cliente@example.test', passwordHash: '$argon2id$fixture',
  state: 'ACTIVO', createdAt: now, updatedAt: now,
};

function scenario(found: User | null = user, passwordValid = true) {
  let storedSession: Session | null = null;
  const users = {
    findByCanonicalEmail: vi.fn().mockResolvedValue(found),
    findById: vi.fn().mockImplementation(async (id: string) => found?.id === id ? found : null),
    createCustomer: vi.fn().mockResolvedValue(user),
  } satisfies UserRepository;
  const sessions = {
    findByFingerprint: vi.fn().mockImplementation(async (fingerprint: string) => storedSession?.tokenFingerprint === fingerprint ? storedSession : null),
    save: vi.fn().mockImplementation(async (session: Session) => { storedSession = session; }),
    revoke: vi.fn().mockImplementation(async (_fingerprint: string, at: Date) => {
      if (storedSession) storedSession = { ...storedSession, state: 'REVOCADA', revokedAt: at };
    }),
    touch: vi.fn().mockImplementation(async (_fingerprint: string, at: Date, expiry: Date) => {
      if (storedSession) storedSession = { ...storedSession, lastUsedAt: at, idleExpiresAt: expiry };
    }),
  } satisfies SessionRepository;
  const abuse = {
    assessLogin: vi.fn().mockResolvedValue({ allowed: true }),
    recordLoginFailure: vi.fn().mockResolvedValue(undefined),
    assessRegistration: vi.fn().mockResolvedValue({ allowed: true }),
    recordRegistrationAttempt: vi.fn().mockResolvedValue(undefined),
  } satisfies AbuseRepository;
  const audit = { record: vi.fn().mockResolvedValue(undefined) };
  const uow: AuthUnitOfWork = { run: work => work(users, sessions, abuse, audit) };
  const hasher = { hash: vi.fn(), verify: vi.fn().mockResolvedValue(passwordValid) };
  const service = new IdentityUseCases(uow, hasher, { now: () => now }, '$argon2id$dummy-fixture');
  return { service, users, sessions, hasher, abuse, audit, getStored: () => storedSession };
}

describe('casos de uso de identidad con sesión revocable', () => {
  it('autentica usuario activo y emite secreto opaco solo para cookie', async () => {
    const { service, sessions, audit } = scenario();
    const login = await service.login(' Cliente@Example.Test ', 'contraseña-ficticia', '192.0.2.1');
    expect(login.secret).toMatch(/^[a-f0-9]{64}$/);
    expect(login.view).toEqual({ userId: user.id, email: user.canonicalEmail, activePharmacyId: null });
    expect(sessions.save).toHaveBeenCalledOnce();
    expect(sessions.save.mock.calls[0][0].tokenFingerprint).not.toBe(login.secret);
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({
      action: 'LOGIN', result: 'PERMITIDO', actorUserId: user.id, pharmacyId: null,
    }));
    expect(JSON.stringify(audit.record.mock.calls)).not.toContain('contraseña-ficticia');
  });

  it('rechaza igual credencial incorrecta, usuario inactivo o cuenta ausente', async () => {
    const wrong = scenario(user, false);
    const absent = scenario(null, false);
    const inactive = scenario({ ...user, state: 'INACTIVO' }, true);
    for (const item of [wrong, absent, inactive]) {
      await expect(item.service.login('cliente@example.test', 'incorrecta', '192.0.2.1')).rejects.toThrow('Credenciales inválidas');
      expect(item.sessions.save).not.toHaveBeenCalled();
      expect(item.abuse.recordLoginFailure).toHaveBeenCalledOnce();
      expect(item.audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'LOGIN', result: 'DENEGADO' }));
    }
    expect(absent.hasher.verify).toHaveBeenCalledWith('$argon2id$dummy-fixture', 'incorrecta');
  });

  it('revalida sesión/estado en cada consulta, renueva inactividad y revoca al salir', async () => {
    const { service, sessions, getStored } = scenario();
    const login = await service.login(user.canonicalEmail, 'contraseña-ficticia', '192.0.2.1');
    expect(await service.session(login.secret)).toEqual(login.view);
    expect(sessions.touch).toHaveBeenCalledOnce();
    await service.logout(login.secret);
    expect(getStored()?.state).toBe('REVOCADA');
    await expect(service.session(login.secret)).rejects.toThrow('No autorizado');
  });

  it('no acepta un token manipulable ni revela perfil tras inactivación', async () => {
    const { service, users } = scenario();
    const login = await service.login(user.canonicalEmail, 'contraseña-ficticia', '192.0.2.1');
    await expect(service.session('id-conocido')).rejects.toThrow('No autorizado');
    users.findById.mockResolvedValue({ ...user, state: 'INACTIVO' });
    await expect(service.session(login.secret)).rejects.toThrow('No autorizado');
  });

  it('persiste el rechazo de abuso como resultado genérico y evita verificar contraseña', async () => {
    const { service, abuse, hasher } = scenario();
    abuse.assessLogin.mockResolvedValueOnce({ allowed: false, status: 429, retryAfterSeconds: 60 });
    await expect(service.login(user.canonicalEmail, 'contraseña-ficticia', '192.0.2.1'))
      .rejects.toMatchObject({ constructor: RateLimitedError, retryAfterSeconds: 60 });
    expect(hasher.verify).not.toHaveBeenCalled();
  });
});
