import { PublicQueryError } from '../contracts/public-search.js';

export type PublicOrder = 'relevancia' | 'precio_asc' | 'precio_desc' | 'disponibilidad' | 'cercania';
export interface CanonicalPublicQuery {
  readonly term: string;
  readonly minimumPrice: number | null;
  readonly maximumPrice: number | null;
  readonly order: PublicOrder;
  readonly latitude: number | null;
  readonly longitude: number | null;
  readonly page: number;
  readonly pageSize: number;
}

function whole(value: unknown, fallback: number, minimum: number, maximum: number): number {
  if (value === undefined) return fallback;
  if (typeof value !== 'string' || !/^\d+$/.test(value)) throw new PublicQueryError('INVALID_QUERY', 'Parámetro entero inválido');
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) throw new PublicQueryError('INVALID_QUERY', 'Parámetro fuera de rango');
  return parsed;
}

function optionalNumber(value: unknown, minimum: number, maximum: number): number | null {
  if (value === undefined) return null;
  if (typeof value !== 'string' || value.trim() === '') throw new PublicQueryError('INVALID_QUERY', 'Coordenada inválida');
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < minimum || parsed > maximum) throw new PublicQueryError('INVALID_QUERY', 'Coordenada fuera de rango');
  return parsed;
}

export function canonicalizeTerm(value: unknown): string {
  if (typeof value !== 'string') throw new PublicQueryError('INVALID_QUERY', 'Consulta requerida');
  const term = value.normalize('NFC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('es');
  if (term.length < 2 || term.length > 120) throw new PublicQueryError('INVALID_QUERY', 'La consulta debe tener entre 2 y 120 caracteres');
  return term;
}

export function parsePublicQuery(input: Record<string, unknown>): CanonicalPublicQuery {
  const minimumPrice = input.precioMinCentavos === undefined ? null : whole(input.precioMinCentavos, 0, 0, Number.MAX_SAFE_INTEGER);
  const maximumPrice = input.precioMaxCentavos === undefined ? null : whole(input.precioMaxCentavos, 0, 0, Number.MAX_SAFE_INTEGER);
  if (minimumPrice !== null && maximumPrice !== null && minimumPrice > maximumPrice) {
    throw new PublicQueryError('INCOMPATIBLE_PARAMETERS', 'El precio mínimo no puede superar al máximo');
  }
  const order = input.orden === undefined ? 'relevancia' : String(input.orden);
  if (!['relevancia','precio_asc','precio_desc','disponibilidad','cercania'].includes(order)) {
    throw new PublicQueryError('INVALID_QUERY', 'Orden inválido');
  }
  const latitude = optionalNumber(input.latitud, -90, 90);
  const longitude = optionalNumber(input.longitud, -180, 180);
  if ((latitude === null) !== (longitude === null) || (order === 'cercania' && latitude === null)) {
    throw new PublicQueryError('INCOMPATIBLE_PARAMETERS', 'La cercanía requiere latitud y longitud');
  }
  return { term: canonicalizeTerm(input.q), minimumPrice, maximumPrice, order: order as PublicOrder,
    latitude, longitude, page: whole(input.pagina, 1, 1, 1_000_000), pageSize: whole(input.tamano, 20, 1, 50) };
}
