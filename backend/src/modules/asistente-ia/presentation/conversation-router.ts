import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import { json, Router, type NextFunction, type Request, type Response } from 'express';
import { ConversationRequestError, parseConversationRequest,
  type ConversationRequest, type ConversationResponse } from '../domain/conversation-contract.js';
import { InMemoryAssistantRateLimit, type AssistantRateLimit } from './rate-limit.js';

export interface ConversationService {
  execute(request: ConversationRequest, correlationId: string): Promise<ConversationResponse>;
}

function fail(response: Response, status: number, code: string, message: string, correlationId: string) {
  return response.status(status).json({ code, message, correlationId });
}

/**
 * F06.2: la conversación no se guarda en el servidor (D-01 A). El contexto que trae la petición se valida y se usa
 * solo para responder; nunca se escribe en registros (condición de Andre, 2026-11-27).
 */
export function createConversationRouter(service: ConversationService,
  limit: AssistantRateLimit = new InMemoryAssistantRateLimit()): Router {
  const router = Router();
  const originSecret = randomBytes(32);
  const originKey = (request: Request) => createHmac('sha256', originSecret).update(request.ip || 'local').digest('hex');
  router.use('/asistente/conversaciones', (request, response, next) => {
    response.set('Cache-Control', 'no-store');
    const result = limit.allow(originKey(request));
    if (!result.allowed) return fail(response.set('Retry-After', String(result.retryAfter)), 429,
      'RATE_LIMITED', 'Demasiadas consultas; intenta nuevamente.', randomUUID());
    next();
  });
  router.use(json({ limit: '4kb', strict: true }));
  router.post('/asistente/conversaciones', async (request, response) => {
    const correlationId = randomUUID();
    try {
      return response.status(200).json(await service.execute(parseConversationRequest(request.body), correlationId));
    } catch (error) {
      if (error instanceof ConversationRequestError) return fail(response, 400, error.code, error.message, correlationId);
      return fail(response, 503, 'CONVERSATION_UNAVAILABLE', 'El asistente no está disponible temporalmente.', correlationId);
    }
  });
  // Compatibilidad con F06.1: no hay nada que borrar en el servidor.
  router.post('/asistente/conversaciones/descartar', (_request, response) => response.status(204).end());
  router.use((error: unknown, _request: Request, response: Response, next: NextFunction) => {
    const candidate = error as { type?: string };
    if (candidate?.type === 'entity.too.large') return fail(response, 413, 'PAYLOAD_TOO_LARGE', 'El cuerpo supera el límite permitido.', randomUUID());
    if (error instanceof SyntaxError) return fail(response, 400, 'INVALID_JSON', 'El cuerpo JSON no es válido.', randomUUID());
    next(error);
  });
  return router;
}
