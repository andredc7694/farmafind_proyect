import { assessConfirmation, rowsAfterExclusion, type ReconciledImportRow, type ImportIncident,
  type ImportExclusion } from '../domain/importacion.js';
import { NO_INVENTORY_SEARCH_INVALIDATOR, type InventorySearchInvalidator, type InventoryUnitOfWork, type ImportRecord,
  type ImportHistoryRecord, type ImportChange } from './ports.js';

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

/** Vista del historial: autor, conteos en filas y qué se agregó o actualizó. */
export interface PublicImportHistory extends PublicImport {
  readonly autorId: string;
  readonly porMi: boolean;
  readonly filas: number;
  readonly listas: number;
  readonly pendientes: number;
  readonly duplicadas: number;
  readonly conErrores: number;
  /** Solo en confirmadas: filas aplicadas y filas que el usuario dejó fuera. */
  readonly importadas: number;
  readonly excluidas: number;
  readonly agregados: number;
  readonly actualizados: number;
}

function historyRecord(record: ImportHistoryRecord, actorUserId: string): PublicImportHistory {
  const { rows, ready, pending, duplicated, added, updated } = record.counts;
  const confirmed = record.state === 'CONFIRMADA';
  return { ...publicRecord(record), autorId: record.actorUserId, porMi: record.actorUserId === actorUserId,
    filas: rows, listas: ready, pendientes: pending, duplicadas: duplicated,
    conErrores: Math.max(0, rows - ready - pending - duplicated),
    // Una confirmada con filas no listas solo pudo confirmarse excluyéndolas.
    importadas: confirmed ? ready : 0, excluidas: confirmed ? rows - ready : 0, agregados: added, actualizados: updated };
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

  async confirm(secret: string, pharmacyId: string, importId: string, exclusion?: ImportExclusion): Promise<PublicImport> {
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
          const incidents = await imports.incidents?.(importId) ?? [];
          // Con exclusión explícita, una decisión que no calza no cambia nada: ni el inventario ni la vista previa.
          let applied = rows; let blocking = incidents;
          if (exclusion && locked.state === 'VISTA_PREVIA') {
            const included = rowsAfterExclusion(rows, incidents, exclusion);
            if (!included) throw new ImportConflictError('Exclusión no válida');
            const lines = new Set(included.map(row => row.line));
            applied = included; blocking = incidents.filter(item => lines.has(item.line));
          }
          let assessment = assessConfirmation(locked.state, locked.expiresAt, new Date().toISOString(), applied);
          if (assessment === 'CONFIRMABLE' && blocking.length > 0) assessment = 'RECHAZADA';
          if (assessment === 'ALREADY_CONFIRMED') return locked;
          if (assessment === 'CONFLICT') throw new ImportConflictError('Importación no confirmable');
          if (assessment === 'EXPIRADA' || assessment === 'RECHAZADA') {
            await imports.transition(importId, assessment);
            const changed = await imports.find(importId);
            if (!changed) throw new Error('No visible');
            return changed;
          }
          const inventory = ports.inventory;
          const ordered = [...applied].sort((a, b) => a.medicationId!.localeCompare(b.medicationId!));
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

  async history(secret: string, pharmacyId: string): Promise<readonly PublicImportHistory[]> {
    return this.transactions.run(secret, pharmacyId, 'inventory.history', async (ports, context) =>
      (await ports.imports.history()).map(record => historyRecord(record, context.actorUserId)));
  }

  async status(secret: string, pharmacyId: string, importId: string): Promise<
    PublicImport & { readonly incidencias: readonly ImportIncident[]; readonly cambios: readonly ImportChange[];
      readonly excluidas: readonly { readonly fila: number; readonly motivo: string }[] }> {
    return this.transactions.run(secret, pharmacyId, 'inventory.history', async ports => {
      const imports = ports.imports;
      const record = await imports.find(importId);
      if (!record) throw new Error('No visible');
      const rows: readonly ReconciledImportRow[] = await imports.rows(importId);
      const incidents = await imports.incidents?.(importId);
      const changes = record.state === 'CONFIRMADA' ? await imports.changes?.(importId) ?? [] : [];
      const excluded = record.state === 'CONFIRMADA'
        ? rows.filter(row => row.errorCode !== null).map(row => ({ fila: row.line, motivo: row.errorCode! })) : [];
      return { ...publicRecord(record), cambios: changes, excluidas: excluded, incidencias: incidents ?? rows.filter(row => row.errorCode !== null)
        .map(row => ({ line: row.line, field: 'nombre', column: 'nombre', code: row.errorCode!,
          title: 'Incidencia de importación', cause: 'Revisa el archivo',
          action: 'Corrige y vuelve a validar', supportCode: `F021-${row.errorCode}` })) };
    });
  }
}
