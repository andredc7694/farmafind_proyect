import type { SearchPublicOffers } from '../application/search-public-offers.js';
import type { PublicOfferRepository } from '../application/ports.js';
import { SuggestPublicOffers } from '../application/suggest-public.js';
import type { PublicAssistantOrder, PublicAssistantPoint, PublicKnowledgeGateway } from '../contracts/public-knowledge.js';
import type { CanonicalPublicQuery, PublicOrder } from '../domain/public-query.js';

/** F06.2: el asistente pide hasta 50 ofertas para poder agrupar concentraciones y formas. */
function query(term: string, order: PublicOrder, point: PublicAssistantPoint | null = null, pageSize = 20): CanonicalPublicQuery {
  const located = point !== null && Number.isFinite(point.latitude) && Number.isFinite(point.longitude);
  return { term: term.normalize('NFC').trim().toLocaleLowerCase('es').slice(0, 120), minimumPrice: null, maximumPrice: null,
    order: order === 'cercania' && !located ? 'relevancia' : order,
    latitude: located ? point!.latitude : null, longitude: located ? point!.longitude : null, page: 1, pageSize };
}

export class F03PublicAssistantGateway implements PublicKnowledgeGateway {
  private readonly suggester: SuggestPublicOffers;
  constructor(private readonly searchUseCase: SearchPublicOffers, private readonly repository: PublicOfferRepository) {
    this.suggester = new SuggestPublicOffers(repository);
  }
  search(term: string, order?: PublicAssistantOrder, point?: PublicAssistantPoint | null) {
    return order === undefined ? this.searchUseCase.execute(query(term, 'relevancia'))
      : this.searchUseCase.execute(query(term, order, point ?? null, 50));
  }
  compare(term: string) { return this.searchUseCase.execute(query(term, 'precio_asc')); }
  pharmacy(id: string) { return this.repository.pharmacy(id); }
  async suggestNames(prefix: string) {
    const result = await this.suggester.execute(prefix);
    return result.suggestions.filter(item => item.kind === 'NOMBRE').map(item => item.text);
  }
}
