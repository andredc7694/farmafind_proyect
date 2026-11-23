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
  list(): Promise<readonly InventoryRow[]>;
  movements(): Promise<readonly Record<string, unknown>[]>;
  review(medicationId: string, input: InventoryReview): Promise<InventoryRow>;
}

export interface ImportRepositoryPort {
  create(digest: Buffer, rows: readonly ReconciledImportRow[],
    metadata?: ImportSelectionMetadata): Promise<ImportRecord>;
  find(id: string, lock?: boolean): Promise<ImportRecord | null>;
  rows(id: string): Promise<readonly ReconciledImportRow[]>;
  incidents?(id: string): Promise<readonly ImportIncident[]>;
  profiles?(): Promise<readonly ImportProfile[]>;
  saveProfile?(importId: string, name: string): Promise<ImportProfile>;
  history(): Promise<readonly ImportRecord[]>;
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
