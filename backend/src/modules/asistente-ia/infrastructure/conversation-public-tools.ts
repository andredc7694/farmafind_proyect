import type { PublicKnowledgeGateway } from '../../busqueda/contracts/public-knowledge.js';
import type { ConversationPublicTools } from '../application/conversation-ports.js';
import { F03PublicKnowledgeTools } from './public-knowledge-tools.js';

/** F06.1 can only call the existing public, read-only F03 gateway. */
export class F03ConversationPublicTools implements ConversationPublicTools {
  private readonly publicTools: F03PublicKnowledgeTools;
  constructor(gateway: PublicKnowledgeGateway) { this.publicTools = new F03PublicKnowledgeTools(gateway); }
  search(term: string) { return this.publicTools.search(term); }
  compare(term: string) { return this.publicTools.compare(term); }
  pharmacy(id: string) { return this.publicTools.pharmacy(id); }
}
