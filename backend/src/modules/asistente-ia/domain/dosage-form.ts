import { normalizeSearchText } from '../../busqueda/contracts/public-search-text.js';

/**
 * F06.2 · D-04 (ajuste de Andre): forma farmacéutica leída de la presentación publicada. Solo se reconoce cuando la
 * presentación nombra UNA forma conocida; «caja x 30», «frasco 120 ml» o textos con dos formas → desconocida (null),
 * y un producto con forma desconocida nunca se ofrece como alternativa.
 */
export const DOSAGE_FORMS = ['tableta', 'capsula', 'jarabe', 'suspension', 'solucion', 'gotas', 'crema', 'gel', 'unguento',
  'inyectable', 'supositorio', 'ovulo', 'sobre', 'parche', 'spray', 'inhalador'] as const;
export type DosageForm = typeof DOSAGE_FORMS[number];

export const DOSAGE_FORM_LABEL: Readonly<Record<DosageForm, string>> = Object.freeze({
  tableta: 'tableta', capsula: 'cápsula', jarabe: 'jarabe', suspension: 'suspensión', solucion: 'solución', gotas: 'gotas',
  crema: 'crema', gel: 'gel', unguento: 'ungüento', inyectable: 'inyectable', supositorio: 'supositorio', ovulo: 'óvulo',
  sobre: 'sobre', parche: 'parche', spray: 'spray', inhalador: 'inhalador',
});

const PATTERNS: ReadonlyArray<readonly [DosageForm, RegExp]> = [
  ['tableta', /\b(?:tabletas?|tab|comprimidos?|grageas?)\b/], ['capsula', /\bcapsulas?\b/], ['jarabe', /\bjarabes?\b/],
  ['suspension', /\bsuspension(?:es)?\b/], ['solucion', /\bsolucion(?:es)?\b/], ['gotas', /\bgotas?\b/], ['crema', /\bcremas?\b/],
  ['gel', /\bgel(?:es)?\b/], ['unguento', /\b(?:unguentos?|pomadas?)\b/], ['inyectable', /\b(?:inyectables?|ampollas?)\b/],
  ['supositorio', /\bsupositorios?\b/], ['ovulo', /\bovulos?\b/], ['sobre', /\b(?:sobres?|polvo)\b/], ['parche', /\bparches?\b/],
  ['spray', /\b(?:spray|aerosol)\b/], ['inhalador', /\binhalador(?:es)?\b/],
];

/** Formas nombradas en un texto (una presentación publicada o la frase de la persona). */
export function formsIn(text: string): DosageForm[] {
  const normalized = normalizeSearchText(text);
  return PATTERNS.filter(([, pattern]) => pattern.test(normalized)).map(([form]) => form);
}

/** Forma de una presentación publicada: exactamente una forma conocida, o null (desconocida). */
export function dosageForm(presentacion: string): DosageForm | null {
  const found = formsIn(presentacion);
  return found.length === 1 ? found[0] : null;
}

export function isDosageForm(value: unknown): value is DosageForm {
  return typeof value === 'string' && (DOSAGE_FORMS as readonly string[]).includes(value);
}

/** Palabras de forma o envase (normalizadas) que no forman parte del nombre del medicamento. */
export const FORM_WORD = /^(?:tabletas?|tab|comprimidos?|grageas?|capsulas?|jarabes?|suspension(?:es)?|solucion(?:es)?|gotas?|cremas?|gel(?:es)?|unguentos?|pomadas?|inyectables?|ampollas?|supositorios?|ovulos?|sobres?|polvo|parches?|spray|aerosol|inhalador(?:es)?|cajas?|frascos?|blister|unidad(?:es)?)$/;
