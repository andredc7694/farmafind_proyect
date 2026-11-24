import { suggestImportMapping } from '../domain/importacion.js';
import { createHash } from 'node:crypto';
import type { ImportPreviewAuthorizer, InventoryFileInspectorPort } from './ports.js';

/** Inspection is authorized but never opens an inventory transaction or persists file bytes. */
export class InspectImport {
  constructor(private readonly authorizer: ImportPreviewAuthorizer,
    private readonly files: InventoryFileInspectorPort) {}

  async run(sessionSecret: string, pharmacyId: string, bytes: Buffer, filename: string) {
    await this.authorizer.authorize(sessionSecret, pharmacyId);
    const inspected = await this.files.inspect(bytes, filename);
    const candidates = [];
    for (const sheet of inspected.sheets) {
      for (const headerRow of sheet.headerRows) {
        try {
          const parsed = await this.files.select(bytes, filename, inspected, { sheet: sheet.name, headerRow });
          const suggestion = suggestImportMapping(parsed.headers);
          candidates.push({ sheet: sheet.name, headerRow, headers: parsed.headers,
            headerDigest: createHash('sha256').update(JSON.stringify(parsed.headers)).digest('hex'),
            mapping: suggestion.mapping, ambiguous: suggestion.ambiguous,
            matchedFields: Object.keys(suggestion.mapping).length });
        } catch { /* A heading without valid data is not a candidate. */ }
      }
    }
    return { huella: inspected.digest, hojas: inspected.sheets,
      candidatos: candidates.sort((a, b) => b.matchedFields - a.matchedFields) };
  }
}
