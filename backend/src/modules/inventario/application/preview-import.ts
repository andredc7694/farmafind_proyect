import { createHash } from 'node:crypto';
import { reconcileImportRows, type ImportMapping, type ReconciledImportRow } from '../domain/importacion.js';
import type { InventoryUnitOfWork } from './ports.js';

export interface PreviewResult {
  readonly importacionId: string;
  readonly estado: 'VISTA_PREVIA';
  readonly filas: readonly ReconciledImportRow[];
  readonly errores: readonly { readonly fila: number; readonly codigo: string }[];
  readonly caducaEn: string;
}

export class PreviewInputError extends Error {}

export class PreviewImport {
  constructor(private readonly transactions: InventoryUnitOfWork) {}

  authorize(secret: string, pharmacyId: string): Promise<void> {
    return this.transactions.run(secret, pharmacyId, 'inventory.import.preview', async () => {});
  }

  async run(secret: string, pharmacyId: string, bytes: Buffer, filename: string,
    mapping: ImportMapping): Promise<PreviewResult> {
    return this.transactions.run(secret, pharmacyId, 'inventory.import.preview', async (ports) => {
      let parsed;
      try { parsed = await ports.parseFile(bytes, filename); }
      catch { throw new PreviewInputError('Archivo inválido'); }
      const names = [...new Set(parsed.rows.map(row => row[parsed.headers.findIndex(header =>
        header.trim().toLowerCase() === mapping.nombre.trim().toLowerCase())]?.trim().toLowerCase())
        .filter(Boolean))];
      const catalog = await ports.lookupReferences(names);
      let rows;
      try { rows = reconcileImportRows(parsed, mapping, catalog, pharmacyId); }
      catch { throw new PreviewInputError('Mapeo inválido'); }
      const digest = createHash('sha256').update(bytes).digest();
      const stored = await ports.imports.create(digest, rows);
      return { importacionId: stored.id, estado: 'VISTA_PREVIA', filas: rows,
        errores: rows.filter(row => row.errorCode !== null).map(row => ({ fila: row.line, codigo: row.errorCode! })),
        caducaEn: stored.expiresAt };
    });
  }
}
