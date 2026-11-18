import type { ConversationDecision, ConversationProvider } from '../application/conversation-ports.js';
import { MockAIProvider } from './mock-ai-provider.js';

const SYMPTOM = /\b(clases?|categor[ií]as?|molestias? comunes|uso habitual)\b/iu;
const SOURCE = /\b(ficha|principio activo|presentaci[oó]n|advertencias?|precauciones?)\b/iu;
const FOLLOWUP = /^\s*[¿?]?(?:y |sus |qu[eé] )/iu;
const SEARCH = /\b(busca|buscar|encuentra|compara|comparar|precio|farmacia)\b/iu;

/** Deterministic local classifier; no network, free text generation or external SDK. */
export class MockConversationProvider implements ConversationProvider {
  private readonly existing = new MockAIProvider();
  async classify(query: string): Promise<ConversationDecision> {
    if (SYMPTOM.test(query)) return { intent: 'SYMPTOM', term: query };
    if (SOURCE.test(query) || FOLLOWUP.test(query)) return { intent: 'SOURCE', term: query };
    if (SEARCH.test(query)) {
      const decision = await this.existing.classify(query);
      if (!decision.term) return { intent: 'HELP', term: null };
      return { intent: decision.intent === 'COMPARACION' ? 'PUBLIC_COMPARE' : 'PUBLIC_SEARCH', term: decision.term };
    }
    return { intent: 'HELP', term: null };
  }
}
