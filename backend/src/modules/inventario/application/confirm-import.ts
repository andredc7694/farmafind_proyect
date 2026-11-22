import { assessConfirmation, type ReconciledImportRow } from '../domain/importacion.js';
import { NO_INVENTORY_SEARCH_INVALIDATOR, type InventorySearchInvalidator, type InventoryUnitOfWork, type ImportRecord } from './ports.js';

export class ImportConflictError extends Error {}
class ApplyConflictError extends Error {}

export interface PublicImport {
  readonly importacionId: string;
  readonly estado: ImportRecord['state'];
  readonly errores: number;
  readonly creadaEn: string;
  readonly caducaEn: string;
  readonly confirmadaEn: string | null;
}

function publicRecord(record: ImportRecord): PublicImport {
  return { importacionId: record.id, estado: record.state, errores: record.errorCount,
    creadaEn: record.createdAt, caducaEn: record.expiresAt, confirmadaEn: record.confirmedAt };
}

function isApplyConflict(error: unknown): boolean {
  if (error instanceof Error && ['Revisión de inventario inválida','Referencia no visible',
    'Conflicto de inventario','Inventario no visible'].includes(error.message)) return true;
  return typeof error === 'object' && error !== null && 'code' in error &&
    ['23514','23503','23505','40001','40P01'].includes(String(error.code));
}

export class ConfirmImport {
  constructor(private readonly transactions: InventoryUnitOfWork,
    private readonly searchInvalidator: InventorySearchInvalidator = NO_INVENTORY_SEARCH_INVALIDATOR) {}

  async confirm(secret: string, pharmacyId: string, importId: string): Promise<PublicImport> {
    let outcome: ImportRecord;
    try {
      outcome = await this.transactions.run(secret, pharmacyId, 'inventory.import.confirm',
        async (ports, context) => {
          const imports = ports.imports;
          const initial = await imports.find(importId);
          if (!initial || initial.actorUserId !== context.actorUserId) throw new Error('No visible');
          if (initial.state === 'CONFIRMADA') return initial;
          const locked = await imports.find(importId, true);
          if (!locked) {
            const current = await imports.find(importId);
            if (current?.state === 'CONFIRMADA' && current.actorUserId === context.actorUserId) return current;
            throw new ImportConflictError('Importación no confirmable');
          }
          const rows = await imports.rows(importId);
          const assessment = assessConfirmation(locked.state, locked.expiresAt, new Date().toISOString(), rows);
          if (assessment === 'ALREADY_CONFIRMED') return locked;
          if (assessment === 'CONFLICT') throw new ImportConflictError('Importación no confirmable');
          if (assessment === 'EXPIRADA' || assessment === 'RECHAZADA') {
            await imports.transition(importId, assessment);
            const changed = await imports.find(importId);
            if (!changed) throw new Error('No visible');
            return changed;
          }
          const inventory = ports.inventory;
          const ordered = [...rows].sort((a, b) => a.medicationId!.localeCompare(b.medicationId!));
          for (const row of ordered) {
            try {
              await inventory.review(row.medicationId!, {
                physicalQuantity: row.physicalQuantity!, priceCents: row.priceCents!,
                reason: `Importación ${importId}`, actorUserId: context.actorUserId,
                at: new Date().toISOString(),
              });
            } catch (error) {
              if (isApplyConflict(error)) throw new ApplyConflictError('Conflicto de importación');
              throw error;
            }
          }
          if (!await imports.transition(importId, 'CONFIRMADA')) throw new ApplyConflictError('Conflicto de importación');
          const updated = await imports.find(importId);
          if (!updated) throw new Error('No visible');
          return updated;
        });
    } catch (error) {
      if (!(error instanceof ApplyConflictError)) throw error;
      // The file transaction rolled back. Record only its terminal result in a new authorized transaction.
      await this.transactions.run(secret, pharmacyId, 'inventory.import.confirm', async (ports, context) => {
        const imports = ports.imports;
        const record = await imports.find(importId, true);
        if (record?.state === 'VISTA_PREVIA' && record.actorUserId === context.actorUserId) {
          await imports.transition(importId, 'RECHAZADA');
        }
      });
      throw new ImportConflictError('Importación no confirmable');
    }
    if (outcome.state !== 'CONFIRMADA') throw new ImportConflictError('Importación no confirmable');
    await this.searchInvalidator.invalidate();
    return publicRecord(outcome);
  }

  async history(secret: string, pharmacyId: string): Promise<readonly PublicImport[]> {
    return this.transactions.run(secret, pharmacyId, 'inventory.history', async ports =>
      (await ports.imports.history()).map(publicRecord));
  }

  async status(secret: string, pharmacyId: string, importId: string): Promise<
    PublicImport & { readonly incidencias: readonly { fila: number; codigo: string }[] }> {
    return this.transactions.run(secret, pharmacyId, 'inventory.history', async ports => {
      const imports = ports.imports;
      const record = await imports.find(importId);
      if (!record) throw new Error('No visible');
      const rows: readonly ReconciledImportRow[] = await imports.rows(importId);
      return { ...publicRecord(record), incidencias: rows.filter(row => row.errorCode !== null)
        .map(row => ({ fila: row.line, codigo: row.errorCode! })) };
    });
  }
}
