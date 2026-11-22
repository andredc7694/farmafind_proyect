import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createClient, type RedisClientType } from 'redis';
import { PgPublicOfferRepository } from '../../src/modules/busqueda/infrastructure/public-offer-repository.js';
import { SearchPublicOffers } from '../../src/modules/busqueda/application/search-public-offers.js';
import { RedisSearchCache } from '../../src/modules/busqueda/infrastructure/redis-search-cache.js';
import { RedisSearchInvalidator } from '../../src/modules/busqueda/infrastructure/search-invalidator.js';
import { InMemorySearchMetrics } from '../../src/modules/busqueda/infrastructure/in-memory-search-metrics.js';
import { F03PublicAssistantGateway } from '../../src/modules/busqueda/infrastructure/public-assistant-gateway.js';
import { ConverseAssistant } from '../../src/modules/asistente-ia/application/converse-assistant.js';
import { F03ConversationPublicTools } from '../../src/modules/asistente-ia/infrastructure/conversation-public-tools.js';
import { InMemoryConversationStore } from '../../src/modules/asistente-ia/infrastructure/in-memory-conversation-store.js';
import { InMemoryReviewedSourceCatalog } from '../../src/modules/asistente-ia/infrastructure/reviewed-source-catalog.js';
import { MockConversationProvider } from '../../src/modules/asistente-ia/infrastructure/mock-conversation-provider.js';
import { createConversationRealFixture } from './fixtures/conversation-real-fixture.js';

describe('F06.1 con Redis y fallback PostgreSQL reales', () => {
  let fixture: Awaited<ReturnType<typeof createConversationRealFixture>>;
  let redis: RedisClientType;
  beforeAll(async () => {
    fixture = await createConversationRealFixture();
    const url = process.env.SEARCH_REDIS_URL;
    if (!url || new URL(url).hostname !== '127.0.0.1' || new URL(url).port !== '56379') {
      throw new Error('F06.1: solo Redis TEST local');
    }
    redis = createClient({ url });
    redis.on('error', () => undefined);
    await redis.connect();
  }, 30_000);
  afterAll(async () => {
    if (redis?.isOpen) await redis.quit();
    if (fixture) await fixture.close();
  }, 30_000);

  function assistant(cache: RedisSearchCache, metrics: InMemorySearchMetrics) {
    const repository = new PgPublicOfferRepository(fixture.runtime);
    const search = new SearchPublicOffers(repository, cache, { ttlSeconds: 30, candidateLimit: 200 }, metrics);
    return new ConverseAssistant(new MockConversationProvider(), new InMemoryReviewedSourceCatalog([]),
      new F03ConversationPublicTools(new F03PublicAssistantGateway(search, repository)),
      new InMemoryConversationStore());
  }

  it('con Redis activo observa miss y hit de la misma respuesta pública', async () => {
    const metrics = new InMemorySearchMetrics();
    const service = assistant(new RedisSearchCache(redis, 500), metrics);
    const request = { consulta: `busca ${fixture.product}` };
    const first = await service.execute(request, 'origen-TEST', 'corr-1');
    const second = await service.execute(request, 'origen-TEST', 'corr-2');
    expect(first.fuentes).toHaveLength(2);
    expect(second.fuentes).toEqual(first.fuentes);
    expect(metrics.snapshot().miss).toBe(1);
    expect(metrics.snapshot().hit).toBe(1);
    await new RedisSearchInvalidator(redis).invalidate();
    const afterInvalidation = await service.execute(request, 'origen-TEST', 'corr-4');
    expect(afterInvalidation.fuentes).toEqual(first.fuentes);
    expect(metrics.snapshot().miss).toBe(2);
  });

  it('con Redis inaccesible sigue devolviendo ofertas verificadas desde PostgreSQL', async () => {
    const unavailable = createClient({ url: 'redis://127.0.0.1:56378',
      socket: { connectTimeout: 100, reconnectStrategy: false } });
    unavailable.on('error', () => undefined);
    const metrics = new InMemorySearchMetrics();
    try {
      const service = assistant(new RedisSearchCache(unavailable, 100), metrics);
      const result = await service.execute({ consulta: `compara ${fixture.product}` }, 'origen-TEST', 'corr-3');
      expect(result.estado).toBe('BUSQUEDA_PUBLICA');
      expect(result.fuentes).toHaveLength(2);
      expect(metrics.snapshot().fallback).toBeGreaterThan(0);
    } finally { if (unavailable.isOpen) await unavailable.quit(); }
  });
});
