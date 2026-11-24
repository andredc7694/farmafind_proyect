import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import type { SuggestPublicOffers } from '../application/suggest-public.js';
import { PublicQueryError } from '../contracts/public-search.js';
import { InMemoryPublicRateLimit, type PublicRateLimit } from './public-rate-limit.js';

const body = (code: string, message: string, correlationId: string) => ({ code, message, correlationId });

/** F08.1: sugerencias públicas. Misma política de límite que la búsqueda; respuestas sin caché del navegador. */
export function createPublicSuggestRouter(suggest: SuggestPublicOffers, rateLimit: PublicRateLimit = new InMemoryPublicRateLimit(120)): Router {
  const router = Router();
  router.get('/busquedas/sugerencias', async (request, response) => {
    const correlationId = randomUUID();
    response.set('Cache-Control', 'no-store');
    const limit = rateLimit.allow(request.ip || 'local');
    if (!limit.allowed) return response.status(429).set('Retry-After', String(limit.retryAfter))
      .json(body('RATE_LIMITED', 'Demasiadas consultas; intenta nuevamente.', correlationId));
    const keys = Object.keys(request.query);
    if (keys.length !== 1 || keys[0] !== 'q' || typeof request.query.q !== 'string') return response.status(400).json(body('INVALID_QUERY', 'Consulta inválida', correlationId));
    try { return response.json(await suggest.execute(request.query.q)); }
    catch (error) {
      if (error instanceof PublicQueryError) return response.status(400).json(body(error.code, error.message, correlationId));
      return response.status(503).json(body('SOURCE_UNAVAILABLE', 'Las sugerencias no están disponibles temporalmente.', correlationId));
    }
  });
  return router;
}
