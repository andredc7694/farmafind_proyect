const CLINICAL = [
  /\b(diagn[oó]stic|diagnostica|enfermedad|s[ií]ntoma)/iu,
  /\b(dosis|dosificaci[oó]n|cu[aá]nt[oa]s? (?:mg|ml|pastillas?|tabletas?))/iu,
  /\b(receta|prescri|tratamiento|contraindicaci[oó]n)/iu,
  /\b(qu[eé] debo tomar|puedo tomar|debo usar|recomi[eé]ndame un medicamento)/iu,
  /\b(qu[eé] medicamento|sirve para|es bueno para|c[oó]mo (?:lo )?tomo|consumir este)/iu,
  /\b(sustituye|reemplaza|equivalente cl[ií]nico)/iu,
];
export function isClinicalRequest(query: string): boolean { return CLINICAL.some(pattern => pattern.test(query)); }
export const CLINICAL_REFUSAL = 'No puedo diagnosticar, prescribir, indicar dosis ni recomendar tratamientos. Consulta a un profesional de salud habilitado.';
