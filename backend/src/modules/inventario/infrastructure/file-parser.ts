import ExcelJS from '@excel.js/exceljs';
import { parse } from 'csv-parse/sync';
import type { ParsedInventoryFile } from '../domain/importacion.js';

const maxBytes = 5 * 1024 * 1024;
const maxRows = 5000;
const maxInflated = 50 * 1024 * 1024;

/** Central directory preflight bounds XLSX expansion before ExcelJS loads it. */
function checkZip(bytes: Buffer): void {
  let end = -1;
  for (let position = bytes.length - 22; position >= Math.max(0, bytes.length - 65557); position--) {
    if (bytes.readUInt32LE(position) === 0x06054b50) { end = position; break; }
  }
  if (end < 0 || bytes.readUInt16LE(end + 4) !== 0 || bytes.readUInt16LE(end + 6) !== 0) {
    throw new Error('XLSX inválido');
  }
  const count = bytes.readUInt16LE(end + 10);
  const size = bytes.readUInt32LE(end + 12);
  let position = bytes.readUInt32LE(end + 16);
  if (count < 1 || count > 500 || count === 65535 || position + size > end) {
    throw new Error('XLSX excede límites');
  }
  let inflated = 0;
  for (let index = 0; index < count; index++) {
    if (position + 46 > end || bytes.readUInt32LE(position) !== 0x02014b50) throw new Error('XLSX inválido');
    const flags = bytes.readUInt16LE(position + 8);
    const method = bytes.readUInt16LE(position + 10);
    const compressed = bytes.readUInt32LE(position + 20);
    const uncompressed = bytes.readUInt32LE(position + 24);
    const nameLength = bytes.readUInt16LE(position + 28);
    const extraLength = bytes.readUInt16LE(position + 30);
    const commentLength = bytes.readUInt16LE(position + 32);
    const next = position + 46 + nameLength + extraLength + commentLength;
    if (next > end || flags & 1 || (method !== 0 && method !== 8) ||
        compressed === 0xffffffff || uncompressed === 0xffffffff || uncompressed > 20 * 1024 * 1024) {
      throw new Error('XLSX no permitido');
    }
    const name = bytes.toString('utf8', position + 46, position + 46 + nameLength);
    if (name.includes('..') || name.startsWith('/') || /(?:externalLinks|embeddings|vbaProject)/i.test(name)) {
      throw new Error('XLSX contiene contenido no permitido');
    }
    inflated += uncompressed;
    if (inflated > maxInflated) throw new Error('XLSX excede límites');
    position = next;
  }
  if (position !== bytes.readUInt32LE(end + 16) + size) throw new Error('XLSX inválido');
}

function cellText(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  // Formulas, hyperlinks, rich text, dates and external values are never evaluated or coerced.
  throw new Error('Celda XLSX no permitida');
}

function checkedRows(rows: readonly (readonly string[])[]): ParsedInventoryFile {
  if (rows.length < 2 || rows.length - 1 > maxRows) throw new Error('Archivo sin filas o excede límite');
  const width = rows[0].length;
  if (width < 1 || width > 50 || rows[0].some(value => !value.trim())) throw new Error('Encabezados inválidos');
  if (rows.some(row => row.length !== width || row.some(value => value.length > 10000))) {
    throw new Error('Filas inválidas');
  }
  return { headers: rows[0], rows: rows.slice(1) };
}

export async function parseInventoryFile(bytes: Buffer, filename: string): Promise<ParsedInventoryFile> {
  if (!Buffer.isBuffer(bytes) || bytes.length < 1 || bytes.length > maxBytes) {
    throw new Error('Archivo excede límites');
  }
  if (/\.csv$/i.test(filename)) {
    const content = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    if (content.includes('\0')) throw new Error('CSV inválido');
    const rows = parse(content, { bom: true, skip_empty_lines: true, max_record_size: 10000 }) as string[][];
    return checkedRows(rows);
  }
  if (!/\.xlsx$/i.test(filename)) throw new Error('Formato no permitido');
  checkZip(bytes);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(bytes);
  if (workbook.worksheets.length !== 1) throw new Error('XLSX debe tener una hoja');
  const sheet = workbook.worksheets[0];
  if (sheet.actualRowCount < 2 || sheet.actualRowCount > maxRows + 1 || sheet.columnCount > 50) {
    throw new Error('XLSX excede límites');
  }
  const rows: string[][] = [];
  sheet.eachRow({ includeEmpty: true }, row => {
    if (rows.length > maxRows) throw new Error('XLSX excede límite de filas');
    const cells: string[] = [];
    for (let column = 1; column <= sheet.columnCount; column++) {
      cells.push(cellText(row.getCell(column).value));
    }
    rows.push(cells);
  });
  return checkedRows(rows);
}
