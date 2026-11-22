import type { Delegation, Membership, PharmacyReference, Session, User } from '../domain/identity.js';
import type { AbuseDecision } from '../domain/abuse-policy.js';

export class DuplicateIdentityError extends Error {
  constructor() { super('Identidad duplicada'); }
}

export class RateLimitedError extends Error {
  constructor(readonly retryAfterSeconds: number) { super('Solicitud limitada'); }
}

export interface UserRepository {
  findById(id: string): Promise<User | null>;
  findByCanonicalEmail(email: string): Promise<User | null>;
  createCustomer(input: { canonicalEmail: string; passwordHash: string }): Promise<User>;
}

export interface SessionRepository {
  findByFingerprint(fingerprint: string): Promise<Session | null>;
  save(session: Session): Promise<void>;
  revoke(fingerprint: string, at: Date): Promise<void>;
  touch(fingerprint: string, at: Date, idleExpiresAt: Date): Promise<void>;
}

export interface AuthUnitOfWork {
  run<T>(work: (users: UserRepository, sessions: SessionRepository, abuse: AbuseRepository, audit: AuditWriter) => Promise<T>): Promise<T>;
}

export interface AbuseRepository {
  assessLogin(account: string, ip: string, now: Date): Promise<AbuseDecision>;
  recordLoginFailure(account: string, ip: string, now: Date): Promise<void>;
  assessRegistration(ip: string, now: Date): Promise<AbuseDecision>;
  recordRegistrationAttempt(ip: string, now: Date): Promise<void>;
}

/** Read-only until EXC-01/ROL-01 permit a separate, audited mutation port. */
export interface MembershipReader {
  listOwn(userId: string): Promise<readonly Membership[]>;
  getOwn(userId: string, pharmacyId: string): Promise<Membership | null>;
  listOwnDelegations(membershipId: string): Promise<readonly Delegation[]>;
}

export interface PharmacyReferenceReader {
  findById(id: string): Promise<PharmacyReference | null>;
}

export interface PasswordHasher {
  hash(plainText: string): Promise<string>;
  verify(storedHash: string, plainText: string): Promise<boolean>;
}

export interface Clock {
  now(): Date;
}

/** No secrets, raw payloads or unmasked email addresses belong in this event. */
export interface AuditEvent {
  readonly actorUserId: string | null;
  readonly action: string;
  readonly pharmacyId: string | null;
  readonly resourceType: string;
  readonly result: 'PERMITIDO' | 'DENEGADO';
  readonly occurredAt: Date;
  readonly correlationId: string;
}

export interface AuditWriter {
  record(event: AuditEvent): Promise<void>;
}

/** The adapter must verify membership in the same transaction before setting tenant context. */
export interface IdentityTransaction {
  listOwnMemberships(actorUserId: string): Promise<readonly Membership[]>;
  findPharmacyReference(pharmacyId: string): Promise<PharmacyReference | null>;
  listOwnDelegations(membershipId: string): Promise<readonly Delegation[]>;
  useAuthorizedPharmacy(actorUserId: string, pharmacyId: string): Promise<Membership>;
  context(): Promise<{ actorUserId: string | null; pharmacyId: string | null; role: string }>;
}

export interface IdentityUnitOfWork {
  run<T>(sessionSecret: string, work: (transaction: IdentityTransaction, actorUserId: string) => Promise<T>): Promise<T>;
}

export interface WorkerMembershipRow {
  readonly id: string;
  readonly userId: string;
  readonly pharmacyId: string;
  readonly role: 'TRABAJADOR';
  readonly status: 'ACTIVA' | 'SUSPENDIDA' | 'REVOCADA';
}

/** All operations use the same validated session and tenant transaction. */
export interface AdminMembershipTransaction extends IdentityTransaction {
  listWorkers(pharmacyId: string): Promise<readonly WorkerMembershipRow[]>;
  findWorker(pharmacyId: string, membershipId: string): Promise<WorkerMembershipRow | null>;
  grantWorker(pharmacyId: string, targetUserId: string): Promise<WorkerMembershipRow>;
  revokeWorker(pharmacyId: string, membershipId: string): Promise<WorkerMembershipRow | null>;
  recordWorkerChange(pharmacyId: string, action: 'MEMBERSHIP_GRANT' | 'MEMBERSHIP_REVOKE', correlationId: string): Promise<void>;
}

export interface AdminMembershipUnitOfWork {
  runAdmin<T>(sessionSecret: string,
    work: (transaction: AdminMembershipTransaction, actorUserId: string) => Promise<T>): Promise<T>;
}
