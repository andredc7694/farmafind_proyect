export interface MedicationAttributes {
  readonly name: string;
  readonly concentration: string;
  readonly presentation: string;
  readonly classification: string;
}

export interface MedicationReference extends MedicationAttributes {
  readonly id?: string;
  readonly key: string;
  readonly state: 'ACTIVO';
}

function clean(value: string, limit: number): string {
  const result = value.normalize('NFKC').trim().replace(/\s+/gu, ' ');
  if (result.length < 1 || result.length > limit || /[\p{Cc}\p{Cf}]/u.test(result)) {
    throw new Error('Atributo de medicamento inválido');
  }
  return result;
}

export function catalogKey(value: MedicationAttributes): string {
  return [clean(value.name, 160), clean(value.concentration, 80),
    clean(value.presentation, 120), clean(value.classification, 120)]
    .map(part => part.toLocaleLowerCase('es-PE')).join('\u001f');
}

export function createMedicationReference(value: MedicationAttributes): MedicationReference {
  const name = clean(value.name, 160);
  const concentration = clean(value.concentration, 80);
  const presentation = clean(value.presentation, 120);
  const classification = clean(value.classification, 120);
  return { name, concentration, presentation, classification,
    key: catalogKey({ name, concentration, presentation, classification }), state: 'ACTIVO' };
}

export function resolveReference(references: readonly MedicationReference[], query: MedicationAttributes): MedicationReference | null {
  const matches = references.filter(item => item.state === 'ACTIVO' && item.key === catalogKey(query));
  if (matches.length > 1) throw new Error('Referencia ambigua');
  return matches[0] ?? null;
}
