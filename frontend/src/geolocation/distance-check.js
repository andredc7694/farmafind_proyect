import { PERU_PLACES } from './peru-cities.js';
import { HUAMANGA_DISTRICTS, fold } from '../search/search-places.js';

/**
 * F07.2 (FR-007 a FR-010, D-04 A): aviso de distancia entre el punto y el centro de la ciudad escrita, con la lista
 * interna (F07.1 + los 16 distritos de Huamanga de F03.1 E-01). Sin servicios externos. Solo avisa; nunca bloquea.
 */
export const FAR_THRESHOLD_KM = 30;
const index = new Map();
for (const place of [...HUAMANGA_DISTRICTS, ...PERU_PLACES]) if (!index.has(fold(place.name))) index.set(fold(place.name), place);

/** Centro aproximado de una ciudad o distrito de la lista (sin tildes ni mayúsculas), o null. */
export function findCityCenter(name) {
  const place = index.get(fold(name));
  return place ? { name: place.name, latitude: place.latitude, longitude: place.longitude } : null;
}

/** Distancia en línea recta (haversine), en km. */
export function distanceKm(a, b) {
  const rad = value => value * Math.PI / 180;
  const h = Math.sin(rad(b.latitude - a.latitude) / 2) ** 2 +
    Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(rad(b.longitude - a.longitude) / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/** null si está cerca o falta algo; { tipo: 'lejos', km, ciudad } o { tipo: 'desconocida', ciudad }. */
export function distanceWarning(cityName, point) {
  const city = String(cityName ?? '').trim();
  if (city.length < 2 || !point || !Number.isFinite(point.latitude) || !Number.isFinite(point.longitude)) return null;
  const center = findCityCenter(city);
  if (!center) return { tipo: 'desconocida', ciudad: city };
  const km = Math.round(distanceKm(center, point));
  return km > FAR_THRESHOLD_KM ? { tipo: 'lejos', km, ciudad: center.name } : null;
}

export function distanceMessage(warning) {
  if (!warning) return '';
  return warning.tipo === 'lejos' ? `Este punto está a ${warning.km} km de ${warning.ciudad}. ¿Es correcto?`
    : `No podemos comprobar la distancia: «${warning.ciudad}» no está en nuestra lista de ciudades.`;
}
