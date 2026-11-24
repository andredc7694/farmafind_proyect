import type { Delegation, Membership, PharmacyReference, Session, User } from '../domain/identity.js';
import type { AbuseDecision } from '../domain/abuse-policy.js';
import type { IdentityAuditSink } from '../domain/identity-audit.js';

export class DuplicateIdentityError extends Error {
  constructor() { super('Identidad duplicada'); }
}

/** F011-FR-003/012: la sesión sólo puede completar el paso de seguridad pendiente. */
export class SessionRestrictedError extends Error {
  constructor(readonly restriction: 'CAMBIO_CLAVE' | 'MFA_PENDIENTE') { super('Sesión restringida'); }
}

/** La sesión existe pero su estado no permite esta operación (p. ej. no está en cambio de clave). */
export class InvalidSessionStateError extends Error {
  constructor() { super('Estado de sesión inválido'); }
}

export class RateLimitedError extends Error {
  constructor(readonly retryAfterSeconds: number) { super('Solicitud limitada'); }
}

export interface UserRepository {
  findById(id: string): Promise<User | null>;
  /** F01.1: cuenta operativa de personal por alias canónico. */
  findByAlias(alias: string): Promise<User | null>;
  findByCanonicalEmail(email: string): Promise<User | null>;
  createCustomer(input: { canonicalEmail: string; passwordHash: string }): Promise<User>;
}

export interface SessionRepository {
  findByFingerprint(fingerprint: string): Promise<Session | null>;
  save(session: Session): Promise<void>;
  revoke(fingerprint: string, at: Date): Promise<void>;
  touch(fingerprint: string, at: Date, idleExpiresAt: Date): Promise<void>;
}

export interface TemporaryCredentialRow {
  readonly userId: string;
  readonly hash: string;
  readonly expiresAt: Date;
  readonly consumedAt: Date | null;
}

/** F01.1: clave temporal de un solo uso y cambio de clave de la sesión restringida. */
export interface TemporaryCredentialRepository {
  find(userId: string): Promise<TemporaryCredentialRow | null>;
  /** Marca la credencial como consumida; devuelve false si otra petición ya la consumió. */
  consume(userId: string, at: Date): Promise<boolean>;
  /** Actúa solo sobre la sesión del contexto (huella ya fijada por `findByFingerprint`). */
  completePasswordChange(newPasswordHash: string): Promise<void>;
}

/** F01.1 US3: tokens de un solo uso para restablecer la clave o verificar el correo (solo se guarda su hash). */
export interface AccountTokenRepository {
  /** La vigencia la calcula la base de datos con su propio reloj (evita desfases con la aplicación). */
  create(input: { userId: string; purpose: 'VERIFICAR_CORREO' | 'RESTABLECER_CLAVE' | 'CAMBIO_CORREO'; tokenHash: Buffer;
    ttlSeconds: number; destinationEmail?: string }): Promise<void>;
  /** false si el token no existe, ya se usó o venció (sin distinguir). */
  completePasswordReset(tokenHash: Buffer, newPasswordHash: string): Promise<boolean>;
  verifyEmail(tokenHash: Buffer): Promise<boolean>;
}

/** F01.1 US4: segundo factor TOTP del administrador general (el cifrado y la validación del código viven en la aplicación). */
export interface MfaRepository {
  /** NONE: no es administrador general · ENROLL: sin factor activo · VERIFY: factor activo. */
  requirement(userId: string): Promise<'NONE' | 'ENROLL' | 'VERIFY'>;
  beginEnrollment(sealed: { ciphertext: Buffer; nonce: Buffer }): Promise<'OK' | 'FORBIDDEN' | 'CONFLICT'>;
  load(userId: string): Promise<{ state: 'PENDIENTE' | 'ACTIVO' | 'REINICIADO'; ciphertext: Buffer; nonce: Buffer;
    lastStep: number | null } | null>;
  complete(mode: 'ACTIVATE' | 'VERIFY', step: number): Promise<'OK' | 'REUSED' | 'INVALID_STATE'>;
}

/** Cifrado autenticado de secretos en reposo; `context` liga el secreto a su dueño. */
export interface SecretSealer {
  seal(plain: Buffer, context: string): { ciphertext: Buffer; nonce: Buffer };
  open(sealed: { ciphertext: Buffer; nonce: Buffer }, context: string): Buffer;
}

/** F01.1 US5: perfil y seguridad del PROPIO usuario; el servidor lo deriva de la sesión, nunca de la entrada. */
export interface OwnProfile {
  readonly userId: string;
  readonly displayName: string | null;
  readonly phone: string | null;
  readonly avatarPreset: number | null;
  readonly theme: 'CLARO' | 'OSCURO' | 'SISTEMA';
  readonly notifyReservations: boolean;
  readonly notifySecurity: boolean;
  readonly email: string | null;
  readonly emailVerified: boolean;
}
export interface OwnSession { readonly id: string; readonly createdAt: Date; readonly lastUsedAt: Date; readonly current: boolean }
export interface ProfileRepository {
  get(): Promise<OwnProfile>;
  update(patch: Readonly<Record<string, unknown>>): Promise<void>;
  listSessions(): Promise<readonly OwnSession[]>;
  /** false si la sesión no es del usuario o no existe (no se distingue). */
  revokeSession(sessionId: string): Promise<boolean>;
  revokeOthers(): Promise<number>;
  changePassword(newHash: string): Promise<void>;
}

export interface AuthExtras {
  readonly profile: ProfileRepository;
  readonly mfa: MfaRepository;
  readonly credentials: TemporaryCredentialRepository;
  readonly identityAudit: IdentityAuditSink;
  readonly tokens: AccountTokenRepository;
  readonly budgets: AbuseBudgetRepository;
}

export interface AuthUnitOfWork {
  run<T>(work: (users: UserRepository, sessions: SessionRepository, abuse: AbuseRepository, audit: AuditWriter,
    extras?: AuthExtras) => Promise<T>): Promise<T>;
}

/** F01.1: presupuesto único de intentos (5 en 15 min) por ámbito; sin correo ni IP en claro. */
export type AbuseBudgetScope = 'TEMP_KEY_ACCOUNT' | 'RESET_ACCOUNT' | 'RESET_IP' | 'TOTP_ACCOUNT' | 'STAFF_CREATE_IP' | 'REAUTH_ACCOUNT';
export interface AbuseBudgetRepository {
  assessBudget(scope: AbuseBudgetScope, identifier: string, now: Date): Promise<AbuseDecision>;
  recordBudget(scope: AbuseBudgetScope, identifier: string, now: Date): Promise<void>;
}

export interface AbuseRepository {
  assessLogin(account: string, ip: string, now: Date): Promise<AbuseDecision>;
  recordLoginFailure(account: string, ip: string, now: Date): Promise<void>;
  assessRegistration(ip: string, now: Date): Promise<AbuseDecision>;
  recordRegistrationAttempt(ip: string, now: Date): Promise<void>;
}

export interface StaffMemberRow {
  readonly membershipId: string;
  readonly userId: string;
  readonly alias: string | null;
  readonly displayName: string | null;
  readonly state: 'ACTIVA' | 'SUSPENDIDA' | 'REVOCADA';
  readonly pendingTemporaryKey: boolean;
  readonly capabilities: readonly string[];
}

export interface InvitationRow {
  readonly id: string;
  /** Alias, nombre o correo enmascarado: nunca el correo completo. */
  readonly destination: string;
  readonly state: 'PENDIENTE' | 'ACEPTADA' | 'RECHAZADA' | 'VENCIDA' | 'REVOCADA';
  readonly createdAt: Date;
  readonly expiresAt: Date;
}

export interface MyInvitationRow {
  readonly id: string;
  readonly pharmacyName: string;
  readonly state: 'PENDIENTE';
  readonly expiresAt: Date;
}

/** F01.1: transacción de personal dentro de la farmacia ya validada por la sesión viva. */
export interface StaffTransaction {
  useAuthorizedPharmacy(actorUserId: string, pharmacyId: string): Promise<Membership>;
  findPharmacyReference(pharmacyId: string): Promise<PharmacyReference | null>;
  listOwnDelegations(membershipId: string): Promise<readonly Delegation[]>;
  createStaffAccount(input: { pharmacyId: string; alias: string; displayName: string; unusableHash: string;
    temporaryKeyHash: string; capabilities: readonly string[] }): Promise<{ userId: string; expiresAt: Date }>;
  listStaff(pharmacyId: string): Promise<readonly StaffMemberRow[]>;
  issueTemporaryKey(pharmacyId: string, userId: string, keyHash: string): Promise<Date>;
  inviteStaff(pharmacyId: string, email: string): Promise<void>;
  listInvitations(pharmacyId: string): Promise<readonly InvitationRow[]>;
  revokeInvitation(pharmacyId: string, invitationId: string): Promise<void>;
  setStaffCapabilities(pharmacyId: string, membershipId: string, capabilities: readonly string[]): Promise<void>;
  listMyInvitations(): Promise<readonly MyInvitationRow[]>;
  acceptInvitation(invitationId: string): Promise<string>;
  declineInvitation(invitationId: string): Promise<void>;
  /** Auditoría ELEVATION_DENIED del propio actor en esta farmacia (sin secretos ni datos del objetivo). */
  recordDenied(pharmacyId: string): Promise<void>;
}

export interface StaffUnitOfWork {
  runStaff<T>(sessionSecret: string, work: (transaction: StaffTransaction, actorUserId: string) => Promise<T>): Promise<T>;
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
