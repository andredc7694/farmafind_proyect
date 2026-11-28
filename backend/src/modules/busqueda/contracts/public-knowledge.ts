import type { PublicPharmacy, PublicSearchResponse } from './public-search.js';
export type PublicAssistantOrder = 'relevancia' | 'precio_asc' | 'cercania';
export interface PublicAssistantPoint { readonly latitude: number; readonly longitude: number }
export interface PublicKnowledgeGateway {
  /** F06.2: orden y punto opcionales (la cercanía requiere punto). Sin ellos, igual que F06/F06.1. */
  search(term: string, order?: PublicAssistantOrder, point?: PublicAssistantPoint | null): Promise<PublicSearchResponse>;
  compare(term: string): Promise<PublicSearchResponse>;
  pharmacy(id: string): Promise<PublicPharmacy | null>;
  /** F06.2: nombres públicos (F08.1, solo ofertas visibles) que coinciden con el texto. */
  suggestNames(prefix: string): Promise<readonly string[]>;
}
