import type { PublicPharmacy, PublicSearchResponse } from './public-search.js';
export interface PublicKnowledgeGateway {
  search(term: string): Promise<PublicSearchResponse>;
  compare(term: string): Promise<PublicSearchResponse>;
  pharmacy(id: string): Promise<PublicPharmacy | null>;
}
