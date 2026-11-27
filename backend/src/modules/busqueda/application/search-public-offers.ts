import { createHash } from 'node:crypto';
import { PUBLIC_MATCHES, PUBLIC_NOTICE, type PublicMatch, type PublicOffer, type PublicSearchResponse } from '../contracts/public-search.js';
import type { CanonicalPublicQuery } from '../domain/public-query.js';
import { compareOffers } from '../domain/public-offer.js';
import { searchTerms, type SearchTerms } from '../domain/search-terms.js';
import { NO_SEARCH_METRICS, type MatchedOffer, type PublicOfferRepository, type SearchCache, type SearchMetrics } from './ports.js';

export interface SearchOptions { readonly ttlSeconds: number; readonly candidateLimit: number; }

function cacheable(query: CanonicalPublicQuery): Record<string, unknown> {
  return { term: query.term, minimumPrice: query.minimumPrice, maximumPrice: query.maximumPrice,
    order: query.order, page: query.page, pageSize: query.pageSize };
}

export function searchCacheKey(generation: string, query: CanonicalPublicQuery): string {
  const digest = createHash('sha256').update(JSON.stringify(cacheable(query))).digest('hex');
  return `farmafind:f03:v2:g${generation}:search:${digest}`;
}

/**
 * F03.2: si hay exactos (todas las palabras y tokens coinciden) se devuelven solo esos (D-02 A); si no, todos los
 * candidatos del medicamento como APROXIMADA, los más parecidos primero y luego el orden elegido.
 */
export function matchOffers(terms: SearchTerms, matched: readonly MatchedOffer[], query: CanonicalPublicQuery):
  { offers: readonly PublicOffer[]; match: PublicMatch } {
  if (matched.length === 0) return { offers: [], match: terms.nameless ? 'FALTA_NOMBRE' : 'NINGUNA' };
  const wanted = terms.words.length + terms.tokens.length;
  const exact = matched.filter(item => item.matches >= wanted);
  const chosen = exact.length > 0 ? exact : matched;
  const compare = compareOffers(query);
  const offers = [...chosen].sort((a, b) => b.matches - a.matches || compare(a.offer, b.offer)).map(item => item.offer);
  return { offers, match: exact.length > 0 ? 'EXACTA' : 'APROXIMADA' };
}

function response(query: CanonicalPublicQuery, terms: SearchTerms, matched: readonly MatchedOffer[]): PublicSearchResponse {
  const { offers, match } = matchOffers(terms, matched, query);
  const start = (query.page - 1) * query.pageSize;
  return { consulta: query.term, ofertas: offers.slice(start, start + query.pageSize),
    paginacion: { pagina: query.page, tamano: query.pageSize, total: offers.length,
      totalPaginas: Math.ceil(offers.length / query.pageSize) }, aviso: PUBLIC_NOTICE, coincidencia: match };
}

function exactKeys(value: object, allowed: readonly string[]): boolean {
  const keys = Object.keys(value).sort(); return keys.length === allowed.length && keys.every((key,index) => key === [...allowed].sort()[index]);
}
/** F03.1: forma nueva obligatoria; una entrada vieja (sin ubicacion) se descarta y se recalcula. */
function validLocation(value: unknown): boolean {
  if (value === null) return true;
  if (typeof value !== 'object' || !exactKeys(value,['latitud','longitud'])) return false;
  const point = value as { latitud: unknown; longitud: unknown };
  return typeof point.latitud === 'number' && typeof point.longitud === 'number';
}
function validCached(value: unknown): value is PublicSearchResponse {
  if (typeof value !== 'object' || value === null || !exactKeys(value,['consulta','ofertas','paginacion','aviso','coincidencia'])) return false;
  const candidate=value as PublicSearchResponse;
  if (candidate.aviso !== PUBLIC_NOTICE || !PUBLIC_MATCHES.includes(candidate.coincidencia) || typeof candidate.consulta !== 'string' || !Array.isArray(candidate.ofertas) ||
      typeof candidate.paginacion !== 'object' || candidate.paginacion === null ||
      !exactKeys(candidate.paginacion,['pagina','tamano','total','totalPaginas'])) return false;
  return candidate.ofertas.every(offer => typeof offer === 'object' && offer !== null &&
    exactKeys(offer,['medicamento','farmacia','precioReferencialCentavos','disponibilidadReferencial','ultimaRevision','distanciaKm']) &&
    exactKeys(offer.medicamento,['id','nombreComercial','principioActivo','concentracion','presentacion','clasificacion']) &&
    exactKeys(offer.farmacia,['id','nombre','direccion','ubicacion']) && validLocation(offer.farmacia.ubicacion) &&
    offer.disponibilidadReferencial === 'DISPONIBLE');
}

export class SearchPublicOffers {
  constructor(private readonly repository: PublicOfferRepository, private readonly cache: SearchCache | null,
    private readonly options: SearchOptions, private readonly metrics: SearchMetrics = NO_SEARCH_METRICS) {}

  async execute(query: CanonicalPublicQuery): Promise<PublicSearchResponse> {
    const terms = searchTerms(query.term);
    // Sin palabras que puedan ser nombre no se consulta la base ni la caché (FR-013).
    if (terms.words.length === 0) return response(query, terms, []);
    const fetch = async () => response(query, terms, await this.repository.search(terms, query, this.options.candidateLimit));
    // Location is deliberately ephemeral and never serialized into Redis.
    if (this.cache && query.latitude === null) {
      try {
        const key = searchCacheKey(await this.cache.generation(), query);
        const cached = await this.cache.get(key);
        if (cached !== null) {
          const parsed: unknown = JSON.parse(cached);
          if (validCached(parsed)) { this.metrics.record('hit'); return parsed; }
          this.metrics.record('invalid');
        } else this.metrics.record('miss');
        const fresh = await fetch();
        try { await this.cache.set(key, JSON.stringify(fresh), this.options.ttlSeconds); } catch { this.metrics.record('fallback'); }
        return fresh;
      } catch { this.metrics.record('fallback'); }
    }
    return fetch();
  }
}
