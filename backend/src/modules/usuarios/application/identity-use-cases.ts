import { createHash, randomUUID } from 'node:crypto';
import { InvalidSessionStateError, RateLimitedError } from './ports.js';
import type { AuditWriter, AuthUnitOfWork, Clock, PasswordHasher } from './ports.js';
import { RegistrationService } from './registration.js';
import { createOpaqueSession, sessionIsAuthorized } from '../domain/session-policy.js';
import { classifyLoginIdentifier } from '../domain/alias.js';
import type { LoginIdentifier } from '../domain/alias.js';
import { assessTemporaryKey, normalizeTemporaryKey } from '../domain/temporary-key-policy.js';
import { validateNewPassword } from '../domain/password-policy.js';
import type { Session, User } from '../domain/identity.js';

export interface SessionView {
  readonly userId: string;
  readonly email: string | null;
  /** Solo presente para cuentas operativas de personal. */
  readonly alias?: string;
  readonly activePharmacyId: null;
  /** Solo presente mientras la sesión debe completar un paso de seguridad. */
  readonly restriction?: 'CAMBIO_CLAVE' | 'MFA_PENDIENTE';
}

function viewOf(user: User, restriction: Session['restriction'] = null): SessionView {
  return { userId: user.id, email: user.canonicalEmail, activePharmacyId: null,
    ...(user.alias ? { alias: user.alias } : {}), ...(restriction ? { restriction } : {}) };
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

  /**
   * Inicio de sesión por correo o alias (F011-FR-001). Con una clave temporal vigente, la consume (un solo uso)
   * y abre una sesión restringida a «cambio de clave». Los fallos son uniformes y limitados por cuenta e IP.
   */
  async login(identifierInput: unknown, passwordInput: unknown, ip: string): Promise<{ secret: string; view: SessionView }> {
    if (!ip) throw new Error('Entrada inválida');
    let identifier: LoginIdentifier | null = null;
    try { identifier = classifyLoginIdentifier(identifierInput); } catch { /* still count malformed login by IP */ }
    const accountKey = typeof identifierInput === 'string' ? identifierInput.trim().toLowerCase().slice(0, 254) : '<invalid>';
    const outcome = await this.transactions.run(async (users, sessions, abuse, audit, extras) => {
      const now = this.clock.now();
      const limit = await abuse.assessLogin(accountKey, ip, now);
      if (!limit.allowed) return { kind: 'limited' as const, retryAfterSeconds: limit.retryAfterSeconds };
      if (!identifier || typeof passwordInput !== 'string' || passwordInput.length === 0) {
        await abuse.recordLoginFailure(accountKey, ip, now);
        await auditIdentity(audit, 'LOGIN', 'DENEGADO', now);
        return { kind: 'invalid-input' as const };
      }
      const user = identifier.kind === 'email'
        ? await users.findByCanonicalEmail(identifier.value) : await users.findByAlias(identifier.value);
      const validPassword = await this.passwords.verify(user?.passwordHash ?? this.dummyHash, passwordInput);
      let temporary = false;
      if (!validPassword && extras) {
        // Se verifica siempre un segundo hash (real o ficticio) para que el tiempo no distinga las cuentas.
        const credential = user ? await extras.credentials.find(user.id) : null;
        const normalized = normalizeTemporaryKey(passwordInput);
        const matches = await this.passwords.verify(credential?.hash ?? this.dummyHash, normalized ?? passwordInput);
        if (user && credential && normalized && matches && user.state === 'ACTIVO' &&
            assessTemporaryKey({ consumedAt: credential.consumedAt, expiresAt: credential.expiresAt, now }) === 'VIGENTE') {
          temporary = await extras.credentials.consume(user.id, now);
        }
      }
      if (!user || user.state !== 'ACTIVO' || (!validPassword && !temporary)) {
        await abuse.recordLoginFailure(accountKey, ip, now);
        await auditIdentity(audit, 'LOGIN', 'DENEGADO', now);
        return { kind: 'invalid-credentials' as const };
      }
      // F011-FR-012: el administrador general con factor activo entra con sesión restringida hasta verificar su código.
      const mfa = !temporary && extras ? await extras.mfa.requirement(user.id) : 'NONE';
      const restriction = temporary ? 'CAMBIO_CLAVE' as const : mfa === 'VERIFY' ? 'MFA_PENDIENTE' as const : null;
      const issued = createOpaqueSession(user.id, now, restriction);
      await sessions.save(issued.session);
      await auditIdentity(audit, 'LOGIN', 'PERMITIDO', now, user.id);
      if (temporary && extras) {
        await extras.identityAudit.record({ actorUserId: user.id, targetUserId: user.id, pharmacyId: null,
          action: 'TEMP_KEY_CONSUME', result: 'PERMITIDO', correlationId: randomUUID() }, now);
      }
      return { kind: 'ok' as const, secret: issued.secret, view: viewOf(user, restriction) };
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
      return viewOf(user, current.restriction ?? null);
    });
  }

  /** Restricción vigente de la sesión (null si no existe, no está viva o no tiene restricción). */
  async restrictionOf(secret: string): Promise<'CAMBIO_CLAVE' | 'MFA_PENDIENTE' | null> {
    const hash = fingerprint(secret);
    return this.transactions.run(async (users, sessions) => {
      const current = await sessions.findByFingerprint(hash);
      if (!current) return null;
      const user = await users.findById(current.userId);
      if (!user || !sessionIsAuthorized(current, user.state, this.clock.now())) return null;
      return current.restriction ?? null;
    });
  }

  /** Define la clave definitiva tras el primer ingreso con clave temporal (F011-FR-003). */
  async changeTemporaryPassword(secret: string, newPassword: unknown): Promise<void> {
    const hash = fingerprint(secret);
    const password = validateNewPassword(newPassword);
    const newHash = await this.passwords.hash(password);
    await this.transactions.run(async (users, sessions, _abuse, _audit, extras) => {
      if (!extras) throw new Error('No autorizado');
      const current = await sessions.findByFingerprint(hash);
      if (!current) throw new Error('No autorizado');
      const user = await users.findById(current.userId);
      if (!user || !sessionIsAuthorized(current, user.state, this.clock.now())) throw new Error('No autorizado');
      if (current.restriction !== 'CAMBIO_CLAVE') throw new InvalidSessionStateError();
      await extras.credentials.completePasswordChange(newHash);
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
