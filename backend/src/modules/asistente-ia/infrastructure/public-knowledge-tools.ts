import type { PublicKnowledgeGateway } from '../../busqueda/contracts/public-knowledge.js';
import type { PublicKnowledgeTools } from '../application/ports.js';
export class F03PublicKnowledgeTools implements PublicKnowledgeTools {
  constructor(private readonly gateway: PublicKnowledgeGateway) {}
  search(term: string) { return this.gateway.search(term); }
  compare(term: string) { return this.gateway.compare(term); }
  pharmacy(id: string) { return this.gateway.pharmacy(id); }
}
