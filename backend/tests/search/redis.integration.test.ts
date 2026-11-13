import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createClient } from 'redis';
import { RedisSearchCache } from '../../src/modules/busqueda/infrastructure/redis-search-cache.js';
import { RedisSearchInvalidator } from '../../src/modules/busqueda/infrastructure/search-invalidator.js';

const url = process.env.SEARCH_REDIS_URL;
const group = url ? describe : describe.skip;
group('Redis real F03', () => {
  const client = createClient({ url });
  beforeAll(async () => { client.on('error', () => undefined); await client.connect();
    for (const key of await client.keys('farmafind:f03:v1:*')) await client.del(key); });
  afterAll(async () => { if (client.isOpen) { for (const key of await client.keys('farmafind:f03:v1:*')) await client.del(key); await client.quit(); } });
  it('guarda payload público con TTL y lo expira', async () => {
    const cache = new RedisSearchCache(client, 500);
    await cache.set('farmafind:f03:v1:g0:search:test','{"ofertas":[]}',1);
    expect(await cache.get('farmafind:f03:v1:g0:search:test')).toBe('{"ofertas":[]}');
    expect(await client.ttl('farmafind:f03:v1:g0:search:test')).toBeGreaterThan(0);
    await new Promise(resolve => setTimeout(resolve,1100));
    expect(await cache.get('farmafind:f03:v1:g0:search:test')).toBeNull();
  });
  it('incrementa generación sin escanear ni borrar claves', async () => {
    const invalidator = new RedisSearchInvalidator(client);
    await invalidator.invalidate(); await invalidator.invalidate();
    expect(await new RedisSearchCache(client,500).generation()).toBe('2');
  });
  it('reconecta el cliente tras una desconexión controlada', async () => {
    await client.quit();
    expect(await new RedisSearchCache(client,500).generation()).toBe('2');
  });
});
