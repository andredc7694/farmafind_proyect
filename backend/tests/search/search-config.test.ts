import { describe, expect, it } from 'vitest';
import { loadSearchConfig } from '../../src/config/search.js';

describe('configuración local F03', () => {
  it('acepta Redis autenticado en loopback y valores acotados', () => {
    expect(loadSearchConfig({ SEARCH_REDIS_URL: 'redis://:ficticia@127.0.0.1:56379' })).toMatchObject({
      cacheTtlSeconds: 60, cacheTimeoutMs: 150, candidateLimit: 200,
    });
  });
  it('rechaza Redis remoto, sin contraseña y límites inseguros', () => {
    expect(() => loadSearchConfig({ SEARCH_REDIS_URL: 'redis://remote.invalid:6379' })).toThrow();
    expect(() => loadSearchConfig({ SEARCH_REDIS_URL: 'redis://127.0.0.1:56379' })).toThrow();
    expect(() => loadSearchConfig({ SEARCH_REDIS_URL: 'redis://:x@127.0.0.1:56379', SEARCH_CANDIDATE_LIMIT: '201' })).toThrow();
  });
});
