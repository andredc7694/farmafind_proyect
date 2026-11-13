import { createHash } from 'node:crypto';
import { PUBLIC_NOTICE, type PublicOffer, type PublicSearchResponse } from '../contracts/public-search.js';
import type { CanonicalPublicQuery } from '../domain/public-query.js';
import { orderOffers } from '../domain/public-offer.js';
import { NO_SEARCH_METRICS, type PublicOfferRepository, type SearchCache, type SearchMetrics } from './ports.js';

export interface SearchOptions { readonly ttlSeconds: number; readonly candidateLimit: number; }

function cacheable(query: CanonicalPublicQuery): Record<string, unknown> {
  return { term: query.term, minimumPrice: query.minimumPrice, maximumPrice: query.maximumPrice,
    order: query.order, page: query.page, pageSize: query.pageSize };
}

export function searchCacheKey(generation: string, query: CanonicalPublicQuery): string {
  const digest = createHash('sha256').update(JSON.stringify(cacheable(query))).digest('hex');
  return `farmafind:f03:v1:g${generation}:search:${digest}`;
}

function response(query: CanonicalPublicQuery, candidates: readonly PublicOffer[]): PublicSearchResponse {
  const ordered = orderOffers(candidates, query);
  const start = (query.page - 1) * query.pageSize;
  return { consulta: query.term, ofertas: ordered.slice(start, start + query.pageSize),
    paginacion: { pagina: query.page, tamano: query.pageSize, total: ordered.length,
      totalPaginas: Math.ceil(ordered.length / query.pageSize) }, aviso: PUBLIC_NOTICE };
}

function exactKeys(value: object, allowed: readonly string[]): boolean {
  const keys = Object.keys(value).sort(); return keys.length === allowed.length && keys.every((key,index) => key === [...allowed].sort()[index]);
}
function validCached(value: unknown): value is PublicSearchResponse {
  if (typeof value !== 'object' || value === null || !exactKeys(value,['consulta','ofertas','paginacion','aviso'])) return false;
  const candidate=value as PublicSearchResponse;
  if (candidate.aviso !== PUBLIC_NOTICE || typeof candidate.consulta !== 'string' || !Array.isArray(candidate.ofertas) ||
      typeof candidate.paginacion !== 'object' || candidate.paginacion === null ||
      !exactKeys(candidate.paginacion,['pagina','tamano','total','totalPaginas'])) return false;
  return candidate.ofertas.every(offer => typeof offer === 'object' && offer !== null &&
    exactKeys(offer,['medicamento','farmacia','precioReferencialCentavos','disponibilidadReferencial','ultimaRevision','distanciaKm']) &&
    exactKeys(offer.medicamento,['id','nombreComercial','principioActivo','concentracion','presentacion','clasificacion']) &&
    exactKeys(offer.farmacia,['id','nombre','direccion']) && offer.disponibilidadReferencial === 'DISPONIBLE');
}

export class SearchPublicOffers {
  constructor(private readonly repository: PublicOfferRepository, private readonly cache: SearchCache | null,
    private readonly options: SearchOptions, private readonly metrics: SearchMetrics = NO_SEARCH_METRICS) {}

  async execute(query: CanonicalPublicQuery): Promise<PublicSearchResponse> {
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
        const fresh = response(query, await this.repository.search(query, this.options.candidateLimit));
        try { await this.cache.set(key, JSON.stringify(fresh), this.options.ttlSeconds); } catch { this.metrics.record('fallback'); }
        return fresh;
      } catch { this.metrics.record('fallback'); }
    }
    return response(query, await this.repository.search(query, this.options.candidateLimit));
  }
}
