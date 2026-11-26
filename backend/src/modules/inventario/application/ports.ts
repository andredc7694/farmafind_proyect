import type { InventoryCapability } from '../domain/authorization.js';
import type { InventoryReview, InventoryState } from '../domain/inventario.js';
import type { ReconciledImportRow, ParsedInventoryFile, ImportIncident, ImportMapping,
  InspectedInventoryFile, InventoryFileSelection } from '../domain/importacion.js';
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

/** Lectura para pantalla: la fila de inventario con el nombre legible de su producto. */
export interface InventoryListRow extends InventoryRow {
  readonly nombre: string;
  readonly concentracion: string;
  readonly presentacion: string;
  readonly clasificacion: string;
}

export interface ImportCounts {
  readonly rows: number;
  readonly ready: number;
  readonly pending: number;
  readonly duplicated: number;
  readonly added: number;
  readonly updated: number;
}

export interface ImportHistoryRecord extends ImportRecord { readonly counts: ImportCounts; }

/** Qué cambió con una importación confirmada. */
export interface ImportChange {
  readonly nombre: string;
  readonly concentracion: string;
  readonly presentacion: string;
  readonly added: boolean;
  readonly priceBeforeCents: number | null;
  readonly priceAfterCents: number;
  readonly quantityBefore: number | null;
  readonly quantityAfter: number;
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

export interface ImportProfile {
  readonly id: string;
  readonly name: string;
  readonly version: number;
  readonly headerDigest: string;
  readonly sheet: string;
  readonly headerRow: number;
  readonly mapping: ImportMapping;
}

export interface ImportSelectionMetadata {
  readonly sheet: string;
  readonly headerRow: number;
  readonly headerDigest: Buffer;
  readonly mapping: ImportMapping;
}

export interface InventoryRepositoryPort {
  /** F08.1: cifras de solo lectura de la farmacia (productos y sin stock disponible). */
  summary(): Promise<{ products: number; withoutStock: number }>;
  list(): Promise<readonly InventoryListRow[]>;
  movements(): Promise<readonly Record<string, unknown>[]>;
  review(medicationId: string, input: InventoryReview): Promise<InventoryRow>;
}

export interface ImportRepositoryPort {
  create(digest: Buffer, rows: readonly ReconciledImportRow[],
    metadata?: ImportSelectionMetadata): Promise<ImportRecord>;
  findByDigest(digest: Buffer): Promise<ImportRecord | null>;
  find(id: string, lock?: boolean): Promise<ImportRecord | null>;
  rows(id: string): Promise<readonly ReconciledImportRow[]>;
  incidents?(id: string): Promise<readonly ImportIncident[]>;
  profiles?(): Promise<readonly ImportProfile[]>;
  saveProfile?(importId: string, name: string): Promise<ImportProfile>;
  history(): Promise<readonly ImportHistoryRecord[]>;
  changes?(id: string): Promise<readonly ImportChange[]>;
  transition(id: string, state: 'CONFIRMADA' | 'RECHAZADA' | 'EXPIRADA'): Promise<boolean>;
}

export interface InventoryOperationPorts {
  readonly inventory: InventoryRepositoryPort;
  readonly imports: ImportRepositoryPort;
  lookupReferences(names: readonly string[]): Promise<readonly MedicationReference[]>;
  parseFile(bytes: Buffer, filename: string): Promise<ParsedInventoryFile>;
  inspectFile(bytes: Buffer, filename: string): Promise<InspectedInventoryFile>;
  selectFile(bytes: Buffer, filename: string, inspected: InspectedInventoryFile,
    selection: InventoryFileSelection): Promise<ParsedInventoryFile>;
}

export interface InventoryUnitOfWork {
  run<T>(sessionSecret: string, pharmacyId: string, capability: InventoryCapability,
    work: (ports: InventoryOperationPorts, context: AuthorizedInventoryContext) => Promise<T>): Promise<T>;
}

export interface ImportPreviewAuthorizer {
  authorize(sessionSecret: string, pharmacyId: string): Promise<unknown>;
}

export interface InventoryFileInspectorPort {
  inspect(bytes: Buffer, filename: string): Promise<InspectedInventoryFile>;
  select(bytes: Buffer, filename: string, inspected: InspectedInventoryFile,
    selection: InventoryFileSelection): Promise<ParsedInventoryFile>;
}

/** Consumer-owned post-commit port; F02 remains independent from Redis/F03. */
export interface InventorySearchInvalidator { invalidate(): Promise<void>; }
export const NO_INVENTORY_SEARCH_INVALIDATOR: InventorySearchInvalidator = { invalidate: async () => undefined };
