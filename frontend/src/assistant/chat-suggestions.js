/**
 * F08.1: preguntas sugeridas por reglas locales (sin modelo de lenguaje). Solo RELLENAN el campo de texto; enviar sigue
 * siendo una acción de la persona. Informativas: sin diagnósticos, tratamientos, recetas ni dosis.
 */
const general = ['¿Qué información pública puedes mostrarme sobre un medicamento?', '¿Cómo comparo precios entre farmacias?', '¿Qué significa «disponibilidad referencial»?'];
const bySection = [
  [/^\/search/, ['Compara el precio de paracetamol entre farmacias', '¿Qué farmacias publican ofertas de ibuprofeno?', '¿Cuál es la oferta más reciente de un medicamento?']],
  [/^\/mapa/, ['¿Qué farmacias hay en mi ciudad con ofertas públicas?', '¿Cómo se calcula la distancia a una farmacia?']],
  [/^\/reservations/, ['¿Cómo funciona una reserva y cuánto tiempo la mantiene la farmacia?', '¿Qué pasa si no recojo mi reserva a tiempo?']],
];

export function suggestedQuestions(path = '/') {
  const match = bySection.find(([pattern]) => pattern.test(path));
  return [...(match ? match[1] : []), ...general].slice(0, 4);
}

/** Pantallas donde no se muestra la burbuja (el asistente ya es la pantalla, o es técnica/de administración). */
export function bubbleHiddenOn(path = '/') {
  return /^\/(assistant|bootstrap|admin)/.test(path);
}
