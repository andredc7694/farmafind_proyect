import { Router, json } from 'express';
import type { NextFunction, Request, Response } from 'express';
import type { AuthHttpOptions } from './auth-middleware.js';
import { authHttpSecurity, readSessionCookie, sendIdentityError } from './auth-middleware.js';
import { RateLimitedError } from '../application/ports.js';
import { MfaConflictError, MfaForbiddenError, MfaInvalidCodeError } from '../application/mfa.js';
import type { MfaEnrollment } from '../application/mfa.js';

interface MfaEndpoints {
  enroll(secret: string): Promise<MfaEnrollment>;
  activate(secret: string, code: unknown): Promise<void>;
  verify(secret: string, code: unknown): Promise<void>;
}

function failure(error: unknown, response: Response): void {
  if (error instanceof RateLimitedError) {
    response.set('Retry-After', String(error.retryAfterSeconds));
    sendIdentityError(response, 429, 'RATE_LIMITED', 'Solicitud limitada. Inténtalo más tarde.');
  } else if (error instanceof MfaForbiddenError) sendIdentityError(response, 403, 'FORBIDDEN', 'Permiso insuficiente');
  else if (error instanceof MfaConflictError) sendIdentityError(response, 409, 'CONFLICT', 'Operación no disponible');
  else if (error instanceof MfaInvalidCodeError) sendIdentityError(response, 401, 'UNAUTHENTICATED', 'Código no válido');
  else if (error instanceof Error && error.message === 'No autorizado') sendIdentityError(response, 401, 'UNAUTHENTICATED', 'Sesión no válida');
  else sendIdentityError(response, 500, 'INTERNAL', 'No se pudo completar la solicitud');
}

/** F011-FR-012: rutas del segundo factor. Autoriza el servidor (función SQL); la interfaz no concede nada. */
export function createMfaRouter(mfa: MfaEndpoints, options: AuthHttpOptions): Router {
  const router = Router();
  const security = authHttpSecurity(options);
  router.use((_request, response, next) => { response.set('Cache-Control', 'no-store'); next(); });
  router.use(json({ limit: '1kb' }));
  router.use((_error: unknown, _request: Request, response: Response, _next: NextFunction) =>
    sendIdentityError(response, 400, 'BAD_REQUEST', 'Entrada inválida'));

  function sessionSecret(request: Request, response: Response): string | null {
    const secret = readSessionCookie(request, options);
    if (!secret) sendIdentityError(response, 401, 'UNAUTHENTICATED', 'Sesión no válida');
    return secret ?? null;
  }
  const codeBody = (body: unknown): { code: unknown } | null =>
    body !== null && typeof body === 'object' && !Array.isArray(body) && Object.keys(body).length === 1 &&
    Object.hasOwn(body, 'code') ? { code: (body as Record<string, unknown>).code } : null;

  router.post('/me/mfa/enroll', security.requireCsrf, async (request, response) => {
    const secret = sessionSecret(request, response); if (!secret) return;
    try { response.status(201).json(await mfa.enroll(secret)); } catch (error) { failure(error, response); }
  });
  router.post('/me/mfa/activate', security.requireCsrf, async (request, response) => {
    const secret = sessionSecret(request, response); if (!secret) return;
    const body = codeBody(request.body);
    if (!body) { sendIdentityError(response, 400, 'BAD_REQUEST', 'Entrada inválida'); return; }
    try { await mfa.activate(secret, body.code); response.status(204).end(); } catch (error) { failure(error, response); }
  });
  router.post('/auth/mfa/verify', security.requireCsrf, async (request, response) => {
    const secret = sessionSecret(request, response); if (!secret) return;
    const body = codeBody(request.body);
    if (!body) { sendIdentityError(response, 400, 'BAD_REQUEST', 'Entrada inválida'); return; }
    try { await mfa.verify(secret, body.code); response.status(204).end(); } catch (error) { failure(error, response); }
  });
  return router;
}
