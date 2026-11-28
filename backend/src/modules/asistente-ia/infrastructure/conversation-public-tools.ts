import type { PublicKnowledgeGateway } from '../../busqueda/contracts/public-knowledge.js';
import type { AssistantSearchOptions, ConversationPublicTools, GeoPoint, NearbyPublicPharmacy } from '../application/conversation-ports.js';
import type { PublicOpeningDay } from '../domain/opening-now.js';

/** Lectura pública F07 (farmacias activas con ubicación verificada), sin términos ni filtros de precio. */
export interface PublicNearbyLister {
  execute(query: { readonly kind: 'proximity'; readonly latitude: number; readonly longitude: number; readonly radiusKm: number;
    readonly term: null; readonly minimumPrice: null; readonly maximumPrice: null; readonly page: number; readonly pageSize: number }):
    Promise<{ readonly farmacias: ReadonlyArray<{ readonly farmaciaId: string; readonly nombre: string; readonly direccion: string;
      readonly distanciaLinealKm?: number }> }>;
}
/** Lectura pública F07.1 del horario (máximo 50 farmacias, con caché). */
export interface PublicHoursReader { read(ids: unknown): Promise<Record<string, PublicOpeningDay[]>> }

/** F06.2: solo herramientas públicas de lectura (F03/F03.2, F07, F07.1). Nada escribe ni lee datos privados. */
export class F03ConversationPublicTools implements ConversationPublicTools {
  readonly pharmaciesNear?: (point: GeoPoint, radiusKm: number) => Promise<readonly NearbyPublicPharmacy[]>;
  readonly openingHours?: (ids: readonly string[]) => Promise<Readonly<Record<string, readonly PublicOpeningDay[]>>>;

  constructor(private readonly gateway: PublicKnowledgeGateway, nearby?: PublicNearbyLister, hours?: PublicHoursReader) {
    if (nearby) this.pharmaciesNear = async (point, radiusKm) => (await nearby.execute({ kind: 'proximity', latitude: point.latitude,
      longitude: point.longitude, radiusKm, term: null, minimumPrice: null, maximumPrice: null, page: 1, pageSize: 50 }))
      .farmacias.map(item => ({ id: item.farmaciaId, nombre: item.nombre, direccion: item.direccion, distanciaKm: item.distanciaLinealKm ?? null }));
    if (hours) this.openingHours = async ids => ids.length === 0 ? {} : hours.read(ids.slice(0, 50).join(','));
  }

  search(term: string, options: AssistantSearchOptions) { return this.gateway.search(term, options.order, options.point ?? null); }
  suggestNames(prefix: string) { return this.gateway.suggestNames(prefix); }
}
