import type { ProviderDecision } from '../domain/assistant-contract.js';
import type { PublicPharmacy, PublicSearchResponse } from '../../busqueda/contracts/public-search.js';

export interface AIProvider { classify(query: string): Promise<ProviderDecision>; }
export interface PublicKnowledgeTools {
  search(term: string): Promise<PublicSearchResponse>;
  compare(term: string): Promise<PublicSearchResponse>;
  pharmacy(id: string): Promise<PublicPharmacy | null>;
}
export interface AssistantMetric { readonly event:'success'|'clinical_refusal'|'provider_error'|'source_error'; readonly durationMs:number; readonly intent:string; readonly toolCount:number; }
export interface AssistantMetrics { record(metric: AssistantMetric): void; }
export interface AssistantClock { now(): number; }
export const SYSTEM_CLOCK: AssistantClock = { now: () => Date.now() };
export const NO_ASSISTANT_METRICS: AssistantMetrics = { record: () => undefined };
