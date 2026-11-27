import { ACTIVE_SEARCH_PLACES, filterPlaces, findSearchPlace } from './search-places.js';

export { filterPlaces };

/**
 * F03.1 (FR-003, FR-011, D-05, D-06, E-01): ubicación de búsqueda.
 * - Solo vive en memoria y se redondea a 3 decimales (≈ 100 m) antes de enviarla a la búsqueda.
 * - Lo único que puede recordarse, y solo con consentimiento, es el NOMBRE de un lugar de la lista
 *   activa de la búsqueda (E-01). Las coordenadas se recalculan desde esa lista; GPS y punto del mapa nunca se guardan.
 */
const CITY_KEY = 'farmafind.search.city';

export function roundCoordinate(value) { return Math.round(Number(value) * 1000) / 1000; }

export function roundPoint(point) {
  return { latitude: roundCoordinate(point.latitude), longitude: roundCoordinate(point.longitude) };
}

/** source: 'gps' | 'city' | 'map'. label es lo que se muestra en «Cerca de: …». */
export function searchLocation(source, point, cityName = null) {
  const label = source === 'city' ? cityName : source === 'gps' ? 'tu ubicación' : 'el punto elegido';
  return { source, label, ...roundPoint(point) };
}

export function cityLocation(name, places = ACTIVE_SEARCH_PLACES) {
  const place = findSearchPlace(name, places);
  return place ? searchLocation('city', place, place.name) : null;
}

function safeStorage() { try { return typeof window === 'undefined' ? null : window.localStorage; } catch { return null; } }

/** Una ciudad recordada fuera del alcance activo se ignora (E-01). */
export function readRememberedCity(storage = safeStorage(), places = ACTIVE_SEARCH_PLACES) {
  try {
    const raw = storage?.getItem(CITY_KEY); if (!raw) return null;
    const value = JSON.parse(raw);
    return value && typeof value.nombre === 'string' ? cityLocation(value.nombre, places) : null;
  } catch { return null; }
}
export function rememberCity(name, storage = safeStorage(), places = ACTIVE_SEARCH_PLACES) {
  try {
    const place = findSearchPlace(name, places); if (!place) return false;
    storage?.setItem(CITY_KEY, JSON.stringify({ nombre: place.name })); return true;
  } catch { return false; }
}
export function forgetCity(storage = safeStorage()) { try { storage?.removeItem(CITY_KEY); return true; } catch { return false; } }
