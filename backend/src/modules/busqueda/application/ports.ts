import type { PublicOffer, PublicPharmacy } from '../contracts/public-search.js';
import type { CanonicalPublicQuery } from '../domain/public-query.js';
import type { SearchTerms } from '../domain/search-terms.js';

/** F03.2: oferta pública + cuántas palabras y tokens de la consulta coinciden (para exacta/aproximada). */
export interface MatchedOffer { readonly offer: PublicOffer; readonly matches: number; }

export interface PublicOfferRepository {
  search(terms: SearchTerms, query: CanonicalPublicQuery, maximum: number): Promise<readonly MatchedOffer[]>;
  pharmacy(id: string): Promise<PublicPharmacy | null>;
}

export interface SearchCache {
  generation(): Promise<string>;
  get(key: string): Promise<string | null>;
  set(key: string, payload: string, ttlSeconds: number): Promise<void>;
}

export interface SearchMetrics {
  record(event: 'hit' | 'miss' | 'fallback' | 'invalid'): void;
}
export interface SearchClock { now(): Date; }

export interface SearchInvalidator { invalidate(): Promise<void>; }

export const NO_SEARCH_INVALIDATOR: SearchInvalidator = { invalidate: async () => undefined };
export const NO_SEARCH_METRICS: SearchMetrics = { record: () => undefined };
