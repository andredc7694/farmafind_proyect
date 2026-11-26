/**
 * Preguntas sugeridas de la bienvenida. Solo RELLENAN el campo de texto; enviar sigue siendo una acción de la persona.
 * Informativas: sin diagnósticos, tratamientos, recetas ni dosis.
 */
export const SUGGESTIONS = [
  { label: 'Comparar precios de un medicamento', fill: 'Compara el precio de ' },
  { label: 'Buscar una farmacia cercana', fill: '¿Dónde hay una farmacia cercana?' },
  { label: '¿Qué información puedes darme?', fill: '¿Qué información puedes darme?' },
];

/** Pantallas donde no se muestra la burbuja (técnicas o de administración). */
export function bubbleHiddenOn(path = '/') {
  return /^\/(bootstrap|admin)/.test(path);
}
