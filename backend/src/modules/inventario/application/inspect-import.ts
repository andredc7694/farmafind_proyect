import { suggestImportMapping } from '../domain/importacion.js';
import { createHash } from 'node:crypto';
import type { ImportPreviewAuthorizer, InventoryFileInspectorPort } from './ports.js';

/** Una hoja solo es de inventario si se reconocen al menos estos campos; las demás (p. ej. «Léeme») se ignoran. */
const minimumFields = 3;

/** Inspection is authorized but never opens an inventory transaction or persists file bytes. */
export class InspectImport {
  constructor(private readonly authorizer: ImportPreviewAuthorizer,
    private readonly files: InventoryFileInspectorPort) {}

  async run(sessionSecret: string, pharmacyId: string, bytes: Buffer, filename: string) {
    await this.authorizer.authorize(sessionSecret, pharmacyId);
    const inspected = await this.files.inspect(bytes, filename);
    const candidates = [];
    for (const sheet of inspected.sheets) {
      let best;
      for (const headerRow of sheet.headerRows) {
        try {
          const parsed = await this.files.select(bytes, filename, inspected, { sheet: sheet.name, headerRow });
          const suggestion = suggestImportMapping(parsed.headers, parsed.rows);
          const candidate = { sheet: sheet.name, headerRow, headers: parsed.headers, filas: parsed.rows.length,
            headerDigest: createHash('sha256').update(JSON.stringify(parsed.headers)).digest('hex'),
            mapping: suggestion.mapping, ambiguous: suggestion.ambiguous, headerMatches: suggestion.headerMatches,
            matchedFields: Object.keys(suggestion.mapping).length,
            preguntas: [...suggestion.ambiguous.map(campo => ({ campo, motivo: 'AMBIGUO' as const })),
              ...suggestion.missing.map(campo => ({ campo, motivo: 'FALTA' as const }))] };
          // Gana la fila con más encabezados reconocidos por nombre; a igualdad, más campos y la fila más arriba.
          if (!best || candidate.headerMatches > best.headerMatches ||
              (candidate.headerMatches === best.headerMatches && candidate.matchedFields > best.matchedFields)) best = candidate;
          if (candidate.headerMatches === 6) break;
        } catch { /* A heading without valid data is not a candidate. */ }
      }
      if (best) candidates.push(best);
    }
    const useful = candidates.filter(item => item.matchedFields + item.ambiguous.length >= minimumFields)
      .sort((a, b) => b.matchedFields - a.matchedFields || b.headerMatches - a.headerMatches);
    const stockElsewhere = candidates.filter(item => item.mapping.cantidadFisica !== undefined)
      .map(item => ({ hoja: item.sheet, columna: item.mapping.cantidadFisica! }));
    return { huella: inspected.digest, hojas: inspected.sheets, candidatos: useful, hojasConStock: stockElsewhere,
      hojasIgnoradas: inspected.sheets.map(sheet => sheet.name).filter(name => !useful.some(item => item.sheet === name)) };
  }
}
