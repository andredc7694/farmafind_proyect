import type { PublicOfferRepository } from '../application/ports.js';
import type { PublicOffer, PublicPharmacy } from '../contracts/public-search.js';
import type { CanonicalPublicQuery } from '../domain/public-query.js';
import { distanceKm } from '../domain/public-offer.js';
import type { GeoPublicOffer, GeoPublicPharmacy, GeolocationReadPort } from '../application/list-nearby-pharmacies.js';

interface Queryable { query(sql: string, values?: unknown[]): Promise<{ rows: Array<Record<string, unknown>> }>; }

export interface PublicOfferRepositoryOptions {
  /** F03.1: true solo si la composición activa F07 (su versión de search_public_offers devuelve
   *  coordenadas únicamente con ubicación verificada). Apagado: ubicacion siempre null. */
  readonly exposeVerifiedLocation?: boolean;
}

function verifiedLocation(row: Record<string, unknown>, enabled: boolean) {
  if (!enabled || row.farmacia_latitud === null || row.farmacia_latitud === undefined ||
      row.farmacia_longitud === null || row.farmacia_longitud === undefined) return null;
  const latitud = Number(row.farmacia_latitud), longitud = Number(row.farmacia_longitud);
  return Number.isFinite(latitud) && Number.isFinite(longitud) && Math.abs(latitud) <= 90 && Math.abs(longitud) <= 180
    ? { latitud, longitud } : null;
}

export class PgPublicOfferRepository implements PublicOfferRepository, GeolocationReadPort {
  constructor(private readonly database: Queryable, private readonly options: PublicOfferRepositoryOptions = {}) {}

  async search(query: CanonicalPublicQuery, maximum: number): Promise<readonly PublicOffer[]> {
    const result = await this.database.query('SELECT * FROM f03.search_public_offers($1,$2,$3,$4)',
      [query.term, query.minimumPrice, query.maximumPrice, maximum]);
    return result.rows.map(row => ({
      medicamento: { id: String(row.medicamento_id), nombreComercial: String(row.nombre_comercial),
        principioActivo: String(row.principio_activo), concentracion: String(row.concentracion),
        presentacion: String(row.presentacion), clasificacion: String(row.clasificacion) },
      farmacia: { id: String(row.farmacia_id), nombre: String(row.farmacia_nombre), direccion: String(row.farmacia_direccion),
        ubicacion: verifiedLocation(row, this.options.exposeVerifiedLocation === true) },
      precioReferencialCentavos: Number(row.precio_centavos), disponibilidadReferencial: 'DISPONIBLE' as const,
      ultimaRevision: new Date(String(row.ultima_revision)).toISOString(),
      distanciaKm: query.latitude === null || row.farmacia_latitud === null || row.farmacia_longitud === null ? null :
        distanceKm(query.latitude, query.longitude!, Number(row.farmacia_latitud), Number(row.farmacia_longitud)),
    }));
  }

  async pharmacy(id: string): Promise<PublicPharmacy | null> {
    const result = await this.database.query('SELECT * FROM f03.get_public_pharmacy($1)', [id]);
    const row = result.rows[0];
    return row ? { id: String(row.farmacia_id), nombre: String(row.farmacia_nombre), direccion: String(row.farmacia_direccion) } : null;
  }

  async listPharmacies(city: string | null): Promise<readonly GeoPublicPharmacy[]> {
    const result=await this.database.query('SELECT * FROM f07.list_public_pharmacies($1)',[city]);
    return result.rows.map(row=>({id:String(row.farmacia_id),name:String(row.farmacia_nombre),
      address:String(row.farmacia_direccion),city:String(row.ciudad),
      latitude:row.farmacia_latitud===null?null:Number(row.farmacia_latitud),
      longitude:row.farmacia_longitud===null?null:Number(row.farmacia_longitud),
      verified:row.ubicacion_verificada===true,updatedAt:new Date(String(row.actualizado_en)).toISOString()}));
  }

  async listOffers(term:string|null,minimumPrice:number|null,maximumPrice:number|null):Promise<readonly GeoPublicOffer[]> {
    const result=await this.database.query('SELECT * FROM f03.search_public_offers($1,$2,$3,$4)',
      [term ?? '',minimumPrice,maximumPrice,200]);
    return result.rows.map(row=>({pharmacyId:String(row.farmacia_id),productId:String(row.medicamento_id),
      priceCents:Number(row.precio_centavos),reviewedAt:new Date(String(row.ultima_revision)).toISOString()}));
  }
}
