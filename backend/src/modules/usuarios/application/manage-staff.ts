import { randomBytes } from 'node:crypto';
import { authorizeStaffManager, mapStaffDatabaseError } from './staff-errors.js';
import type { PasswordHasher, StaffMemberRow, StaffTransaction, StaffUnitOfWork } from './ports.js';
import { canonicalAlias } from '../domain/alias.js';
import { validateRequestedCapabilities } from '../domain/staff-policy.js';
import { generateTemporaryKey, normalizeTemporaryKey } from '../domain/temporary-key-policy.js';

export interface CreatedStaff {
  readonly userId: string;
  readonly alias: string;
  /** Se entrega una sola vez; no se guarda en claro ni se puede reconsultar. */
  readonly temporaryPassword: string;
  readonly expiresAt: Date;
}

/** Gestión de personal por el propietario autorizado de la farmacia activa (F011-FR-001–002, FR-007). */
export class ManageStaff {
  constructor(private readonly transactions: StaffUnitOfWork, private readonly passwords: PasswordHasher,
    private readonly random: (size: number) => Buffer = randomBytes) {}

  list(secret: string, pharmacyId: string): Promise<readonly StaffMemberRow[]> {
    return this.transactions.runStaff(secret, async (transaction, actorUserId) => {
      await authorizeStaffManager(transaction, actorUserId, pharmacyId);
      try { return await transaction.listStaff(pharmacyId); } catch (error) { throw mapStaffDatabaseError(error); }
    });
  }

  async create(secret: string, pharmacyId: string,
    input: { alias: unknown; displayName: unknown; capabilities?: unknown }): Promise<CreatedStaff> {
    const alias = canonicalAlias(input.alias);
    const displayName = typeof input.displayName === 'string' ? input.displayName.trim() : '';
    if (displayName.length < 1 || displayName.length > 120) throw new Error('Entrada inválida');
    const capabilities = validateRequestedCapabilities(input.capabilities ?? []);
    // Los hashes Argon2id se calculan antes de abrir la transacción para no retener la conexión.
    const temporaryKey = generateTemporaryKey(this.random);
    const normalized = normalizeTemporaryKey(temporaryKey);
    if (!normalized) throw new Error('No se pudo generar la clave temporal');
    const [temporaryKeyHash, unusableHash] = await Promise.all([
      this.passwords.hash(normalized), this.passwords.hash(this.random(32).toString('hex'))]);
    return this.transactions.runStaff(secret, async (transaction, actorUserId) => {
      await authorizeStaffManager(transaction, actorUserId, pharmacyId);
      try {
        const created = await transaction.createStaffAccount({ pharmacyId, alias, displayName, unusableHash,
          temporaryKeyHash, capabilities });
        return { userId: created.userId, alias, temporaryPassword: temporaryKey, expiresAt: created.expiresAt };
      } catch (error) { throw mapStaffDatabaseError(error); }
    });
  }
}
