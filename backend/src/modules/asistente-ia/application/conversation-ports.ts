import type { PublicSearchResponse } from '../../busqueda/contracts/public-search.js';
import type { PublicOpeningDay } from '../domain/opening-now.js';

export interface ReviewedSource {
  readonly authority: string;
  readonly jurisdiction: string;
  readonly reference: string;
  readonly title: string;
  readonly version: string;
  readonly reviewedAt: string;
  readonly validUntil: string;
  readonly reusePermission: string;
  readonly professionalReviewer: string;
  readonly approvedForTest: boolean;
  readonly productName: string;
  readonly educationalStatement: string;
  readonly educationalWarning?: string;
  readonly categoryKey?: string;
}

export interface ReviewedSourceCatalog {
  lookup(term: string, now: Date): ReviewedSource | null;
}

export type ConversationIntent = 'SOURCE' | 'PUBLIC_SEARCH' | 'PUBLIC_COMPARE' | 'SYMPTOM' | 'HELP'
  | 'GREETING' | 'CAPABILITIES' | 'NEARBY' | 'ASK_TERM';
export interface ConversationDecision { readonly intent: ConversationIntent; readonly term: string | null; }
export interface ConversationProvider { classify(query: string): Promise<ConversationDecision>; }

export interface GeoPoint { readonly latitude: number; readonly longitude: number }
export interface AssistantSearchOptions { readonly order: 'relevancia' | 'precio_asc' | 'cercania'; readonly point?: GeoPoint | null }
/** Farmacia pública activa con ubicación verificada (F07), sin datos privados. */
export interface NearbyPublicPharmacy {
  readonly id: string; readonly nombre: string; readonly direccion: string; readonly distanciaKm: number | null;
}

/**
 * F06.2 · FR-013: herramientas de SOLO LECTURA sobre datos públicos (ofertas publicadas F03/F03.2, farmacias activas
 * F07 y horario público F07.1). Las de lugar y horario existen solo cuando F07 está activo.
 */
export interface ConversationPublicTools {
  search(term: string, options: AssistantSearchOptions): Promise<PublicSearchResponse>;
  /** Nombres públicos que empiezan como el texto dado (para «¿Quisiste decir…?»). */
  suggestNames(prefix: string): Promise<readonly string[]>;
  pharmaciesNear?(point: GeoPoint, radiusKm: number): Promise<readonly NearbyPublicPharmacy[]>;
  openingHours?(pharmacyIds: readonly string[]): Promise<Readonly<Record<string, readonly PublicOpeningDay[]>>>;
}
