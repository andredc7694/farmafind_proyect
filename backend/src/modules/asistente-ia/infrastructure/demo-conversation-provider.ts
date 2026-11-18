import type { ConversationProvider } from '../application/conversation-ports.js';
import { MockConversationProvider } from './mock-conversation-provider.js';

/** F06.1 TEST/DEMO has no external-provider activation path. */
export function selectDemoConversationProvider(requested: string | undefined): {
  readonly provider: ConversationProvider;
  readonly externalSelectionRejected: boolean;
} {
  const externalSelectionRejected = requested !== undefined && requested !== '' && requested !== 'mock';
  return { provider: new MockConversationProvider(), externalSelectionRejected };
}
