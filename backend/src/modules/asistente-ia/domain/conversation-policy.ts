export type ConversationSafety = { readonly kind: 'ALLOW' } |
  { readonly kind: 'REFUSE' | 'URGENT'; readonly message: string };

export const EDUCATIONAL_NOTICE = 'Información educativa general; no sustituye la evaluación de un profesional de salud.';
export const PERSONAL_REFUSAL = 'No puedo diagnosticar ni elegir tratamientos, prescribir o indicar dosis. Para eso, consulta al químico farmacéutico de tu farmacia o a un profesional de salud. Sí puedo mostrarte precios referenciales y qué farmacias ofrecen un medicamento: escribe su nombre.';
const CLINICAL_TOPIC = /\b(tratamientos?|diagn[oó]stic[a-záéíóú]*|para qu[eé] sirve|sirve para|es bueno para|c[oó]mo (?:se |lo )?tom[oa]|contraindicaci[a-záéíóúo]*)(?=$|[^\p{L}])/iu;
export const URGENT_ORIENTATION = 'Si crees que puede ser una urgencia, busca atención médica urgente o llama a los servicios de emergencia locales. No puedo diagnosticar tu situación.';

const URGENT = /\b(urgenc(?:ia|te)|dolor (?:en el |de )?pecho|no puedo respirar|dificultad para respirar|me desmayo|desmayo|convulsi[oó]n)\b/iu;
const PERSONAL = /\b(para m[ií]|para mi (?:hij[oa]|beb[eé])|mi (?:hij[oa]|beb[eé]|tratamiento|medicaci[oó]n|medicina|enfermedad|dosis)|estoy embarazada|tengo (?:\d+ a[nñ]os|[a-záéíóúñ ]* y (?:necesito|quiero tomar))|qu[eé] (?:debo|puedo|me recomiendas|le doy|tomo yo)|recomi[eé]ndame|me aconsejas|cu[aá]nt[oa]s? (?:mg|ml|pastillas?|tabletas?)|dosis|dosificaci[oó]n|receta|prescri[a-záéíóú]*|diagn[oó]stic[a-záéíóú]*|sustitu(?:ye|ir)|reemplaz[ao]|interacc(?:i[oó]n|iones) (?:con|para) m[ií])(?=$|[^\p{L}])/iu;
const INJECTION = /\b(ignora (?:tus |las |todas las )?(?:reglas|instrucciones|pol[ií]ticas)|olvida (?:tus |las )?(?:reglas|instrucciones|restricciones)|omite (?:tus |las )?restricciones|act[uú]a como (?:m[eé]dico|doctor)|desactiva (?:la )?seguridad)\b/iu;

export function classifyConversationSafety(query: string): ConversationSafety {
  if (URGENT.test(query)) return { kind: 'URGENT', message: URGENT_ORIENTATION };
  if (PERSONAL.test(query) || CLINICAL_TOPIC.test(query) || INJECTION.test(query)) return { kind: 'REFUSE', message: PERSONAL_REFUSAL };
  return { kind: 'ALLOW' };
}
