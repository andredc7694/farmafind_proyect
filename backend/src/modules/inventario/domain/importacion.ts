import { catalogKey, type MedicationReference } from '../../medicamentos/contracts/reference.js';

export interface ParsedInventoryFile {
  readonly headers: readonly string[];
  readonly rows: readonly (readonly string[])[];
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
    if (key && seen.has(key)) errorCode = 'FILA_DUPLICADA';
    if (key) seen.add(key);
    const price = priceCents(row[indexes.precioReferencial]);
    const physical = quantity(row[indexes.cantidadFisica]);
    if (price === null || physical === null) errorCode = 'VALOR_INVALIDO';
    if (declaredPharmacy >= 0 && row[declaredPharmacy].trim() !== pharmacyId) {
      errorCode = 'FARMACIA_AJENA';
    }
    return { line: index + 2, medicationId, priceCents: price, physicalQuantity: physical, errorCode };
  });
}
