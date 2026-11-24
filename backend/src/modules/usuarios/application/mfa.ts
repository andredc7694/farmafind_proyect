import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { RateLimitedError } from './ports.js';
import type { AuthUnitOfWork, Clock, SecretSealer } from './ports.js';
import { sessionIsAuthorized } from '../domain/session-policy.js';
import { base32Encode, generateTotpSecret, otpauthUri, verifyTotp } from '../domain/totp.js';

const ISSUER = 'FarmaFind';

/** Operación válida pero no permitida (no es administrador general o ya tiene factor activo). */
export class MfaForbiddenError extends Error { constructor() { super('Permiso insuficiente'); } }
export class MfaConflictError extends Error { constructor() { super('Segundo factor ya activo'); } }
/** Código incorrecto, repetido o fuera de ventana; no distingue el motivo. */
export class MfaInvalidCodeError extends Error { constructor() { super('Código no válido'); } }

function fingerprint(secret: string): string {
  if (!/^[a-f0-9]{64}$/i.test(secret)) throw new Error('No autorizado');
  return createHash('sha256').update(Buffer.from(secret, 'hex')).digest('hex');
}

export interface MfaEnrollment { readonly secret: string; readonly otpauthUri: string }

/** F011-FR-012: alta, activación y verificación del segundo factor TOTP del administrador general. */
export class MfaUseCases {
  constructor(private readonly transactions: AuthUnitOfWork, private readonly box: SecretSealer, private readonly clock: Clock,
    private readonly random: (size: number) => Buffer = randomBytes) {}

  /** Genera el secreto, lo guarda cifrado y lo devuelve UNA sola vez. */
  async enroll(secret: string): Promise<MfaEnrollment> {
    const hash = fingerprint(secret);
    const outcome = await this.transactions.run(async (users, sessions, _abuse, _audit, extras) => {
      if (!extras) throw new Error('No disponible');
      const current = await sessions.findByFingerprint(hash);
      const user = current ? await users.findById(current.userId) : null;
      if (!current || !user || !sessionIsAuthorized(current, user.state, this.clock.now())) throw new Error('No autorizado');
      const raw = generateTotpSecret(this.random);
      const result = await extras.mfa.beginEnrollment(this.box.seal(raw, user.id));
      if (result !== 'OK') return { kind: result };
      return { kind: 'OK' as const, secret: base32Encode(raw),
        otpauthUri: otpauthUri(user.alias ?? user.canonicalEmail ?? user.id, ISSUER, raw) };
    });
    if (outcome.kind === 'FORBIDDEN') throw new MfaForbiddenError();
    if (outcome.kind !== 'OK') throw new MfaConflictError();
    return { secret: outcome.secret, otpauthUri: outcome.otpauthUri };
  }

  /** Primer código válido: activa el factor y marca la sesión actual como verificada. */
  activate(secret: string, code: unknown): Promise<void> { return this.checkCode(secret, code, 'ACTIVATE'); }

  /** Completa una sesión MFA_PENDIENTE. */
  verify(secret: string, code: unknown): Promise<void> { return this.checkCode(secret, code, 'VERIFY'); }

  private async checkCode(secret: string, code: unknown, mode: 'ACTIVATE' | 'VERIFY'): Promise<void> {
    const hash = fingerprint(secret);
    const outcome = await this.transactions.run(async (users, sessions, _abuse, _audit, extras) => {
      if (!extras) throw new Error('No disponible');
      const now = this.clock.now();
      const current = await sessions.findByFingerprint(hash);
      const user = current ? await users.findById(current.userId) : null;
      if (!current || !user || !sessionIsAuthorized(current, user.state, now)) throw new Error('No autorizado');
      const limit = await extras.budgets.assessBudget('TOTP_ACCOUNT', user.id, now);
      if (!limit.allowed) return { kind: 'limited' as const, retryAfterSeconds: limit.retryAfterSeconds };
      const row = await extras.mfa.load(user.id);
      let valid = false;
      if (row && (mode === 'ACTIVATE' ? row.state === 'PENDIENTE' : row.state === 'ACTIVO')) {
        let raw: Buffer | null = null;
        try { raw = this.box.open({ ciphertext: row.ciphertext, nonce: row.nonce }, user.id); } catch { raw = null; }
        const result = raw ? verifyTotp(raw, code, now.getTime(), row.lastStep) : { valid: false as const };
        if (result.valid) valid = (await extras.mfa.complete(mode, result.step)) === 'OK';
      }
      if (valid) return { kind: 'ok' as const };
      await extras.budgets.recordBudget('TOTP_ACCOUNT', user.id, now);
      await extras.identityAudit.record({ actorUserId: user.id, targetUserId: user.id, pharmacyId: null,
        action: 'MFA_VERIFY', result: 'DENEGADO', correlationId: randomUUID() }, now);
      return { kind: 'invalid' as const };
    });
    if (outcome.kind === 'limited') throw new RateLimitedError(outcome.retryAfterSeconds);
    if (outcome.kind === 'invalid') throw new MfaInvalidCodeError();
  }
}
