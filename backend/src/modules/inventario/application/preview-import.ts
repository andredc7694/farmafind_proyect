import { createHash, randomUUID } from 'node:crypto';
import { reconcileImportRows, type ImportMapping, type ReconciledImportRow } from '../domain/importacion.js';
import type { ImportIncident } from '../domain/importacion.js';
import type { InventoryUnitOfWork, ImportSelectionMetadata } from './ports.js';
import type { InventoryFileSelection } from '../domain/importacion.js';

export interface PreviewResult {
  readonly importacionId: string;
  readonly estado: 'VISTA_PREVIA';
  readonly filas: readonly ReconciledImportRow[];
  readonly errores: readonly { readonly fila: number; readonly codigo: string }[];
  readonly incidencias?: readonly ImportIncident[];
  readonly caducaEn: string;
}

/** Error con mensaje para el usuario (sin detalles internos). `conflict` responde 409. */
export class PreviewInputError extends Error {
  constructor(message: string, readonly conflict = false) { super(message); }
}

/** Traduce los rechazos del lector a causa + solución; nunca expone trazas. */
export function describeFileError(error: unknown): string {
  const text = error instanceof Error ? error.message : '';
  const messages: readonly (readonly [RegExp, string])[] = [
    [/Formato no permitido/, 'Formato no admitido. Sube un archivo .xlsx o .csv.'],
    [/contenido no permitido/, 'El libro contiene macros, vínculos externos u objetos incrustados. Guárdalo como .xlsx simple y vuelve a subirlo.'],
    [/XLSX no permitido/, 'El libro está protegido con contraseña o tiene un formato no admitido. Guárdalo sin contraseña como .xlsx.'],
    [/XLSX inválido|invalid|End of data|zip/i, 'No se pudo abrir el archivo: está dañado o no es un .xlsx real. Ábrelo en tu hoja de cálculo y guárdalo de nuevo.'],
    [/límite de hojas/, 'El libro tiene demasiadas hojas (máximo 20). Deja solo las necesarias.'],
    [/una hoja/, 'El libro tiene varias hojas y no se indicó cuál usar. Vuelve a elegir el archivo para analizarlo.'],
    [/Celda XLSX no permitida/, 'Hay celdas con fecha, fórmula o enlace. Vuelve a elegir el archivo para ver cuáles son.'],
    [/límite|excede/, 'El archivo supera los límites (5 MB, 5 000 filas, 50 columnas). Divídelo en partes más pequeñas.'],
    [/Encabezados duplicados/, 'Hay dos columnas con el mismo encabezado. Cambia el nombre de una.'],
    [/Encabezados inválidos/, 'Falta el nombre de alguna columna en la fila de encabezados. Completa todos los encabezados.'],
    [/sin filas/, 'La hoja no tiene filas de datos debajo de los encabezados.'],
    [/Mapeo incompleto|Mapeo/, 'Falta indicar qué columna corresponde a alguno de los datos obligatorios.'],
    [/Archivo distinto/, 'El archivo cambió después del análisis. Vuelve a elegirlo.'],
    [/Selección inválida/, 'La hoja o la fila de encabezados elegida no es válida. Vuelve a elegir el archivo.'],
    [/UTF|encoded|decode/i, 'El CSV no está en UTF-8. Guárdalo como «CSV UTF-8» y vuelve a subirlo.'],
  ];
  return messages.find(([pattern]) => pattern.test(text))?.[1] ??
    'No se pudo leer el archivo. Revisa que tenga una hoja con encabezados y filas de inventario.';
}

export class PreviewImport {
  constructor(private readonly transactions: InventoryUnitOfWork) {}

  authorize(secret: string, pharmacyId: string): Promise<void> {
    return this.transactions.run(secret, pharmacyId, 'inventory.import.preview', async () => {});
  }

  async run(secret: string, pharmacyId: string, bytes: Buffer, filename: string,
    mapping: ImportMapping, selection?: InventoryFileSelection & { readonly digest: string }): Promise<PreviewResult> {
    return this.transactions.run(secret, pharmacyId, 'inventory.import.preview', async (ports) => {
      let parsed;
      try {
        if (selection) {
          const inspected = await ports.inspectFile(bytes, filename);
          if (selection.digest !== inspected.digest) throw new Error('Archivo distinto');
          parsed = await ports.selectFile(bytes, filename, inspected, selection);
        } else parsed = await ports.parseFile(bytes, filename);
      }
      catch (error) { throw new PreviewInputError(describeFileError(error)); }
      const names = [...new Set(parsed.rows.map(row => row[parsed.headers.findIndex(header =>
        header.trim().toLowerCase() === mapping.nombre.trim().toLowerCase())]?.trim().toLowerCase())
        .filter(Boolean))];
      const catalog = await ports.lookupReferences(names);
      let rows;
      try { rows = reconcileImportRows(parsed, mapping, catalog, pharmacyId); }
      catch (error) { throw new PreviewInputError(describeFileError(error)); }
      // Sin selección (contrato F02) se conserva la huella del archivo: repetirlo responde 409. Con hoja elegida (F02.1) la
      // huella identifica archivo + interpretación + resultado: reajustar columnas o ampliar el catálogo permite revisar de nuevo.
      let digest = selection ? createHash('sha256').update(bytes).update(JSON.stringify([selection.sheet, selection.headerRow, mapping,
        rows.map(row => [row.line, row.medicationId, row.priceCents, row.physicalQuantity, row.errorCode])])).digest()
        : createHash('sha256').update(bytes).digest();
      const previous = selection ? await ports.imports.findByDigest(digest) : null;
      if (previous?.state === 'CONFIRMADA') {
        throw new PreviewInputError('Este archivo ya se confirmó con estos mismos datos. Para cambiar existencias, sube un archivo actualizado.', true);
      }
      const reusable = previous?.state === 'VISTA_PREVIA' && Date.parse(previous.expiresAt) > Date.now();
      if (previous && !reusable) digest = createHash('sha256').update(digest).update(randomUUID()).digest();
      const metadata: ImportSelectionMetadata | undefined = selection ? {
        sheet: selection.sheet, headerRow: selection.headerRow,
        headerDigest: createHash('sha256').update(JSON.stringify(parsed.headers)).digest(), mapping,
      } : undefined;
      const stored = reusable ? previous! : await ports.imports.create(digest, rows, metadata);
      return { importacionId: stored.id, estado: 'VISTA_PREVIA', filas: rows,
        errores: rows.filter(row => row.errorCode !== null).map(row => ({ fila: row.line, codigo: row.errorCode! })),
        incidencias: rows.flatMap(row => row.incidents ?? []),
        caducaEn: stored.expiresAt };
    });
  }
}
