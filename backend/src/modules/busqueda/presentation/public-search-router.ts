import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import type { SearchPublicOffers } from '../application/search-public-offers.js';
import { PublicQueryError } from '../contracts/public-search.js';
import { parsePublicQuery } from '../domain/public-query.js';
import { InMemoryPublicRateLimit, type PublicRateLimit } from './public-rate-limit.js';

function errorBody(code: string, message: string, correlationId: string) { return { code, message, correlationId }; }

export function createPublicSearchRouter(search: SearchPublicOffers, rateLimit: PublicRateLimit = new InMemoryPublicRateLimit()): Router {
  const router = Router();
  router.get('/busquedas', async (request, response) => {
    const correlationId = randomUUID();
    const limit = rateLimit.allow(request.ip || 'local');
    if (!limit.allowed) return response.status(429).set('Retry-After', String(limit.retryAfter))
      .json(errorBody('RATE_LIMITED', 'Demasiadas consultas; intenta nuevamente.', correlationId));
    try {
      return response.json(await search.execute(parsePublicQuery(request.query as Record<string, unknown>)));
    } catch (error) {
      if (error instanceof PublicQueryError) return response.status(error.code === 'INCOMPATIBLE_PARAMETERS' ? 422 : 400)
        .json(errorBody(error.code, error.message, correlationId));
      return response.status(503).json(errorBody('SOURCE_UNAVAILABLE', 'La búsqueda no está disponible temporalmente.', correlationId));
    }
  });
  return router;
}
