import type { AssistantMetric, AssistantMetrics } from '../application/ports.js';

export class InMemoryAssistantMetrics implements AssistantMetrics {
  readonly counts = { success: 0, clinical_refusal: 0, provider_error: 0, source_error: 0 };
  readonly durations: number[] = [];
  readonly intents = new Map<string,number>(); readonly toolCounts = new Map<number,number>();
  record(metric: AssistantMetric): void { this.counts[metric.event] += 1; this.durations.push(metric.durationMs);this.intents.set(metric.intent,(this.intents.get(metric.intent)??0)+1);this.toolCounts.set(metric.toolCount,(this.toolCounts.get(metric.toolCount)??0)+1); }
  snapshot() { return { counts: { ...this.counts }, samples: this.durations.length, intents:Object.fromEntries(this.intents), toolCounts:Object.fromEntries(this.toolCounts) }; }
}
