import { createHash, randomUUID } from 'node:crypto';
import { RateLimitedError } from './ports.js';
import type { AuditWriter, AuthUnitOfWork, Clock, PasswordHasher } from './ports.js';
import { canonicalEmail, RegistrationService } from './registration.js';
import { createOpaqueSession, sessionIsAuthorized } from '../domain/session-policy.js';

export interface SessionView {
  readonly userId: string;
  readonly email: string;
  readonly activePharmacyId: null;
}

async function auditIdentity(audit: AuditWriter, action: 'REGISTER' | 'LOGIN' | 'LOGOUT',
  result: 'PERMITIDO' | 'DENEGADO', at: Date, actorUserId: string | null = null): Promise<void> {
  await audit.record({ actorUserId, action, pharmacyId: null, resourceType: 'IDENTITY',
    result, occurredAt: at, correlationId: randomUUID() });
}

function fingerprint(secret: string): string {
  if (!/^[a-f0-9]{64}$/i.test(secret)) throw new Error('No autorizado');
  return createHash('sha256').update(Buffer.from(secret, 'hex')).digest('hex');
}

/** Global identity flows only; pharmacy permissions are resolved separately per operation. */
export class IdentityUseCases {
  constructor(
    private readonly transactions: AuthUnitOfWork,
    private readonly passwords: PasswordHasher,
    private readonly clock: Clock,
    private readonly dummyHash: string,
  ) {}

  async register(email: unknown, password: unknown, ip: string): Promise<void> {
    if (!ip) throw new Error('Entrada inválida');
    const outcome = await this.transactions.run(async (users, _sessions, abuse, audit) => {
      const now = this.clock.now();
      const limit = await abuse.assessRegistration(ip, now);
      if (!limit.allowed) return { kind: 'limited' as const, retryAfterSeconds: limit.retryAfterSeconds };
      await abuse.recordRegistrationAttempt(ip, now);
      try {
        await new RegistrationService(users, this.passwords).register(email, password);
        await auditIdentity(audit, 'REGISTER', 'PERMITIDO', now);
        return { kind: 'ok' as const };
      } catch (error) {
        if (error instanceof Error && error.message === 'Entrada inválida') {
          await auditIdentity(audit, 'REGISTER', 'DENEGADO', now);
          return { kind: 'invalid' as const };
        }
        throw error;
      }
    });
    if (outcome.kind === 'limited') throw new RateLimitedError(outcome.retryAfterSeconds);
    if (outcome.kind === 'invalid') throw new Error('Entrada inválida');
  }

  async login(emailInput: unknown, passwordInput: unknown, ip: string): Promise<{ secret: string; view: SessionView }> {
    if (!ip) throw new Error('Entrada inválida');
    let email: string | null = null;
    try { email = canonicalEmail(emailInput); } catch { /* still count malformed login by IP */ }
    const accountKey = typeof emailInput === 'string' ? emailInput.trim().toLowerCase().slice(0, 254) : '<invalid>';
    const outcome = await this.transactions.run(async (users, sessions, abuse, audit) => {
      const now = this.clock.now();
      const limit = await abuse.assessLogin(accountKey, ip, now);
      if (!limit.allowed) return { kind: 'limited' as const, retryAfterSeconds: limit.retryAfterSeconds };
      if (!email || typeof passwordInput !== 'string' || passwordInput.length === 0) {
        await abuse.recordLoginFailure(accountKey, ip, now);
        await auditIdentity(audit, 'LOGIN', 'DENEGADO', now);
        return { kind: 'invalid-input' as const };
      }
      const user = await users.findByCanonicalEmail(email);
      const validPassword = await this.passwords.verify(user?.passwordHash ?? this.dummyHash, passwordInput);
      if (!user || user.state !== 'ACTIVO' || !validPassword) {
        await abuse.recordLoginFailure(accountKey, ip, now);
        await auditIdentity(audit, 'LOGIN', 'DENEGADO', now);
        return { kind: 'invalid-credentials' as const };
      }
      const issued = createOpaqueSession(user.id, now);
      await sessions.save(issued.session);
      await auditIdentity(audit, 'LOGIN', 'PERMITIDO', now, user.id);
      return { kind: 'ok' as const, secret: issued.secret,
        view: { userId: user.id, email: user.canonicalEmail, activePharmacyId: null } };
    });
    if (outcome.kind === 'limited') throw new RateLimitedError(outcome.retryAfterSeconds);
    if (outcome.kind === 'invalid-input') throw new Error('Entrada inválida');
    if (outcome.kind === 'invalid-credentials') throw new Error('Credenciales inválidas');
    return { secret: outcome.secret, view: outcome.view };
  }

  async session(secret: string): Promise<SessionView> {
    const hash = fingerprint(secret);
    return this.transactions.run(async (users, sessions) => {
      const current = await sessions.findByFingerprint(hash);
      if (!current) throw new Error('No autorizado');
      const user = await users.findById(current.userId);
      const now = this.clock.now();
      if (!user || !sessionIsAuthorized(current, user.state, now)) throw new Error('No autorizado');
      await sessions.touch(hash, now, new Date(now.getTime() + 30 * 60_000));
      return { userId: user.id, email: user.canonicalEmail, activePharmacyId: null };
    });
  }

  async logout(secret: string): Promise<void> {
    const hash = fingerprint(secret);
    await this.transactions.run(async (_users, sessions, _abuse, audit) => {
      const current = await sessions.findByFingerprint(hash);
      const now = this.clock.now();
      if (current) await sessions.revoke(hash, now);
      await auditIdentity(audit, 'LOGOUT', current ? 'PERMITIDO' : 'DENEGADO', now, current?.userId ?? null);
    });
  }

  /** Relevant access denials are logged without the submitted pharmacy identifier. */
  async auditDenied(secret: string, action: 'MEMBERSHIP_LIST' | 'PHARMACY_SELECT', correlationId: string): Promise<void> {
    const hash = fingerprint(secret);
    await this.transactions.run(async (_users, sessions, _abuse, audit) => {
      const current = await sessions.findByFingerprint(hash);
      await audit.record({ actorUserId: current?.userId ?? null, action, pharmacyId: null,
        resourceType: 'IDENTITY', result: 'DENEGADO', occurredAt: this.clock.now(), correlationId });
    });
  }
}
