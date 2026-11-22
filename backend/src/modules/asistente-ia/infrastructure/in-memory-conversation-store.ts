import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import type { ConversationContext, ConversationStore } from '../application/conversation-ports.js';
import { ConversationRequestError } from '../domain/conversation-contract.js';

interface Entry { readonly owner: string; referent: string | null; turns: number; expiresAt: number; }

/** Local TEST/DEMO context: no raw query, IP, clinical text or persistent history. */
export class InMemoryConversationStore implements ConversationStore {
  private readonly entries = new Map<string, Entry>();
  private readonly salt = randomBytes(32);
  constructor(private readonly now: () => number = () => Date.now(),
    private readonly ttlMs = 15 * 60_000, private readonly maxTurns = 6, private readonly capacity = 1000,
    private readonly perOriginCapacity = 20) {}

  private owner(origin: string): string { return createHmac('sha256', this.salt).update(origin).digest('hex'); }
  private snapshot(id: string, entry: Entry): ConversationContext {
    return { id, referent: entry.referent, turns: entry.turns, expiresAt: entry.expiresAt };
  }
  private prune(): void {
    const now = this.now();
    for (const [id, entry] of this.entries) if (entry.expiresAt <= now) this.entries.delete(id);
  }
  create(origin: string, referent: string | null): ConversationContext {
    this.prune();
    const owner = this.owner(origin);
    const owned = [...this.entries].filter(([, entry]) => entry.owner === owner);
    if (owned.length >= this.perOriginCapacity) this.entries.delete(owned[0][0]);
    if (this.entries.size >= this.capacity) {
      const oldest = this.entries.keys().next().value;
      if (oldest) this.entries.delete(oldest);
    }
    const id = randomUUID();
    const entry = { owner, referent, turns: 1, expiresAt: this.now() + this.ttlMs };
    this.entries.set(id, entry);
    return this.snapshot(id, entry);
  }
  get(origin: string, id: string): ConversationContext {
    this.prune();
    const entry = this.entries.get(id);
    if (!entry || entry.owner !== this.owner(origin)) {
      throw new ConversationRequestError('INVALID_CONTEXT', 'La conversación venció o no está disponible. Inicia una nueva.');
    }
    if (entry.turns >= this.maxTurns) {
      throw new ConversationRequestError('LIMIT_REACHED', 'Se alcanzó el límite de contexto. Inicia una nueva conversación.');
    }
    return this.snapshot(id, entry);
  }
  advance(origin: string, id: string, referent: string | null): ConversationContext {
    this.get(origin, id);
    const entry = this.entries.get(id)!;
    entry.turns += 1;
    if (referent) entry.referent = referent;
    entry.expiresAt = this.now() + this.ttlMs;
    return this.snapshot(id, entry);
  }
  discard(origin: string, id: string): void {
    const entry = this.entries.get(id);
    if (entry?.owner === this.owner(origin)) this.entries.delete(id);
  }
}
