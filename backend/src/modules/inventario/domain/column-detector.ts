/**
 * Detector determinista de columnas de inventario (enmienda F02.1, 2026-11-25). Sin IA ni servicios externos.
 * Puntúa cada columna combinando (a) el nombre normalizado, con tolerancia a pequeñas diferencias, y (b) su contenido.
 * Un empate real no se resuelve en silencio: el campo queda «ambiguo» y se pregunta solo por él.
 */
export const DETECTABLE_FIELDS = ['nombre', 'concentracion', 'presentacion', 'clasificacion', 'precioReferencial', 'cantidadFisica'] as const;
export type DetectableField = (typeof DETECTABLE_FIELDS)[number];

/** [nombre normalizado, peso]. «categoria terapeutica» NO es la clasificación (condición de venta). */
const synonyms: Readonly<Record<DetectableField, readonly (readonly [string, number])[]>> = {
  nombre: [['nombre', 1], ['medicamento', 1], ['producto', 1], ['nombre generico', 1], ['nombre producto', 1],
    ['nombre comercial', 0.8], ['descripcion', 0.7], ['articulo', 0.7]],
  concentracion: [['concentracion', 1], ['potencia', 0.7]],
  presentacion: [['presentacion', 1], ['forma farmaceutica', 0.85], ['forma', 0.7], ['envase', 0.7], ['empaque', 0.7]],
  clasificacion: [['condicion venta', 1], ['clasificacion', 1], ['tipo venta', 0.9]],
  precioReferencial: [['precio', 1], ['precio unitario', 1], ['precio referencial', 1], ['precio regular', 1], ['precio venta', 1],
    ['pvp', 1], ['precio efectivo', 0.75], ['valor venta', 0.7]],
  cantidadFisica: [['cantidad', 1], ['cantidad fisica', 1], ['stock', 1], ['stock disponible', 1], ['stock unidades', 1],
    ['existencia', 1], ['existencias', 1], ['saldo', 0.75], ['inventario', 0.7], ['unidades', 0.7]],
};

export function normalizeLabel(value: string): string {
  return value.normalize('NFD').replace(/\p{M}+/gu, '').toLowerCase().replace(/[_\-.()/]+/g, ' ')
    .replace(/\b(de|del|el|la|en|sol|soles|s)\b/g, ' ').replace(/\s+/g, ' ').trim();
}

function distance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i++) {
    let previous = row[0]; row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const current = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1));
      previous = current;
    }
  }
  return row[b.length];
}

/** Coincidencia exacta o casi exacta del nombre completo; nunca por contener una palabra suelta. */
function headerScore(header: string, field: DetectableField): number {
  const label = normalizeLabel(header);
  let best = 0;
  for (const [alias, weight] of synonyms[field]) {
    const target = normalizeLabel(alias);
    if (label === target) best = Math.max(best, weight);
    else if (target.length >= 6 && Math.abs(label.length - target.length) <= 2 &&
        distance(label, target) <= (target.length >= 12 ? 2 : 1)) best = Math.max(best, weight * 0.9);
  }
  return best;
}

const patterns = {
  price: /^(s\/\.?\s*)?\d{1,12}([.,]\d{1,2})?$/i,
  integer: /^\d{1,9}$/,
  concentration: /^\d+([.,]\d+)?\s*(mg|g|mcg|µg|ug|ml|ui|%|meq)(\s*\/\s*(\d+([.,]\d+)?\s*)?(ml|g|mg|dosis|puff|gota|h))?(\s*\+\s*\d+([.,]\d+)?\s*(mg|g|mcg|ml|ui|%))*$/i,
  presentation: /\b(caja|frasco|tubo|bl[ií]ster|sobre|ampollas?|bolsa|inhalador|tabletas?|c[aá]psulas?|jarabe|crema|gotas|suspensi[oó]n|ung[uü]ento|inyectable|supositorios?|parche)\b|\bx\s*\d+/i,
  classification: /venta\s+(con|sin|bajo)\s+receta|venta\s+libre|receta|\botc\b|controlad/i,
  composite: /\d+([.,]\d+)?\s*(mg|g|mcg|ml|ui|%)\b/i,
};

function share(values: readonly string[], test: (value: string) => boolean): number {
  return values.length === 0 ? 0 : values.filter(test).length / values.length;
}

function contentScore(values: readonly string[], field: DetectableField): number {
  if (values.length === 0) return 0;
  switch (field) {
    case 'precioReferencial': {
      const base = share(values, v => patterns.price.test(v));
      return values.some(v => /^s\/|[.,]\d/i.test(v)) ? base : base * 0.5;
    }
    case 'cantidadFisica': return share(values, v => patterns.integer.test(v));
    case 'concentracion': return share(values, v => patterns.concentration.test(v));
    case 'presentacion': return share(values, v => patterns.presentation.test(v) && !patterns.concentration.test(v));
    case 'clasificacion': return share(values, v => patterns.classification.test(v));
    case 'nombre': {
      const text = share(values, v => /\p{L}{3,}/u.test(v) && !patterns.classification.test(v) && !patterns.composite.test(v) &&
        !patterns.presentation.test(v) && v.length <= 160);
      // Un nombre varía mucho entre filas; un laboratorio o un tipo se repiten.
      const variety = new Set(values.map(v => v.toLowerCase())).size / values.length;
      return text * (0.4 + 0.6 * Math.min(1, variety * 4));
    }
  }
}

export interface ColumnDetection {
  readonly mapping: Partial<Record<DetectableField, string>>;
  readonly ambiguous: readonly DetectableField[];
  readonly missing: readonly DetectableField[];
  /** Cuántos campos se reconocieron por el nombre del encabezado (desempata filas de encabezado). */
  readonly headerMatches: number;
}

export function detectColumns(headers: readonly string[], rows: readonly (readonly string[])[] = []): ColumnDetection {
  const sample = rows.slice(0, 300);
  const columns = headers.map((_, index) => sample.map(row => (row[index] ?? '').trim()).filter(v => v && v !== '—' && v !== '-'));
  const filled = headers.map((_, index) => sample.length === 0 ? 1 : columns[index].length / sample.length);
  const score = (field: DetectableField, index: number): number => {
    const byName = headerScore(headers[index], field);
    if (sample.length === 0) return byName;
    const byContent = contentScore(columns[index], field) * (0.5 + 0.5 * filled[index]);
    const typed = field === 'precioReferencial' || field === 'cantidadFisica' || field === 'concentracion' || field === 'clasificacion';
    if (byName > 0) {
      // En campos con formato propio, un contenido que contradice al nombre descarta la columna (p. ej. «disponible: Sí/No»).
      if (typed && columns[index].length > 0 && contentScore(columns[index], field) < 0.3 && byName < 1) return 0;
      return 0.6 * byName + 0.4 * byContent;
    }
    // Sin nombre reconocible, solo el contenido: se exige que sea muy claro.
    const required = field === 'nombre' ? 0.7 : 0.8;
    return byContent >= required ? 0.5 * byContent : 0;
  };
  const table = new Map(DETECTABLE_FIELDS.map(field => [field, headers.map((_, index) => score(field, index))]));
  const mapping: Partial<Record<DetectableField, string>> = {};
  const ambiguous: DetectableField[] = [];
  const used = new Set<number>();
  const order = [...DETECTABLE_FIELDS].sort((a, b) => Math.max(0, ...table.get(b)!) - Math.max(0, ...table.get(a)!));
  for (const field of order) {
    const ranked = table.get(field)!.map((value, index) => ({ value, index }))
      .filter(item => item.value > 0 && !used.has(item.index)).sort((a, b) => b.value - a.value);
    if (ranked.length === 0) continue;
    const margin = headerScore(headers[ranked[0].index], field) > 0 ? 0.02 : 0.05;
    if (ranked.length > 1 && ranked[0].value - ranked[1].value < margin) { ambiguous.push(field); continue; }
    mapping[field] = headers[ranked[0].index];
    used.add(ranked[0].index);
  }
  return { mapping, ambiguous,
    missing: DETECTABLE_FIELDS.filter(field => mapping[field] === undefined && !ambiguous.includes(field)),
    headerMatches: Object.entries(mapping).filter(([field, header]) => headerScore(header!, field as DetectableField) > 0).length };
}
