import type { PublicOffer } from '../contracts/public-search.js';
import { canonicalizeTerm } from '../domain/public-query.js';
import type { PublicOfferRepository } from './ports.js';

export const SUGGESTION_MAX = 8;
export interface PublicSuggestion { readonly text: string; readonly kind: 'NOMBRE' | 'PRESENTACION' }

/**
 * F08.1: sugerencias mientras se escribe. Salen EXCLUSIVAMENTE de la proyección pública F03 (ofertas visibles), así que un
 * medicamento sin oferta pública nunca aparece. Solo proponen texto: sin ids, precios ni farmacias, y no cambian nada.
 */
export class SuggestPublicOffers {
  constructor(private readonly repository: PublicOfferRepository, private readonly candidateLimit = 50) {}

  async execute(input: unknown): Promise<{ suggestions: readonly PublicSuggestion[] }> {
    const term = canonicalizeTerm(input);
    const offers = await this.repository.search({ term, minimumPrice: null, maximumPrice: null, order: 'relevancia',
      latitude: null, longitude: null, page: 1, pageSize: this.candidateLimit }, this.candidateLimit);
    return { suggestions: derive(offers) };
  }
}

const key = (text: string) => text.normalize('NFC').toLocaleLowerCase('es');

export function derive(offers: readonly PublicOffer[]): readonly PublicSuggestion[] {
  const names = new Map<string, PublicSuggestion>(); const forms = new Map<string, PublicSuggestion>();
  for (const offer of offers) {
    const { nombreComercial, principioActivo, concentracion, presentacion } = offer.medicamento;
    for (const text of [nombreComercial, principioActivo]) if (text && !names.has(key(text))) names.set(key(text), { text, kind: 'NOMBRE' });
    const form = `${nombreComercial} ${concentracion} ${presentacion}`.trim();
    if (!forms.has(key(form))) forms.set(key(form), { text: form, kind: 'PRESENTACION' });
  }
  const result: PublicSuggestion[] = [...names.values()].slice(0, 5);
  for (const item of forms.values()) { if (result.length >= SUGGESTION_MAX) break; result.push(item); }
  return result;
}
