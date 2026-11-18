import type { PublicKnowledgeTools } from './ports.js';

export interface ConversationContext {
  readonly id: string;
  readonly referent: string | null;
  readonly turns: number;
  readonly expiresAt: number;
}

export interface ConversationStore {
  create(origin: string, referent: string | null): ConversationContext;
  get(origin: string, id: string): ConversationContext;
  advance(origin: string, id: string, referent: string | null): ConversationContext;
  discard(origin: string, id: string): void;
}

export interface ReviewedSource {
  readonly authority: string;
  readonly jurisdiction: string;
  readonly reference: string;
  readonly title: string;
  readonly version: string;
  readonly reviewedAt: string;
  readonly validUntil: string;
  readonly reusePermission: string;
  readonly professionalReviewer: string;
  readonly approvedForTest: boolean;
  readonly productName: string;
  readonly educationalStatement: string;
  readonly educationalWarning?: string;
  readonly categoryKey?: string;
}

export interface ReviewedSourceCatalog {
  lookup(term: string, now: Date): ReviewedSource | null;
}

export type ConversationIntent = 'SOURCE' | 'PUBLIC_SEARCH' | 'PUBLIC_COMPARE' | 'SYMPTOM' | 'HELP';
export interface ConversationDecision { readonly intent: ConversationIntent; readonly term: string | null; }
export interface ConversationProvider { classify(query: string): Promise<ConversationDecision>; }
export type ConversationPublicTools = PublicKnowledgeTools;
