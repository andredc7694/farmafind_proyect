import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { Session, UserState } from './identity.js';

const idleMilliseconds = 30 * 60 * 1000;
const absoluteMilliseconds = 8 * 60 * 60 * 1000;

/** Domain-level issuance; the application must persist the fingerprint atomically. */
export function createOpaqueSession(userId: string, at: Date): { secret: string; session: Session } {
  const secretBytes = randomBytes(32);
  const secret = secretBytes.toString('hex');
  const tokenFingerprint = createHash('sha256').update(secretBytes).digest('hex');
  const createdAt = new Date(at);
  return {
    secret,
    session: {
      id: randomUUID(),
      userId,
      tokenFingerprint,
      state: 'VIGENTE',
      createdAt,
      lastUsedAt: new Date(at),
      idleExpiresAt: new Date(at.getTime() + idleMilliseconds),
      absoluteExpiresAt: new Date(at.getTime() + absoluteMilliseconds),
      revokedAt: null,
    },
  };
}

/** A stored session is never authority if its user has since become inactive. */
export function sessionIsAuthorized(session: Session, userState: UserState, at: Date): boolean {
  const instant = at.getTime();
  return Number.isFinite(instant)
    && userState === 'ACTIVO'
    && session.state === 'VIGENTE'
    && session.revokedAt === null
    && instant < session.idleExpiresAt.getTime()
    && instant < session.absoluteExpiresAt.getTime();
}

/** Persist both changes in one transaction; returning objects alone grants no access. */
export function rotateOpaqueSession(session: Session, userState: UserState, at: Date): {
  previous: Session;
  next: { secret: string; session: Session };
} {
  if (!sessionIsAuthorized(session, userState, at)) throw new Error('No autorizado');
  return {
    previous: { ...session, state: 'REVOCADA', revokedAt: new Date(at) },
    next: createOpaqueSession(session.userId, at),
  };
}
