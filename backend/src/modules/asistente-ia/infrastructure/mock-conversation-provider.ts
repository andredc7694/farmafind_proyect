import type { ConversationDecision, ConversationProvider } from '../application/conversation-ports.js';

const HELP = /^[\s¡!¿?.,]*(ayuda|instrucciones)[\s¡!¿?.,]*$/iu;
const GREETING = /^[\s¡!¿?.,]*(hola|holi|hey|hi|saludos|buenas|buen(?:os|as)? (?:d[ií]as?|tardes|noches)|qu[eé] tal|(?:muchas )?gracias)(?:[\s,]+(?:qu[eé] tal|buen(?:os|as)? (?:d[ií]as|tardes|noches)))?[\s¡!¿?.,]*$/iu;
const CAPABILITIES = /(qu[eé] (?:informaci[oó]n|datos)(?=\s).*\s(?:puedes|das|ofreces|muestras|tienes)|qu[eé] (?:puedes|sabes) (?:hacer|mostrar(?:me)?|decir(?:me)?|dar(?:me)?)|disponibilidad referencial)/iu;
const NEARBY = /(farmacias?(?=\s).*\s(?:cercanas?|cerca)(?=$|[^\p{L}])|cerca de m[ií](?=$|[^\p{L}])|farmacia m[aá]s cercana)/iu;
const SYMPTOM = /\b(clases?|categor[ií]as?|molestias? comunes|uso habitual)\b/iu;
const SOURCE = /\b(ficha|principio activo|presentaci[oó]n|advertencias?|precauciones?)\b/iu;
const FOLLOWUP = /^\s*[¿?]?(?:y |sus |qu[eé] )/iu;
const SEARCH = /(?:^|[^\p{L}])(compar[\p{L}]*|precios?|cu[aá]nto (?:cuesta|vale)n?|cuesta|busca[\p{L}]*|b[uú]sca[\p{L}]*|encuentra[\p{L}]*|ofertas?|venden?|tienen?|d[oó]nde hay)(?=$|[^\p{L}])/iu;
const COMPARE = /(?:^|[^\p{L}])(compar[\p{L}]*|precios?|cu[aá]nto|barat[oa]s?|menor)(?=$|[^\p{L}])/iu;

/** Palabras que rodean el nombre del medicamento; solo se quitan de los extremos de la frase. */
const FILLER = new Set(('el la los las un una unos unas de del en entre por para con y o a al me te se mi tu su que qué cual cuál cuales cuáles '
  + 'como cómo cuanto cuánto cuesta cuestan vale valen precio precios compara comparar comparo compare comparación comparacion busca buscar búscame buscame '
  + 'encuentra encontrar farmacia farmacias oferta ofertas donde dónde hay tienen tiene venden vende publican publica publicadas puedo puedes quiero '
  + 'quisiera necesito ver mostrar muestra muéstrame muestrame dime favor porfa más mas barato barata baratos menor mejor referencial público publico '
  + 'públicas publicas hola').split(' '));
const ARTICLES = new Set(['el', 'la', 'un', 'una', 'del', 'de', 'los', 'las']);
const NOT_A_NAME = new Set(['ok', 'si', 'sí', 'no', 'vale', 'genial', 'adios', 'adiós', 'chau', 'bien', 'listo', 'seguimiento', 'test']);

function tokens(query: string): string[] {
  return query.toLocaleLowerCase('es').replace(/[^\p{L}\p{N}%.,\s-]/gu, ' ').split(/\s+/u)
    .map(word => word.replace(/^[.,-]+|[.,-]+$/g, '')).filter(Boolean);
}

/** Deja el nombre buscado: sin palabras de relleno en los extremos ni concentraciones (F03 busca por nombre). */
export function medicineTerm(query: string): string {
  const words = tokens(query).filter(word => !/^\d+(?:[.,]\d+)?(?:mg|g|ml|mcg|ui|%)?$|^(?:mg|ml|mcg|g)$/u.test(word));
  let previous = '';
  while (words.length && (FILLER.has(words[0]) || (['medicamento', 'medicamentos'].includes(words[0]) && ARTICLES.has(previous)))) {
    previous = words.shift()!;
  }
  while (words.length && FILLER.has(words[words.length - 1])) words.pop();
  const term = words.join(' ').slice(0, 120);
  return term === 'medicamento' || term === 'medicamentos' ? '' : term;
}

/** Deterministic local classifier; no network, free text generation or external SDK. */
export class MockConversationProvider implements ConversationProvider {
  async classify(query: string): Promise<ConversationDecision> {
    if (HELP.test(query)) return { intent: 'HELP', term: null };
    if (GREETING.test(query)) return { intent: 'GREETING', term: null };
    if (CAPABILITIES.test(query)) return { intent: 'CAPABILITIES', term: null };
    if (NEARBY.test(query)) return { intent: 'NEARBY', term: null };
    if (SYMPTOM.test(query)) return { intent: 'SYMPTOM', term: query };
    if (SOURCE.test(query)) return { intent: 'SOURCE', term: query };
    if (SEARCH.test(query)) {
      const term = medicineTerm(query);
      if (!term) return { intent: 'ASK_TERM', term: null };
      return { intent: COMPARE.test(query) ? 'PUBLIC_COMPARE' : 'PUBLIC_SEARCH', term };
    }
    if (FOLLOWUP.test(query)) return { intent: 'SOURCE', term: query };
    // Un nombre suelto («Aciclovir», «paracetamol 500 mg») se entiende como comparar sus precios publicados.
    const term = medicineTerm(query);
    if (tokens(query).length <= 4 && /^\p{L}[\p{L}\p{N} .-]{2,}$/u.test(term) && !NOT_A_NAME.has(term)) {
      return { intent: 'PUBLIC_COMPARE', term };
    }
    return { intent: 'HELP', term: null };
  }
}
