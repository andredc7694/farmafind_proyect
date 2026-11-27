import { PERU_PLACES } from '../geolocation/peru-cities.js';

/**
 * F03.1 · Enmienda E-01 (aprobada por Andre el 2026-11-26, opción A): lista PROPIA de «¿Dónde buscas?».
 * «Mi farmacia» (F07.1) sigue usando `peru-cities.js` sin cambios.
 *
 * Por defecto solo los 16 distritos de la provincia de Huamanga (ubigeo INEI 050101–050116); el centro es la
 * capital de cada distrito (aproximado; solo centra el mapa y estima la distancia). El resto del Perú queda
 * DESACTIVADO por configuración (no borrado): VITE_SEARCH_PLACES_SCOPE=peru lo activa.
 * Sin servicios externos: los datos están escritos aquí.
 */
export const HUAMANGA_DISTRICTS = Object.freeze([
  ['050101', 'Ayacucho', -13.1603, -74.2253], ['050102', 'Acocro', -13.2186, -74.0419],
  ['050103', 'Acos Vinchos', -13.1131, -74.1000], ['050104', 'Carmen Alto', -13.1794, -74.2206],
  ['050105', 'Chiara', -13.2728, -74.2058], ['050106', 'Ocros', -13.3906, -73.9156],
  ['050107', 'Pacaycasa', -13.0575, -74.2158], ['050108', 'Quinua', -13.0492, -74.1392],
  ['050109', 'San José de Ticllas', -13.1322, -74.3331], ['050110', 'San Juan Bautista', -13.1667, -74.2236],
  ['050111', 'Santiago de Pischa', -13.0856, -74.3933], ['050112', 'Socos', -13.2150, -74.2894],
  ['050113', 'Tambillo', -13.1947, -74.1106], ['050114', 'Vinchos', -13.2417, -74.3542],
  ['050115', 'Jesús Nazareno', -13.1542, -74.2125], ['050116', 'Andrés Avelino Cáceres Dorregaray', -13.1628, -74.2139],
].map(([ubigeo, name, latitude, longitude]) => Object.freeze({ ubigeo, name, latitude, longitude })));

/** Sinónimos: no son lugares aparte. «huamanga» → distrito Ayacucho (capital de la provincia); «cuzco» → Cusco. */
export const PLACE_ALIASES = Object.freeze({ huamanga: 'Ayacucho', cuzco: 'Cusco' });

export const fold = value => String(value ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim().replace(/\s+/g, ' ');

/** Alcance: 'huamanga' (por defecto, también si el valor es desconocido) o 'peru'. */
export function placesScope(value) { return value === 'peru' ? 'peru' : 'huamanga'; }

export function searchPlaces(scope = 'huamanga') {
  if (placesScope(scope) === 'huamanga') return HUAMANGA_DISTRICTS;
  const byName = new Map(HUAMANGA_DISTRICTS.map(place => [fold(place.name), place]));
  for (const place of PERU_PLACES) {
    const key = fold(place.name);
    if (Object.hasOwn(PLACE_ALIASES, key) || byName.has(key)) continue; // sin duplicados (Cuzco, Huamanga, Ayacucho)
    byName.set(key, Object.freeze({ ubigeo: null, name: place.name, latitude: place.latitude, longitude: place.longitude }));
  }
  return Object.freeze([...byName.values()].sort((a, b) => a.name.localeCompare(b.name, 'es')));
}

const configured = (() => { try { return import.meta.env?.VITE_SEARCH_PLACES_SCOPE; } catch { return undefined; } })();
export const SEARCH_PLACES_SCOPE = placesScope(configured);
export const ACTIVE_SEARCH_PLACES = searchPlaces(SEARCH_PLACES_SCOPE);

/** Lugar exacto (sin tildes ni mayúsculas, con sinónimos) dentro de la lista dada. */
export function findSearchPlace(name, places = ACTIVE_SEARCH_PLACES) {
  const key = fold(name); const target = fold(PLACE_ALIASES[key] ?? name);
  return places.find(place => fold(place.name) === target) ?? null;
}

/**
 * Filtro mientras se escribe: cualquier parte del nombre, sin tildes ni mayúsculas. Primero los que empiezan
 * con lo escrito, luego los que tienen una palabra que empieza así y al final los que solo lo contienen.
 * Texto vacío → la lista completa (guía). Los sinónimos también encuentran su lugar.
 */
export function filterPlaces(places, text) {
  const query = fold(text);
  if (!query) return [...places];
  const rank = place => {
    const name = fold(place.name);
    if (name.startsWith(query)) return 0;
    if (name.split(' ').some(word => word.startsWith(query))) return 1;
    if (name.includes(query)) return 2;
    return Object.entries(PLACE_ALIASES).some(([alias, target]) => alias.includes(query) && fold(target) === name) ? 3 : -1;
  };
  return places.map(place => [rank(place), place]).filter(([value]) => value >= 0)
    .sort((a, b) => a[0] - b[0] || a[1].name.localeCompare(b[1].name, 'es')).map(([, place]) => place);
}
