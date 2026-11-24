import { authorizeStaffManager, mapStaffDatabaseError } from './staff-errors.js';
import type { InvitationRow, MyInvitationRow, StaffTransaction, StaffUnitOfWork } from './ports.js';
import { canonicalEmail } from './registration.js';
import { validateRequestedCapabilities } from '../domain/staff-policy.js';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function requireId(value: unknown): string {
  if (typeof value !== 'string' || !uuid.test(value)) throw new Error('Entrada inválida');
  return value;
}

/** Invitaciones, permisos delegados y respuestas del destinatario (F011-FR-004–007). */
export class ManageStaffAccess {
  constructor(private readonly transactions: StaffUnitOfWork) {}

  private manage<T>(secret: string, pharmacyId: string, work: (transaction: StaffTransaction) => Promise<T>): Promise<T> {
    return this.transactions.runStaff(secret, async (transaction, actorUserId) => {
      await authorizeStaffManager(transaction, actorUserId, pharmacyId);
      try { return await work(transaction); } catch (error) { throw mapStaffDatabaseError(error); }
    });
  }

  /** Respuesta siempre silenciosa: nunca indica si la cuenta existe. */
  invite(secret: string, pharmacyId: string, email: unknown): Promise<void> {
    const canonical = canonicalEmail(email);
    return this.manage(secret, pharmacyId, transaction => transaction.inviteStaff(pharmacyId, canonical));
  }

  listInvitations(secret: string, pharmacyId: string): Promise<readonly InvitationRow[]> {
    return this.manage(secret, pharmacyId, transaction => transaction.listInvitations(pharmacyId));
  }

  revokeInvitation(secret: string, pharmacyId: string, invitationId: unknown): Promise<void> {
    const id = requireId(invitationId);
    return this.manage(secret, pharmacyId, transaction => transaction.revokeInvitation(pharmacyId, id));
  }

  setCapabilities(secret: string, pharmacyId: string, membershipId: unknown, capabilities: unknown): Promise<void> {
    const id = requireId(membershipId);
    const codes = validateRequestedCapabilities(capabilities);
    return this.manage(secret, pharmacyId, transaction => transaction.setStaffCapabilities(pharmacyId, id, codes));
  }

  listMine(secret: string): Promise<readonly MyInvitationRow[]> {
    return this.transactions.runStaff(secret, async transaction => {
      try { return await transaction.listMyInvitations(); } catch (error) { throw mapStaffDatabaseError(error); }
    });
  }

  accept(secret: string, invitationId: unknown): Promise<void> {
    const id = requireId(invitationId);
    return this.transactions.runStaff(secret, async transaction => {
      try { await transaction.acceptInvitation(id); } catch (error) { throw mapStaffDatabaseError(error); }
    });
  }

  decline(secret: string, invitationId: unknown): Promise<void> {
    const id = requireId(invitationId);
    return this.transactions.runStaff(secret, async transaction => {
      try { await transaction.declineInvitation(id); } catch (error) { throw mapStaffDatabaseError(error); }
    });
  }
}
