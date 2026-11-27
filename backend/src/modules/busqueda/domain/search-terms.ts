/**
 * F03.2: reglas de texto de la búsqueda pública. La función SQL f03.normalize_search_text aplica la MISMA
 * limpieza a los datos guardados (prueba de paridad TS/SQL). Solo amplía coincidencias; no decide qué se publica.
 */
export const MAX_WORDS = 8;
export const MAX_TOKENS = 8;
export const MAX_TERM_LENGTH = 40;

const FILLER = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'x', 'en', 'con', 'para', 'por', 'y', 'a']);
const UNITS = new Set(['mg', 'g', 'mcg', 'ug', 'ml', 'l', 'ui', 'kg', '%']);
/** Palabras de presentación (ya en singular): si el texto solo trae estas, falta el nombre (FR-013). */
const PRESENTATION = ['tableta', 'capsula', 'comprimido', 'jarabe', 'suspension', 'solucion', 'gota', 'ampolla',
  'inyectable', 'crema', 'gel', 'unguento', 'pomada', 'ovulo', 'supositorio', 'sobre', 'polvo', 'frasco', 'spray',
  'inhalador', 'parche', 'blister', 'caja', 'unidad', 'recubierto', 'efervescente'];

export interface SearchTerms {
  /** Palabras en singular; coinciden como parte del texto. Al menos una debe estar en el nombre o principio activo. */
  readonly words: readonly string[];
  /** Números y unidades; coinciden solo como palabra entera. */
  readonly tokens: readonly string[];
  /** true si no hay ninguna palabra que pueda ser un nombre de medicamento. */
  readonly nameless: boolean;
}

/** Minúsculas, sin tildes, número y unidad separados, coma decimal como punto, otros signos como espacio. */
export function normalizeSearchText(value: string): string {
  return value.toLocaleLowerCase('es').normalize('NFD').replace(/\p{M}/gu, '')
    .replace(/(\d),(\d)/g, '$1.$2')
    .replace(/(?<!\d)\.|\.(?!\d)/g, ' ')
    .replace(/(\d)([a-z%])/g, '$1 $2')
    .replace(/([a-z%])(\d)/g, '$1 $2')
    .replace(/[^a-z0-9.%]+/g, ' ')
    .trim();
}

function singular(word: string): string {
  if (word.length >= 5 && word.endsWith('es')) return word.slice(0, -2);
  if (word.length >= 4 && word.endsWith('s')) return word.slice(0, -1);
  return word;
}

const isNumber = (part: string) => /^\d+(\.\d+)?$/.test(part);

export function searchTerms(term: string): SearchTerms {
  const words: string[] = []; const tokens: string[] = []; const fillers: string[] = [];
  for (const part of normalizeSearchText(term).split(' ')) {
    if (part === '' || part.length > MAX_TERM_LENGTH) continue;
    if (FILLER.has(part)) { if (part.length >= 2 && !fillers.includes(part)) fillers.push(part); continue; }
    if (isNumber(part) || UNITS.has(part)) { if (tokens.length < MAX_TOKENS && !tokens.includes(part)) tokens.push(part); continue; }
    if (part.length < 2) continue; // una sola letra: no puede ser nombre y traería casi todo el catálogo
    const word = singular(part);
    if (words.length < MAX_WORDS && !words.includes(word)) words.push(word);
  }
  // Relleno («de», «para»…) solo se descarta si hay otra palabra: «para» sola es el comienzo de «paracetamol».
  if (words.length === 0) words.push(...fillers.slice(0, MAX_WORDS));
  const nameless = words.every(word => PRESENTATION.some(form => word.startsWith(form) || (word.length >= 4 && form.startsWith(word))));
  return { words, tokens, nameless };
}
