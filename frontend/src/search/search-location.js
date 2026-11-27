import { findPeruPlace } from '../geolocation/peru-cities.js';

/**
 * F03.1 (FR-003, FR-011, D-05, D-06): ubicación de búsqueda.
 * - Solo vive en memoria; se redondea a 3 decimales (≈ 100 m) antes de enviarla a la búsqueda.
 * - Lo único que puede recordarse, y solo con consentimiento, es el NOMBRE de una ciudad o distrito
 *   de la lista interna; las coordenadas se recalculan de esa lista. GPS y punto del mapa nunca se guardan.
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

export function cityLocation(name) {
  const place = findPeruPlace(name);
  return place ? searchLocation('city', place, place.name) : null;
}

function safeStorage() { try { return typeof window === 'undefined' ? null : window.localStorage; } catch { return null; } }

export function readRememberedCity(storage = safeStorage()) {
  try {
    const raw = storage?.getItem(CITY_KEY); if (!raw) return null;
    const value = JSON.parse(raw);
    return value && typeof value.nombre === 'string' ? cityLocation(value.nombre) : null;
  } catch { return null; }
}
export function rememberCity(name, storage = safeStorage()) {
  try { if (!findPeruPlace(name)) return false; storage?.setItem(CITY_KEY, JSON.stringify({ nombre: findPeruPlace(name).name })); return true; }
  catch { return false; }
}
export function forgetCity(storage = safeStorage()) { try { storage?.removeItem(CITY_KEY); return true; } catch { return false; } }

const fold = value => String(value ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim().replace(/\s+/g, ' ');
/**
 * F03.1: filtra mientras se escribe, sin tildes ni mayúsculas: coincide si el nombre o alguna de sus
 * palabras empieza por lo escrito («jes» → Jesús Nazareno; «san» → San Juan Bautista, San José de Ticllas…).
 */
export function filterPlaces(places, text, limit = 10) {
  const query = fold(text); if (!query) return [];
  return places.filter(place => { const name = fold(place.name); return name.startsWith(query) || name.split(' ').some(word => word.startsWith(query)); })
    .sort((a, b) => Number(fold(b.name).startsWith(query)) - Number(fold(a.name).startsWith(query)) || a.name.localeCompare(b.name, 'es'))
    .slice(0, limit);
}
