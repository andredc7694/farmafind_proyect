import type { ConversationDecision, ConversationProvider } from '../application/conversation-ports.js';

/** Future-only failover. Runtime still composes the deterministic mock directly. */
export class FallbackConversationProvider implements ConversationProvider {
  constructor(private readonly primary: ConversationProvider, private readonly fallback: ConversationProvider) {}

  async classify(query: string): Promise<ConversationDecision> {
    try {
      const decision = await this.primary.classify(query);
      if (!decision || !['SOURCE', 'PUBLIC_SEARCH', 'PUBLIC_COMPARE', 'SYMPTOM', 'HELP'].includes(decision.intent) ||
          (decision.term !== null && (typeof decision.term !== 'string' || decision.term.length > 500))) {
        throw new Error('Decisión externa inválida');
      }
      return decision;
    } catch {
      return this.fallback.classify(query);
    }
  }
}
