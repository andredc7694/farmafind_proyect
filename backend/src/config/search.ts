export interface SearchRuntimeConfig {
  readonly redisUrl: string;
  readonly cacheTtlSeconds: number;
  readonly cacheTimeoutMs: number;
  readonly candidateLimit: number;
}

function integer(value: string | undefined, fallback: number, minimum: number, maximum: number, name: string): number {
  const parsed = value === undefined ? fallback : Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`F03: ${name} inválido`);
  }
  return parsed;
}

/** Load local F03 settings without accepting remote or unauthenticated Redis. */
export function loadSearchConfig(env: NodeJS.ProcessEnv): SearchRuntimeConfig {
  const raw = env.SEARCH_REDIS_URL;
  if (!raw) throw new Error('F03: SEARCH_REDIS_URL requerido');
  const url = new URL(raw);
  if (url.protocol !== 'redis:' || url.hostname !== '127.0.0.1' || url.port !== '56379' || !url.password) {
    throw new Error('F03: Redis local debe usar autenticación y loopback 127.0.0.1:56379');
  }
  return {
    redisUrl: raw,
    cacheTtlSeconds: integer(env.SEARCH_CACHE_TTL_SECONDS, 60, 1, 3600, 'TTL'),
    cacheTimeoutMs: integer(env.SEARCH_CACHE_TIMEOUT_MS, 150, 25, 5000, 'timeout'),
    candidateLimit: integer(env.SEARCH_CANDIDATE_LIMIT, 200, 1, 200, 'límite de candidatos'),
  };
}
