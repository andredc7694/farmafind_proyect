import { createHash, randomBytes } from 'node:crypto';
import { RateLimitedError } from './ports.js';
import type { AuthUnitOfWork, Clock, PasswordHasher } from './ports.js';
import { deliverAfterCommit } from './account-messages.js';
import type { AccountMessage, AccountMessageDelivery } from './account-messages.js';
import { canonicalEmail } from './registration.js';
import { sessionIsAuthorized } from '../domain/session-policy.js';
import { validateNewPassword } from '../domain/password-policy.js';

const RESET_TTL_SECONDS = 30 * 60;
const VERIFY_TTL_SECONDS = 24 * 3_600 - 60; // un minuto por debajo del tope de 24 h de la base
const tokenPattern = /^[A-Za-z0-9_-]{20,200}$/;

const hashToken = (token: string): Buffer => createHash('sha256').update(token, 'utf8').digest();
const newToken = (random: (size: number) => Buffer): string => random(32).toString('base64url');

function fingerprint(secret: string): string {
  if (!/^[a-f0-9]{64}$/i.test(secret)) throw new Error('No autorizado');
  return createHash('sha256').update(Buffer.from(secret, 'hex')).digest('hex');
}

/**
 * Restablecimiento de clave y verificación de correo (F011-FR-010).
 * Respuestas idénticas exista o no la cuenta; la entrega del mensaje ocurre DESPUÉS de confirmar la
 * transacción y sin esperarla, para que ni el contenido ni el tiempo distingan las cuentas.
 */
export class AccountRecovery {
  constructor(private readonly transactions: AuthUnitOfWork, private readonly passwords: PasswordHasher,
    private readonly clock: Clock, private readonly delivery: AccountMessageDelivery | null = null,
    private readonly random: (size: number) => Buffer = randomBytes,
    private readonly onDeliveryFailure: (reason: string) => void = () => undefined) {}

  private dispatch(message: AccountMessage | null): void {
    if (message && this.delivery) void deliverAfterCommit(this.delivery, message, this.onDeliveryFailure);
  }

  async requestPasswordReset(emailInput: unknown, ip: string): Promise<void> {
    if (!ip) throw new Error('Entrada inválida');
    const email = canonicalEmail(emailInput);
    const outcome = await this.transactions.run(async (users, _sessions, _abuse, _audit, extras) => {
      if (!extras) throw new Error('No disponible');
      const now = this.clock.now();
      const [account, network] = await Promise.all([
        extras.budgets.assessBudget('RESET_ACCOUNT', email, now), extras.budgets.assessBudget('RESET_IP', ip, now)]);
      const blocked = [account, network].find(item => !item.allowed);
      // Cada solicitud cuenta contra el presupuesto, exista o no la cuenta.
      await extras.budgets.recordBudget('RESET_ACCOUNT', email, now);
      await extras.budgets.recordBudget('RESET_IP', ip, now);
      if (blocked && !blocked.allowed) return { kind: 'limited' as const, retryAfterSeconds: blocked.retryAfterSeconds };
      const user = await users.findByCanonicalEmail(email);
      if (!user || user.state !== 'ACTIVO') return { kind: 'ok' as const, message: null };
      const code = newToken(this.random);
      const expiresAt = new Date(now.getTime() + RESET_TTL_SECONDS * 1000);
      await extras.tokens.create({ userId: user.id, purpose: 'RESTABLECER_CLAVE', tokenHash: hashToken(code), ttlSeconds: RESET_TTL_SECONDS });
      return { kind: 'ok' as const, message: { kind: 'RESTABLECER_CLAVE' as const, to: email, code, expiresAt } };
    });
    if (outcome.kind === 'limited') throw new RateLimitedError(outcome.retryAfterSeconds);
    this.dispatch(outcome.message);
  }

  async confirmPasswordReset(tokenInput: unknown, newPassword: unknown, ip: string): Promise<void> {
    if (!ip || typeof tokenInput !== 'string' || !tokenPattern.test(tokenInput)) throw new Error('Entrada inválida');
    const password = validateNewPassword(newPassword);
    const newHash = await this.passwords.hash(password);
    const outcome = await this.transactions.run(async (_users, _sessions, _abuse, _audit, extras) => {
      if (!extras) throw new Error('No disponible');
      const now = this.clock.now();
      const limit = await extras.budgets.assessBudget('RESET_IP', ip, now);
      if (!limit.allowed) return { kind: 'limited' as const, retryAfterSeconds: limit.retryAfterSeconds };
      const done = await extras.tokens.completePasswordReset(hashToken(tokenInput), newHash);
      if (!done) await extras.budgets.recordBudget('RESET_IP', ip, now);
      return { kind: done ? 'ok' as const : 'invalid' as const };
    });
    if (outcome.kind === 'limited') throw new RateLimitedError(outcome.retryAfterSeconds);
    if (outcome.kind === 'invalid') throw new Error('Entrada inválida');
  }

  async verifyEmail(tokenInput: unknown, ip: string): Promise<void> {
    if (!ip || typeof tokenInput !== 'string' || !tokenPattern.test(tokenInput)) throw new Error('Entrada inválida');
    const outcome = await this.transactions.run(async (_users, _sessions, _abuse, _audit, extras) => {
      if (!extras) throw new Error('No disponible');
      const now = this.clock.now();
      const limit = await extras.budgets.assessBudget('RESET_IP', ip, now);
      if (!limit.allowed) return { kind: 'limited' as const, retryAfterSeconds: limit.retryAfterSeconds };
      const done = await extras.tokens.verifyEmail(hashToken(tokenInput));
      if (!done) await extras.budgets.recordBudget('RESET_IP', ip, now);
      return { kind: done ? 'ok' as const : 'invalid' as const };
    });
    if (outcome.kind === 'limited') throw new RateLimitedError(outcome.retryAfterSeconds);
    if (outcome.kind === 'invalid') throw new Error('Entrada inválida');
  }

  /** Solicitud autenticada de verificación del propio correo. Sin correo: entrada inválida. */
  async requestEmailVerification(secret: string): Promise<void> {
    const hash = fingerprint(secret);
    const outcome = await this.transactions.run(async (users, sessions, _abuse, _audit, extras) => {
      if (!extras) throw new Error('No disponible');
      const current = await sessions.findByFingerprint(hash);
      if (!current) throw new Error('No autorizado');
      const user = await users.findById(current.userId);
      const now = this.clock.now();
      if (!user || !sessionIsAuthorized(current, user.state, now) || current.restriction) throw new Error('No autorizado');
      if (!user.canonicalEmail) throw new Error('Entrada inválida');
      const limit = await extras.budgets.assessBudget('RESET_ACCOUNT', user.canonicalEmail, now);
      if (!limit.allowed) return { kind: 'limited' as const, retryAfterSeconds: limit.retryAfterSeconds };
      await extras.budgets.recordBudget('RESET_ACCOUNT', user.canonicalEmail, now);
      const code = newToken(this.random);
      const expiresAt = new Date(now.getTime() + VERIFY_TTL_SECONDS * 1000);
      await extras.tokens.create({ userId: user.id, purpose: 'VERIFICAR_CORREO', tokenHash: hashToken(code), ttlSeconds: VERIFY_TTL_SECONDS });
      return { kind: 'ok' as const, message: { kind: 'VERIFICAR_CORREO' as const, to: user.canonicalEmail, code, expiresAt } };
    });
    if (outcome.kind === 'limited') throw new RateLimitedError(outcome.retryAfterSeconds);
    this.dispatch(outcome.message);
  }
}
