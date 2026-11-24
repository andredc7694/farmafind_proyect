import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { RateLimitedError } from './ports.js';
import type { AuthExtras, AuthUnitOfWork, Clock, OwnProfile, OwnSession, PasswordHasher, SessionRepository,
  UserRepository } from './ports.js';
import { deliverAfterCommit } from './account-messages.js';
import type { AccountMessage, AccountMessageDelivery } from './account-messages.js';
import { canonicalEmail } from './registration.js';
import { sessionIsAuthorized } from '../domain/session-policy.js';
import { validateNewPassword } from '../domain/password-policy.js';
import type { User } from '../domain/identity.js';

const EMAIL_CHANGE_TTL_SECONDS = 3_600;
const themes = ['CLARO', 'OSCURO', 'SISTEMA'] as const;
const phonePattern = /^\+?[0-9 ()-]{6,20}$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** La clave actual no coincide (reautenticación fallida). No revela nada más. */
export class ReauthenticationError extends Error { constructor() { super('Reautenticación fallida'); } }
/** La sesión pedida no es del usuario o no existe (no se distingue). */
export class OwnSessionNotFoundError extends Error { constructor() { super('Sesión no visible'); } }

const fingerprint = (secret: string): string => {
  if (!/^[a-f0-9]{64}$/i.test(secret)) throw new Error('No autorizado');
  return createHash('sha256').update(Buffer.from(secret, 'hex')).digest('hex');
};
const hashToken = (token: string): Buffer => createHash('sha256').update(token, 'utf8').digest();

/**
 * Valida la edición del perfil. Solo seis claves; cualquier otra (rol, permisos, estado...) es entrada inválida
 * (F011-FR-014). Devuelve el parche normalizado.
 */
export function validateProfilePatch(input: unknown): Record<string, unknown> {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) throw new Error('Entrada inválida');
  const body = input as Record<string, unknown>;
  const keys = Object.keys(body);
  if (keys.length === 0) throw new Error('Entrada inválida');
  const patch: Record<string, unknown> = {};
  for (const key of keys) {
    const value = body[key];
    switch (key) {
      case 'displayName':
        if (typeof value !== 'string' || value.trim().length > 120) throw new Error('Entrada inválida');
        patch[key] = value.trim(); break;
      case 'phone':
        if (value !== null && (typeof value !== 'string' || (value.trim() !== '' && !phonePattern.test(value.trim())))) throw new Error('Entrada inválida');
        patch[key] = value === null ? null : value.trim(); break;
      case 'avatarPreset':
        if (value !== null && (!Number.isInteger(value) || (value as number) < 1 || (value as number) > 12)) throw new Error('Entrada inválida');
        patch[key] = value; break;
      case 'theme':
        if (typeof value !== 'string' || !(themes as readonly string[]).includes(value)) throw new Error('Entrada inválida');
        patch[key] = value; break;
      case 'notifyReservations':
      case 'notifySecurity':
        if (typeof value !== 'boolean') throw new Error('Entrada inválida');
        patch[key] = value; break;
      default: throw new Error('Entrada inválida');
    }
  }
  return patch;
}

/** F011-FR-013/014: perfil y seguridad del propio usuario. Nunca toca roles, membresías ni permisos. */
export class OwnProfileUseCases {
  constructor(private readonly transactions: AuthUnitOfWork, private readonly passwords: PasswordHasher,
    private readonly clock: Clock, private readonly delivery: AccountMessageDelivery | null = null,
    private readonly random: (size: number) => Buffer = randomBytes,
    private readonly onDeliveryFailure: (reason: string) => void = () => undefined) {}

  private async authorize(users: UserRepository, sessions: SessionRepository, secret: string): Promise<User> {
    const current = await sessions.findByFingerprint(fingerprint(secret));
    const user = current ? await users.findById(current.userId) : null;
    if (!current || !user || !sessionIsAuthorized(current, user.state, this.clock.now()) || current.restriction) {
      throw new Error('No autorizado');
    }
    return user;
  }

  /** Reautenticación con límite propio; un fallo cuenta y se audita, y no cambia nada. */
  private async reauthenticate(user: User, extras: AuthExtras, currentPassword: unknown,
    action: 'PASSWORD_CHANGE' | 'EMAIL_CHANGE'): Promise<'ok' | { limited: number } | 'failed'> {
    const now = this.clock.now();
    const limit = await extras.budgets.assessBudget('REAUTH_ACCOUNT', user.id, now);
    if (!limit.allowed) return { limited: limit.retryAfterSeconds };
    const valid = typeof currentPassword === 'string' && currentPassword.length > 0 &&
      await this.passwords.verify(user.passwordHash, currentPassword);
    if (valid) return 'ok';
    await extras.budgets.recordBudget('REAUTH_ACCOUNT', user.id, now);
    await extras.identityAudit.record({ actorUserId: user.id, targetUserId: user.id, pharmacyId: null, action,
      result: 'DENEGADO', correlationId: randomUUID() }, now);
    return 'failed';
  }

  async getProfile(secret: string): Promise<OwnProfile> {
    return this.transactions.run(async (users, sessions, _abuse, _audit, extras) => {
      if (!extras) throw new Error('No disponible');
      await this.authorize(users, sessions, secret);
      return extras.profile.get();
    });
  }

  async updateProfile(secret: string, input: unknown): Promise<OwnProfile> {
    const patch = validateProfilePatch(input);
    return this.transactions.run(async (users, sessions, _abuse, _audit, extras) => {
      if (!extras) throw new Error('No disponible');
      await this.authorize(users, sessions, secret);
      await extras.profile.update(patch);
      return extras.profile.get();
    });
  }

  /**
   * Pide el cambio de correo: reautenticación + código enviado al correo NUEVO. El correo no cambia hasta usar el código.
   * La respuesta es la misma haya o no otra cuenta con ese correo (sin enumeración).
   */
  async requestEmailChange(secret: string, newEmailInput: unknown, currentPassword: unknown): Promise<void> {
    const newEmail = canonicalEmail(newEmailInput);
    const outcome = await this.transactions.run(async (users, sessions, _abuse, _audit, extras) => {
      if (!extras) throw new Error('No disponible');
      const user = await this.authorize(users, sessions, secret);
      const auth = await this.reauthenticate(user, extras, currentPassword, 'EMAIL_CHANGE');
      if (auth === 'failed') return { kind: 'failed' as const };
      if (auth !== 'ok') return { kind: 'limited' as const, retryAfterSeconds: auth.limited };
      if (user.canonicalEmail === newEmail) throw new Error('Entrada inválida');
      const now = this.clock.now();
      const budget = await extras.budgets.assessBudget('RESET_ACCOUNT', user.id, now);
      if (!budget.allowed) return { kind: 'limited' as const, retryAfterSeconds: budget.retryAfterSeconds };
      await extras.budgets.recordBudget('RESET_ACCOUNT', user.id, now);
      if (await users.findByCanonicalEmail(newEmail)) return { kind: 'ok' as const, message: null as AccountMessage | null };
      const code = this.random(32).toString('base64url');
      await extras.tokens.create({ userId: user.id, purpose: 'CAMBIO_CORREO', tokenHash: hashToken(code),
        ttlSeconds: EMAIL_CHANGE_TTL_SECONDS, destinationEmail: newEmail });
      return { kind: 'ok' as const, message: { kind: 'CAMBIO_CORREO' as const, to: newEmail, code,
        expiresAt: new Date(now.getTime() + EMAIL_CHANGE_TTL_SECONDS * 1000) } as AccountMessage | null };
    });
    if (outcome.kind === 'limited') throw new RateLimitedError(outcome.retryAfterSeconds);
    if (outcome.kind === 'failed') throw new ReauthenticationError();
    if (outcome.message && this.delivery) void deliverAfterCommit(this.delivery, outcome.message, this.onDeliveryFailure);
  }

  /** Cambia la clave con reautenticación; cierra las demás sesiones y conserva la actual. */
  async changePassword(secret: string, currentPassword: unknown, newPassword: unknown): Promise<void> {
    const password = validateNewPassword(newPassword);
    const newHash = await this.passwords.hash(password);
    const outcome = await this.transactions.run(async (users, sessions, _abuse, _audit, extras) => {
      if (!extras) throw new Error('No disponible');
      const user = await this.authorize(users, sessions, secret);
      const auth = await this.reauthenticate(user, extras, currentPassword, 'PASSWORD_CHANGE');
      if (auth === 'failed') return { kind: 'failed' as const };
      if (auth !== 'ok') return { kind: 'limited' as const, retryAfterSeconds: auth.limited };
      await extras.profile.changePassword(newHash);
      return { kind: 'ok' as const };
    });
    if (outcome.kind === 'limited') throw new RateLimitedError(outcome.retryAfterSeconds);
    if (outcome.kind === 'failed') throw new ReauthenticationError();
  }

  async listSessions(secret: string): Promise<readonly OwnSession[]> {
    return this.transactions.run(async (users, sessions, _abuse, _audit, extras) => {
      if (!extras) throw new Error('No disponible');
      await this.authorize(users, sessions, secret);
      return extras.profile.listSessions();
    });
  }

  async revokeSession(secret: string, sessionId: unknown): Promise<void> {
    if (typeof sessionId !== 'string' || !uuidPattern.test(sessionId)) throw new Error('Entrada inválida');
    const done = await this.transactions.run(async (users, sessions, _abuse, _audit, extras) => {
      if (!extras) throw new Error('No disponible');
      await this.authorize(users, sessions, secret);
      return extras.profile.revokeSession(sessionId);
    });
    if (!done) throw new OwnSessionNotFoundError();
  }

  async revokeOtherSessions(secret: string): Promise<void> {
    await this.transactions.run(async (users, sessions, _abuse, _audit, extras) => {
      if (!extras) throw new Error('No disponible');
      await this.authorize(users, sessions, secret);
      await extras.profile.revokeOthers();
    });
  }
}
