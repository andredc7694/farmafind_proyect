import { HUAMANGA_DISTRICTS, fold } from './search-places.js';

/**
 * F06.2 · FR-010: lo que muestra «Buscar medicamentos» ahora mismo (término y lugar elegido), en MEMORIA de la página.
 * No se guarda en el navegador ni en el servidor: al recargar desaparece. El asistente lo usa para proponer
 * «¿Quieres ver el más barato cerca de ti?» y para saber el distrito de la búsqueda.
 */
let current = Object.freeze({ term: '', place: null });
const listeners = new Set();

export function publishSearchContext({ term = '', place = null } = {}) {
  const cleanPlace = place && Number.isFinite(place.latitude) && Number.isFinite(place.longitude)
    ? Object.freeze({ label: String(place.label ?? ''), latitude: place.latitude, longitude: place.longitude, source: place.source ?? null }) : null;
  current = Object.freeze({ term: String(term ?? '').trim().slice(0, 120), place: cleanPlace });
  for (const listener of listeners) listener(current);
}
export function readSearchContext() { return current; }
export function subscribeSearchContext(listener) { listeners.add(listener); return () => listeners.delete(listener); }

const round3 = value => Math.round(value * 1000) / 1000;
/** Lugar de la búsqueda → contexto del asistente: un distrito de la lista, o un punto redondeado a 3 decimales. */
export function placeForAssistant(place) {
  if (!place) return {};
  const district = HUAMANGA_DISTRICTS.find(item => fold(item.name) === fold(place.label));
  if (district) return { distrito: district.name };
  return { punto: { latitud: round3(place.latitude), longitud: round3(place.longitude) } };
}
