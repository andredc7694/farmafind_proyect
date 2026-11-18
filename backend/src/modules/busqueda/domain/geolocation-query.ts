import { canonicalizeTerm } from './public-query.js';

export class GeolocationQueryError extends Error {
  readonly code = 'INVALID_GEOLOCATION_QUERY';
}

export interface GeoFilters {
  readonly term: string | null;
  readonly minimumPrice: number | null;
  readonly maximumPrice: number | null;
  readonly page: number;
  readonly pageSize: number;
}
export interface CityQuery extends GeoFilters { readonly city: string; readonly kind: 'city'; }
export interface ProximityQuery extends GeoFilters {
  readonly kind: 'proximity'; readonly latitude: number; readonly longitude: number; readonly radiusKm: number;
}

function record(input: unknown): Record<string,unknown> {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) throw new GeolocationQueryError('Objeto requerido');
  return input as Record<string,unknown>;
}
function keys(input: Record<string,unknown>, allowed: readonly string[]): void {
  if (Object.keys(input).some(key=>!allowed.includes(key))) throw new GeolocationQueryError('Parámetro desconocido');
}
function text(value: unknown, label: string): string {
  if (typeof value !== 'string') throw new GeolocationQueryError(`${label} requerida`);
  const normalized=value.normalize('NFC').trim().replace(/\s+/g,' ').toLocaleLowerCase('es');
  if (normalized.length < 2 || normalized.length > 120) throw new GeolocationQueryError(`${label} fuera de rango`);
  return normalized;
}
function integer(value: unknown, fallback: number, min: number, max: number, fromUrl: boolean): number {
  if (value === undefined) return fallback;
  if (fromUrl ? typeof value !== 'string' || !/^\d+$/.test(value) : typeof value !== 'number')
    throw new GeolocationQueryError('Entero inválido');
  const parsed=Number(value);
  if (!Number.isSafeInteger(parsed) || parsed<min || parsed>max) throw new GeolocationQueryError('Entero fuera de rango');
  return parsed;
}
function filters(input: Record<string,unknown>, fromUrl: boolean): GeoFilters {
  const term=input.q === undefined ? null : text(input.q,'Producto');
  const minimumPrice=input.precioMinCentavos===undefined ? null : integer(input.precioMinCentavos,0,0,Number.MAX_SAFE_INTEGER,fromUrl);
  const maximumPrice=input.precioMaxCentavos===undefined ? null : integer(input.precioMaxCentavos,0,0,Number.MAX_SAFE_INTEGER,fromUrl);
  if (minimumPrice!==null && maximumPrice!==null && minimumPrice>maximumPrice)
    throw new GeolocationQueryError('Precios incompatibles');
  return {term,minimumPrice,maximumPrice,
    page:integer(input.pagina,1,1,1_000_000,fromUrl),pageSize:integer(input.tamano,20,1,50,fromUrl)};
}
export function parseCityQuery(raw: unknown): CityQuery {
  const input=record(raw); keys(input,['ciudad','q','precioMinCentavos','precioMaxCentavos','pagina','tamano']);
  const city=text(input.ciudad,'Ciudad');
  if (/^[-+]?\d+(?:\.\d+)?\s*[,; ]\s*[-+]?\d+(?:\.\d+)?$/.test(city))
    throw new GeolocationQueryError('La ubicación personal debe enviarse en el cuerpo POST');
  return {kind:'city',city,...filters(input,true)};
}
export function parseProximityQuery(raw: unknown): ProximityQuery {
  const input=record(raw); keys(input,['latitud','longitud','radioKm','q','precioMinCentavos','precioMaxCentavos','pagina','tamano']);
  const latitude=input.latitud,longitude=input.longitud,radius=input.radioKm===undefined?10:input.radioKm;
  if (typeof latitude!=='number' || !Number.isFinite(latitude) || latitude< -90 || latitude>90 ||
      typeof longitude!=='number' || !Number.isFinite(longitude) || longitude< -180 || longitude>180 ||
      typeof radius!=='number' || !Number.isFinite(radius) || radius<1 || radius>50)
    throw new GeolocationQueryError('Coordenadas o radio inválidos');
  return {kind:'proximity',latitude,longitude,radiusKm:radius,...filters(input,false)};
}
