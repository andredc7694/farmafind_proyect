import type { SearchMetrics } from '../application/ports.js';
type Event = 'hit' | 'miss' | 'fallback' | 'invalid';
export class InMemorySearchMetrics implements SearchMetrics {
  private readonly counters: Record<Event,number>={hit:0,miss:0,fallback:0,invalid:0};
  record(event: Event): void { this.counters[event] += 1; }
  snapshot(): Readonly<Record<Event,number>> { return {...this.counters}; }
}
