/**
 * F06.2 · D-10 A (enmienda de F061-FR-033): preguntas rápidas. Las que necesitan un medicamento RELLENAN el campo y
 * ponen el foco; las completas se envían al pulsar. Informativas: sin diagnósticos, tratamientos, recetas ni dosis.
 */
export const QUICK_QUESTIONS = [
  { label: '¿Dónde está más barato…?', fill: '¿Dónde está más barato ' },
  { label: '¿Qué farmacia está abierta ahora?', send: '¿Qué farmacia está abierta ahora?' },
  { label: '¿Dónde lo encuentro cerca?', fill: '¿Dónde hay cerca ' },
  { label: 'Algo más barato con el mismo principio activo', fill: '¿Hay algo más barato que ' },
  { label: '¿Qué información puedes darme?', send: '¿Qué información puedes darme?' },
];

/** Compatibilidad: nombre anterior de la lista. */
export const SUGGESTIONS = QUICK_QUESTIONS;

/** Pantallas donde no se muestra la burbuja (técnicas o de administración). */
export function bubbleHiddenOn(path = '/') {
  return /^\/(bootstrap|admin)/.test(path);
}

/** Indicador de panel minimizado durante la visita (D-06): solo '1' o ausente; nunca la conversación. */
export const MINIMIZED_KEY = 'farmafind.chat.minimized';
export function readMinimized(storage) {
  try { return (storage ?? window.sessionStorage).getItem(MINIMIZED_KEY) === '1'; } catch { return false; }
}
export function writeMinimized(value, storage) {
  try {
    const target = storage ?? window.sessionStorage;
    if (value) target.setItem(MINIMIZED_KEY, '1'); else target.removeItem(MINIMIZED_KEY);
  } catch { /* sin almacenamiento: el panel funciona igual */ }
}
