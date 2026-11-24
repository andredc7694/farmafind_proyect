import type { AdminMembershipTransaction, InvitationRow, MyInvitationRow, StaffMemberRow, StaffTransaction,
  StaffUnitOfWork } from '../application/ports.js';
import type { Delegation, Membership, PharmacyReference } from '../domain/identity.js';
import type { PgIdentityUnitOfWork, SqlClient } from './db/tenant-transaction.js';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function staffRow(row: Record<string, unknown>): StaffMemberRow {
  return { membershipId: String(row.membership_id), userId: String(row.user_id),
    alias: (row.alias as string | null) ?? null, displayName: (row.display_name as string | null) ?? null,
    state: row.state as StaffMemberRow['state'], pendingTemporaryKey: row.pending_temporary_key === true,
    capabilities: (row.capabilities as string[] | null) ?? [] };
}

/** Funciones SECURITY DEFINER de las migraciones 012 y 013; la autorización se comprueba dentro de la base. */
class PgStaffTransaction implements StaffTransaction {
  constructor(private readonly base: AdminMembershipTransaction, private readonly client: SqlClient) {}

  useAuthorizedPharmacy(actorUserId: string, pharmacyId: string): Promise<Membership> {
    return this.base.useAuthorizedPharmacy(actorUserId, pharmacyId);
  }
  findPharmacyReference(pharmacyId: string): Promise<PharmacyReference | null> {
    return this.base.findPharmacyReference(pharmacyId);
  }
  listOwnDelegations(membershipId: string): Promise<readonly Delegation[]> {
    return this.base.listOwnDelegations(membershipId);
  }

  async createStaffAccount(input: { pharmacyId: string; alias: string; displayName: string; unusableHash: string;
    temporaryKeyHash: string; capabilities: readonly string[] }): Promise<{ userId: string; expiresAt: Date }> {
    if (!uuid.test(input.pharmacyId)) throw new Error('Entrada inválida');
    const result = await this.client.query('SELECT user_id,expires_at FROM f01.create_staff_account($1,$2,$3,$4,$5,$6::text[])',
      [input.pharmacyId, input.alias, input.displayName, input.unusableHash, input.temporaryKeyHash, [...input.capabilities]]);
    const row = result.rows[0];
    return { userId: String(row.user_id), expiresAt: row.expires_at as Date };
  }

  async listStaff(pharmacyId: string): Promise<readonly StaffMemberRow[]> {
    if (!uuid.test(pharmacyId)) throw new Error('Entrada inválida');
    const result = await this.client.query('SELECT * FROM f01.list_staff($1)', [pharmacyId]);
    return result.rows.map(staffRow);
  }

  private id(value: string): string {
    if (!uuid.test(value)) throw new Error('Entrada inválida');
    return value;
  }

  async inviteStaff(pharmacyId: string, email: string): Promise<void> {
    await this.client.query('SELECT f01.invite_staff($1,$2)', [this.id(pharmacyId), email]);
  }

  async listInvitations(pharmacyId: string): Promise<readonly InvitationRow[]> {
    const result = await this.client.query('SELECT * FROM f01.list_invitations($1)', [this.id(pharmacyId)]);
    return result.rows.map(row => ({ id: String(row.id), destination: String(row.destination),
      state: row.state as InvitationRow['state'], createdAt: row.created_at as Date, expiresAt: row.expires_at as Date }));
  }

  async revokeInvitation(pharmacyId: string, invitationId: string): Promise<void> {
    await this.client.query('SELECT f01.revoke_staff_invitation($1,$2)', [this.id(pharmacyId), this.id(invitationId)]);
  }

  async setStaffCapabilities(pharmacyId: string, membershipId: string, capabilities: readonly string[]): Promise<void> {
    await this.client.query('SELECT f01.set_staff_capabilities($1,$2,$3::text[])',
      [this.id(pharmacyId), this.id(membershipId), [...capabilities]]);
  }

  async listMyInvitations(): Promise<readonly MyInvitationRow[]> {
    const result = await this.client.query('SELECT * FROM f01.list_my_invitations()');
    return result.rows.map(row => ({ id: String(row.id), pharmacyName: String(row.pharmacy_name),
      state: 'PENDIENTE' as const, expiresAt: row.expires_at as Date }));
  }

  async acceptInvitation(invitationId: string): Promise<string> {
    const result = await this.client.query('SELECT f01.accept_staff_invitation($1) AS membership_id', [this.id(invitationId)]);
    return String(result.rows[0].membership_id);
  }

  async declineInvitation(invitationId: string): Promise<void> {
    await this.client.query('SELECT f01.decline_staff_invitation($1)', [this.id(invitationId)]);
  }
}

/** Reutiliza la transacción verificada de F01 (sesión viva, contexto de actor, rol sin BYPASSRLS). */
export class PgStaffUnitOfWork implements StaffUnitOfWork {
  constructor(private readonly identity: PgIdentityUnitOfWork) {}

  runStaff<T>(sessionSecret: string, work: (transaction: StaffTransaction, actorUserId: string) => Promise<T>): Promise<T> {
    return this.identity.runWithClient(sessionSecret, (transaction, client, actorUserId) =>
      work(new PgStaffTransaction(transaction as unknown as AdminMembershipTransaction, client), actorUserId));
  }
}
