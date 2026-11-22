import { randomUUID } from 'node:crypto';
import { PLATFORM_ROLE, validPlatformApproval, validPlatformMutation } from '../domain/platform-authorization-policy.js';

export interface PlatformAssignment {
  readonly id: string;
  readonly userId: string;
  readonly role: typeof PLATFORM_ROLE;
  readonly status: 'ACTIVA' | 'REVOCADA';
  readonly grantedAt: string;
  readonly revokedAt: string | null;
}

export interface PlatformAuthorizationTransaction {
  list(): Promise<readonly PlatformAssignment[]>;
  grant(targetUserId: string, role: string, approvalId: string, correlationId: string): Promise<PlatformAssignment>;
  revoke(assignmentId: string, approvalId: string, correlationId: string): Promise<PlatformAssignment>;
}

export interface PlatformAuthorizationUnitOfWork {
  runPlatform<T>(secret: string, work: (transaction: PlatformAuthorizationTransaction, actorUserId: string) => Promise<T>): Promise<T>;
}

export class PlatformAuthorizationForbiddenError extends Error { constructor() { super('Permiso insuficiente'); } }
export class PlatformAuthorizationConflictError extends Error { constructor() { super('Conflicto'); } }

export class ManagePlatformAuthorizations {
  constructor(private readonly transactions: PlatformAuthorizationUnitOfWork) {}

  list(secret: string): Promise<readonly PlatformAssignment[]> {
    return this.transactions.runPlatform(secret, transaction => transaction.list());
  }

  grant(secret: string, actorUserId: string, targetUserId: string, role: string, approvalId: string): Promise<PlatformAssignment> {
    if (!validPlatformMutation({ actorUserId, targetUserId, role, approvalId })) {
      throw new PlatformAuthorizationForbiddenError();
    }
    return this.transactions.runPlatform(secret, async (transaction, verifiedActor) => {
      if (verifiedActor !== actorUserId) throw new PlatformAuthorizationForbiddenError();
      try { return await transaction.grant(targetUserId, role, approvalId, randomUUID()); }
      catch (error) { this.translate(error); }
    });
  }

  revoke(secret: string, actorUserId: string, assignmentId: string,
    approvalId: string): Promise<PlatformAssignment> {
    if (!validPlatformApproval(approvalId)) throw new PlatformAuthorizationForbiddenError();
    return this.transactions.runPlatform(secret, async (transaction, verifiedActor) => {
      if (verifiedActor !== actorUserId) throw new PlatformAuthorizationForbiddenError();
      try { return await transaction.revoke(assignmentId, approvalId, randomUUID()); }
      catch (error) { this.translate(error); }
    });
  }

  private translate(error: unknown): never {
    const code = (error as { code?: string }).code;
    if (code === '42501') throw new PlatformAuthorizationForbiddenError();
    if (code === '23505' || code === '23514') throw new PlatformAuthorizationConflictError();
    throw error;
  }
}
