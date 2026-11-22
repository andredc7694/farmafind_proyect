import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import { json, Router, type NextFunction, type Request, type Response } from 'express';
import { ConversationRequestError, parseConversationRequest, parseDiscardRequest,
  type ConversationRequest, type ConversationResponse } from '../domain/conversation-contract.js';
import { InMemoryAssistantRateLimit, type AssistantRateLimit } from './rate-limit.js';

export interface ConversationService {
  execute(request: ConversationRequest, origin: string, correlationId: string): Promise<ConversationResponse>;
  discard(origin: string, id: string): void;
}

function fail(response: Response, status: number, code: string, message: string, correlationId: string) {
  return response.status(status).json({ code, message, correlationId });
}

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
      return response.status(200).json(await service.execute(parseConversationRequest(request.body), originKey(request), correlationId));
    } catch (error) {
      if (error instanceof ConversationRequestError) {
        return fail(response, error.code === 'INVALID_REQUEST' ? 400 : 422, error.code, error.message, correlationId);
      }
      return fail(response, 503, 'CONVERSATION_UNAVAILABLE', 'El asistente no está disponible temporalmente.', correlationId);
    }
  });
  router.post('/asistente/conversaciones/descartar', (request, response) => {
    const correlationId = randomUUID();
    try {
      service.discard(originKey(request), parseDiscardRequest(request.body));
      return response.status(204).end();
    } catch (error) {
      if (error instanceof ConversationRequestError) return fail(response, 400, error.code, error.message, correlationId);
      return fail(response, 503, 'CONVERSATION_UNAVAILABLE', 'El asistente no está disponible temporalmente.', correlationId);
    }
  });
  router.use((error: unknown, _request: Request, response: Response, next: NextFunction) => {
    const candidate = error as { type?: string };
    if (candidate?.type === 'entity.too.large') return fail(response, 413, 'PAYLOAD_TOO_LARGE', 'El cuerpo supera el límite permitido.', randomUUID());
    if (error instanceof SyntaxError) return fail(response, 400, 'INVALID_JSON', 'El cuerpo JSON no es válido.', randomUUID());
    next(error);
  });
  return router;
}
