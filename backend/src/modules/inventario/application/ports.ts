import type { InventoryCapability } from '../domain/authorization.js';
import type { InventoryReview, InventoryState } from '../domain/inventario.js';
import type { ReconciledImportRow, ParsedInventoryFile } from '../domain/importacion.js';
import type { MedicationReference } from '../../medicamentos/contracts/reference.js';
import type { AuthorizedInventoryContext } from './authorized-context.js';

export interface InventoryRow {
  readonly id: string;
  readonly farmaciaId: string;
  readonly medicamentoId: string;
  readonly precioReferencial: number;
  readonly cantidadFisica: number;
  readonly cantidadComprometida: number;
  readonly ultimaRevision: string;
  readonly version: number;
}

export interface ImportRecord {
  readonly id: string;
  readonly pharmacyId: string;
  readonly actorUserId: string;
  readonly state: 'VISTA_PREVIA' | 'CONFIRMADA' | 'RECHAZADA' | 'EXPIRADA';
  readonly errorCount: number;
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly confirmedAt: string | null;
}

export interface InventoryRepositoryPort {
  list(): Promise<readonly InventoryRow[]>;
  movements(): Promise<readonly Record<string, unknown>[]>;
  review(medicationId: string, input: InventoryReview): Promise<InventoryRow>;
}

export interface ImportRepositoryPort {
  create(digest: Buffer, rows: readonly ReconciledImportRow[]): Promise<ImportRecord>;
  find(id: string, lock?: boolean): Promise<ImportRecord | null>;
  rows(id: string): Promise<readonly ReconciledImportRow[]>;
  history(): Promise<readonly ImportRecord[]>;
  transition(id: string, state: 'CONFIRMADA' | 'RECHAZADA' | 'EXPIRADA'): Promise<boolean>;
}

export interface InventoryOperationPorts {
  readonly inventory: InventoryRepositoryPort;
  readonly imports: ImportRepositoryPort;
  lookupReferences(names: readonly string[]): Promise<readonly MedicationReference[]>;
  parseFile(bytes: Buffer, filename: string): Promise<ParsedInventoryFile>;
}

export interface InventoryUnitOfWork {
  run<T>(sessionSecret: string, pharmacyId: string, capability: InventoryCapability,
    work: (ports: InventoryOperationPorts, context: AuthorizedInventoryContext) => Promise<T>): Promise<T>;
}

/** Consumer-owned post-commit port; F02 remains independent from Redis/F03. */
export interface InventorySearchInvalidator { invalidate(): Promise<void>; }
export const NO_INVENTORY_SEARCH_INVALIDATOR: InventorySearchInvalidator = { invalidate: async () => undefined };
