import { catalogKey, type MedicationReference } from '../../medicamentos/contracts/reference.js';

export interface ParsedInventoryFile {
  readonly headers: readonly string[];
  readonly rows: readonly (readonly string[])[];
  readonly sourceLines?: readonly number[];
}

export interface InspectedInventoryFile {
  readonly digest: string;
  readonly sheets: readonly { name: string; headerRows: readonly number[]; rowCount: number }[];
}

export interface InventoryFileSelection {
  readonly sheet: string;
  readonly headerRow: number;
}

export interface ImportMapping {
  readonly nombre: string;
  readonly concentracion: string;
  readonly presentacion: string;
  readonly clasificacion: string;
  readonly precioReferencial: string;
  readonly cantidadFisica: string;
  readonly farmaciaId?: string;
}

export interface ReconciledImportRow {
  readonly line: number;
  readonly medicationId: string | null;
  readonly priceCents: number | null;
  readonly physicalQuantity: number | null;
  readonly errorCode: string | null;
  readonly incidents?: readonly ImportIncident[];
}

export interface ImportIncident {
  readonly line: number;
  readonly field: string;
  readonly column: string;
  readonly code: string;
  readonly title: string;
  readonly cause: string;
  readonly action: string;
  readonly supportCode: string;
}

const incidentMessages: Readonly<Record<string, readonly [string, string, string]>> = {
  PRECIO_REQUERIDO: ['Falta el precio', 'La celda está vacía', 'Completa un precio válido y vuelve a validar'],
  PRECIO_INVALIDO: ['Precio inválido', 'El formato o rango no es válido', 'Corrige el precio y vuelve a validar'],
  CANTIDAD_REQUERIDA: ['Falta la cantidad', 'La celda está vacía', 'Completa la cantidad y vuelve a validar'],
  CANTIDAD_INVALIDA: ['Cantidad inválida', 'El formato o rango no es válido', 'Corrige la cantidad y vuelve a validar'],
  REFERENCIA_NO_CONCILIADA: ['Referencia no encontrada', 'No coincide con el catálogo autorizado', 'Revisa los datos del producto'],
  REFERENCIA_AMBIGUA: ['Referencia ambigua', 'Hay más de una coincidencia exacta', 'Resuelve la referencia antes de confirmar'],
  REFERENCIA_INVALIDA: ['Referencia inválida', 'Faltan atributos requeridos', 'Completa los campos del producto'],
  FILA_DUPLICADA: ['Fila duplicada', 'El producto aparece más de una vez', 'Elimina o corrige la fila repetida'],
  FARMACIA_AJENA: ['Farmacia distinta', 'La fila declara otra farmacia', 'Usa un archivo de la farmacia autorizada'],
};

function incident(line: number, field: string, column: string, code: string): ImportIncident {
  const [title, cause, action] = incidentMessages[code];
  return { line, field, column, code, title, cause, action, supportCode: `F021-${code}` };
}

export type ImportState = 'VISTA_PREVIA' | 'CONFIRMADA' | 'RECHAZADA' | 'EXPIRADA';
export type ConfirmationAssessment = 'CONFIRMABLE' | 'ALREADY_CONFIRMED' | 'EXPIRADA' | 'RECHAZADA' | 'CONFLICT';

export function assessConfirmation(state: ImportState, expiresAt: string, now: string,
  rows: readonly ReconciledImportRow[]): ConfirmationAssessment {
  if (state === 'CONFIRMADA') return 'ALREADY_CONFIRMED';
  if (state !== 'VISTA_PREVIA') return 'CONFLICT';
  if (Date.parse(expiresAt) <= Date.parse(now)) return 'EXPIRADA';
  if (rows.length === 0 || rows.some(row => row.errorCode !== null || !row.medicationId ||
      row.priceCents === null || row.physicalQuantity === null)) return 'RECHAZADA';
  return 'CONFIRMABLE';
}

function normalizedHeader(value: string): string {
  return value.normalize('NFKC').trim().toLocaleLowerCase('es-PE');
}

export const IMPORT_ALIAS_VERSION = 1;

export function validateImportProfileName(name: string): string {
  if (!/^[\p{L}\p{N} ._-]{1,80}$/u.test(name) || name.trim() !== name) {
    throw new Error('Nombre de perfil inválido');
  }
  return name;
}

export function isImportProfileCompatible(profile: {
  readonly version: number; readonly headerDigest: string;
  readonly sheet: string; readonly headerRow: number;
}, headerDigest: string, sheet: string, headerRow: number): boolean {
  return profile.version === IMPORT_ALIAS_VERSION && profile.headerDigest === headerDigest &&
    profile.sheet === sheet && profile.headerRow === headerRow;
}
const importAliases: Readonly<Record<keyof Omit<ImportMapping, 'farmaciaId'>, readonly string[]>> = {
  nombre: ['nombre', 'medicamento', 'producto'],
  concentracion: ['concentracion', 'concentración'],
  presentacion: ['presentacion', 'presentación'],
  clasificacion: ['clasificacion', 'clasificación'],
  precioReferencial: ['precio', 'precio unitario', 'precio referencial'],
  cantidadFisica: ['cantidad', 'cantidad fisica', 'cantidad física', 'stock', 'existencia'],
};

/** Dictionary v1: exact normalized labels only; uncertain clinical fields stay unmapped. */
export function suggestImportMapping(headers: readonly string[]): {
  readonly mapping: Partial<ImportMapping>;
  readonly ambiguous: readonly (keyof Omit<ImportMapping, 'farmaciaId'>)[];
} {
  const mapping: Partial<Record<keyof Omit<ImportMapping, 'farmaciaId'>, string>> = {};
  const ambiguous: (keyof Omit<ImportMapping, 'farmaciaId'>)[] = [];
  for (const [field, aliases] of Object.entries(importAliases) as
      [keyof Omit<ImportMapping, 'farmaciaId'>, readonly string[]][]) {
    const matches = headers.filter(header => aliases.some(alias => normalizedHeader(alias) === normalizedHeader(header)));
    if (matches.length === 1) mapping[field] = matches[0];
    else if (matches.length > 1) ambiguous.push(field);
  }
  return { mapping, ambiguous };
}

function priceCents(value: string): number | null {
  if (!/^\d{1,12}(?:[.,]\d{1,2})?$/.test(value.trim())) return null;
  const [units, decimals = ''] = value.trim().replace(',', '.').split('.');
  const result = Number(units) * 100 + Number(decimals.padEnd(2, '0'));
  return Number.isSafeInteger(result) ? result : null;
}

function quantity(value: string): number | null {
  if (!/^(?:0|[1-9]\d{0,9})$/.test(value.trim())) return null;
  const result = Number(value.trim());
  return Number.isInteger(result) && result <= 2147483647 ? result : null;
}

export function reconcileImportRows(parsed: ParsedInventoryFile, mapping: ImportMapping,
  catalog: readonly MedicationReference[], pharmacyId: string): readonly ReconciledImportRow[] {
  const headers = parsed.headers.map(normalizedHeader);
  if (new Set(headers).size !== headers.length) throw new Error('Encabezados duplicados');
  const required = ['nombre','concentracion','presentacion','clasificacion',
    'precioReferencial','cantidadFisica'] as const;
  const indexes = Object.fromEntries(required.map(key => [key, headers.indexOf(normalizedHeader(mapping[key]))])) as
    Record<(typeof required)[number], number>;
  if (Object.values(indexes).some(index => index < 0) || new Set(Object.values(indexes)).size !== required.length) {
    throw new Error('Mapeo incompleto o duplicado');
  }
  const declaredPharmacy = mapping.farmaciaId === undefined ? headers.indexOf('farmacia_id')
    : headers.indexOf(normalizedHeader(mapping.farmaciaId));
  if (mapping.farmaciaId !== undefined && declaredPharmacy < 0) throw new Error('Mapeo de farmacia inválido');
  const seen = new Set<string>();
  return parsed.rows.map((row, index) => {
    const line = parsed.sourceLines?.[index] ?? index + 2;
    const incidents: ImportIncident[] = [];
    let errorCode: string | null = null;
    let medicationId: string | null = null;
    let key = '';
    try {
      key = catalogKey({ name: row[indexes.nombre], concentration: row[indexes.concentracion],
        presentation: row[indexes.presentacion], classification: row[indexes.clasificacion] });
      const matches = catalog.filter(item => item.state === 'ACTIVO' && item.key === key);
      if (matches.length === 0) errorCode = 'REFERENCIA_NO_CONCILIADA';
      else if (matches.length > 1) errorCode = 'REFERENCIA_AMBIGUA';
      else medicationId = matches[0].id ?? null;
    } catch { errorCode = 'REFERENCIA_INVALIDA'; }
    if (errorCode) incidents.push(incident(line, 'nombre', mapping.nombre, errorCode));
    if (key && seen.has(key)) errorCode = 'FILA_DUPLICADA';
    if (errorCode === 'FILA_DUPLICADA') incidents.push(incident(line, 'nombre', mapping.nombre, errorCode));
    if (key) seen.add(key);
    const price = priceCents(row[indexes.precioReferencial]);
    const physical = quantity(row[indexes.cantidadFisica]);
    if (price === null) incidents.push(incident(line, 'precioReferencial', mapping.precioReferencial,
      row[indexes.precioReferencial].trim() ? 'PRECIO_INVALIDO' : 'PRECIO_REQUERIDO'));
    if (physical === null) incidents.push(incident(line, 'cantidadFisica', mapping.cantidadFisica,
      row[indexes.cantidadFisica].trim() ? 'CANTIDAD_INVALIDA' : 'CANTIDAD_REQUERIDA'));
    if (price === null || physical === null) errorCode = 'VALOR_INVALIDO';
    if (declaredPharmacy >= 0 && row[declaredPharmacy].trim() !== pharmacyId) {
      errorCode = 'FARMACIA_AJENA';
      incidents.push(incident(line, 'farmaciaId', mapping.farmaciaId ?? 'farmacia_id', errorCode));
    }
    return { line, medicationId, priceCents: price, physicalQuantity: physical, errorCode, incidents };
  });
}
