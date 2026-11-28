import { normalizeSearchText } from '../../busqueda/contracts/public-search-text.js';
import { FORM_WORD, formsIn, type DosageForm } from './dosage-form.js';
import { findPlaceIn, type AssistantPlace } from './places.js';

/**
 * F06.2 · FR-003/FR-004: lectura determinista de frases naturales (sin IA externa). Usa la misma limpieza de texto
 * que la búsqueda pública F03.2 y deja solo las palabras que pueden ser el nombre del medicamento; el nombre real se
 * confirma después contra las ofertas públicas (D-02 A).
 */
export type AssistantIntent = 'PRECIO' | 'CERCANIA' | 'HORARIO' | 'ALTERNATIVA';
export const ASSISTANT_INTENTS: readonly AssistantIntent[] = ['PRECIO', 'CERCANIA', 'HORARIO', 'ALTERNATIVA'];

export interface PhraseReading {
  readonly normalized: string;
  readonly intent: AssistantIntent | null;
  /** «¿y en Carmen Alto?», «¿y el de 600 mg?»: continúa la pregunta anterior. */
  readonly followUp: boolean;
  readonly place: AssistantPlace | null;
  /** Concentración pedida, normalizada como «600 mg». */
  readonly strength: string | null;
  readonly form: DosageForm | null;
  /** Palabras que pueden ser el nombre del medicamento (normalizadas, en orden). */
  readonly medicineWords: readonly string[];
}

const ALTERNATIVE = /\b(?:mas (?:barat[oa]s?|economic[oa]s?) que|parecid[oa]s? (?:a|al)|similar(?:es)? (?:a|al)|generic[oa]s?|alternativas?|otras? marcas?)\b/;
const HOURS = /\b(?:abiert[oa]s?|abren?|atienden?|horarios?|de turno|24 horas)\b/;
const NEAR = /\b(?:cerca|cercan[oa]s?|proxim[oa]s?)\b/;
const PRICE = /\b(?:barat[oa]s?|economic[oa]s?|precios?|cuestan?|valen?|compar[a-z]*|menor precio)\b/;
const STRENGTH = /\b(\d+(?:\.\d+)?) (mg|g|mcg|ug|ml|ui|%)(?=\s|$)/;

/** Palabras de pregunta, de intención o de relleno: nunca son el nombre del medicamento. */
const STOP = new Set(('a al algo alguna alguno alternativa alternativas abierta abiertas abierto abiertos abre abren ahora ahi alla aqui atiende '
  + 'atienden barata baratas barato baratos botica boticas busca buscar buscame buscas busco cerca cercana cercanas cercano cercanos como compara '
  + 'comparar comparo comparacion con cual cuales cuanto cuanta cuesta cuestan de del dime distrito donde economica economico el ella en encuentra '
  + 'encontrar es esta estan este favor farmacia farmacias generica generico genericas genericos hay hoy horario horarios la las le lo los mas '
  + 'marca marcas me medicamento medicamentos mejor menor menos mi necesito o oferta ofertas otra otras otro otros para parecida parecido '
  + 'porfa por precio precios proxima proximo publica publicas puedo puedes que quiero quisiera referencial se si similar similares su tambien '
  + 'te tiene tienen turno u un una uno unos unas vale valen vende venden ver y ya zona horas abran abra mostrar muestrame muestra entre sus tus cada todas todos todo hacer saber '
  + 'pueden puede quieres necesitas tengo dame darme sale salen').split(' '));

export function readPhrase(query: string): PhraseReading {
  const normalized = normalizeSearchText(query);
  const intent: AssistantIntent | null = ALTERNATIVE.test(normalized) ? 'ALTERNATIVA' : HOURS.test(normalized) ? 'HORARIO'
    : NEAR.test(normalized) ? 'CERCANIA' : PRICE.test(normalized) ? 'PRECIO' : null;
  const strengthMatch = STRENGTH.exec(normalized);
  const strength = strengthMatch ? `${strengthMatch[1]} ${strengthMatch[2]}` : null;
  const forms = formsIn(normalized);
  const { place, rest } = findPlaceIn(normalized);
  const medicineWords = rest.split(' ').filter(word => word.length >= 3 && !STOP.has(word) && !FORM_WORD.test(word)
    && !/^\d/.test(word) && !/^(?:mg|g|mcg|ug|ml|ui|l|kg|x)$/.test(word));
  const followUp = /^y\b/.test(normalized) || (intent === null && medicineWords.length === 0 && (place !== null || strength !== null || forms.length > 0));
  return { normalized, intent, followUp, place, strength, form: forms.length === 1 ? forms[0] : null, medicineWords };
}

/** ¿La concentración publicada coincide con la pedida («600 mg»)? Comparación por palabras enteras. */
export function sameStrength(concentracion: string, strength: string): boolean {
  return ` ${normalizeSearchText(concentracion)} `.includes(` ${strength} `);
}
