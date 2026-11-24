import { Router, json } from 'express';
import type { NextFunction, Request, Response } from 'express';
import type { AuthHttpOptions } from './auth-middleware.js';
import { authHttpSecurity, localClientIp, readSessionCookie, sendIdentityError } from './auth-middleware.js';
import { InvalidSessionStateError, RateLimitedError } from '../application/ports.js';
import type { SessionView } from '../application/identity-use-cases.js';

interface IdentityEndpoints {
  register(email: unknown, password: unknown, ip: string): Promise<void>;
  login(identifier: unknown, password: unknown, ip: string): Promise<{ secret: string; view: SessionView }>;
  changeTemporaryPassword?(secret: string, newPassword: unknown): Promise<void>;
  session(secret: string): Promise<SessionView>;
  logout(secret: string): Promise<void>;
}

/** F01.1: acepta «identifier» (alias o correo) o el campo histórico «email»; nunca ambos ni campos extra. */
function bodyCredentials(body: unknown): { email: unknown; password: unknown } {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) return { email: undefined, password: undefined };
  const input = body as Record<string, unknown>;
  if (Object.keys(input).some(key => !['email', 'identifier', 'password'].includes(key)) ||
      (Object.hasOwn(input, 'email') && Object.hasOwn(input, 'identifier'))) return { email: undefined, password: undefined };
  return { email: input.identifier ?? input.email, password: input.password };
}

function handleError(error: unknown, response: import('express').Response): void {
  if (error instanceof RateLimitedError) {
    response.set('Retry-After', String(error.retryAfterSeconds));
    sendIdentityError(response, 429, 'RATE_LIMITED', 'Solicitud limitada. Inténtalo más tarde.');
  } else if (error instanceof Error && error.message === 'Entrada inválida') {
    sendIdentityError(response, 400, 'BAD_REQUEST', 'Entrada inválida');
  } else if (error instanceof InvalidSessionStateError) {
    sendIdentityError(response, 403, 'FORBIDDEN', 'Permiso insuficiente');
  } else if (error instanceof Error && error.message === 'Credenciales inválidas') {
    sendIdentityError(response, 401, 'UNAUTHENTICATED', 'Credenciales inválidas');
  } else if (error instanceof Error && error.message === 'No autorizado') {
    sendIdentityError(response, 401, 'UNAUTHENTICATED', 'Sesión no válida');
  } else {
    sendIdentityError(response, 500, 'INTERNAL', 'No se pudo completar la solicitud');
  }
}

interface RecoveryEndpoints {
  requestPasswordReset(email: unknown, ip: string): Promise<void>;
  confirmPasswordReset(token: unknown, newPassword: unknown, ip: string): Promise<void>;
  verifyEmail(token: unknown, ip: string): Promise<void>;
  requestEmailVerification(secret: string): Promise<void>;
}

function exactKeys(body: unknown, keys: readonly string[]): body is Record<string, unknown> {
  return body !== null && typeof body === 'object' && !Array.isArray(body) &&
    Object.keys(body).length === keys.length && keys.every(key => Object.hasOwn(body, key));
}

/** Mounted only when F01 identity composition provides real scoped dependencies. */
export function createIdentityRouter(identity: IdentityEndpoints, options: AuthHttpOptions,
  recovery?: RecoveryEndpoints): Router {
  const router = Router();
  const security = authHttpSecurity(options);
  router.use((request, response, next) => {
    response.set('Cache-Control', 'no-store');
    next();
  });
  router.use(json({ limit: '8kb' }));
  router.use((_error: unknown, _request: Request, response: Response, _next: NextFunction) => {
    sendIdentityError(response, 400, 'BAD_REQUEST', 'Entrada no valida');
  });
  router.get('/auth/csrf', security.issueCsrf);
  router.post('/auth/register', security.requireCsrf, async (request, response) => {
    try {
      const { email, password } = bodyCredentials(request.body);
      await identity.register(email, password, localClientIp(request));
      response.status(202).end();
    } catch (error) { handleError(error, response); }
  });
  router.post('/auth/login', security.requireCsrf, async (request, response) => {
    try {
      const { email, password } = bodyCredentials(request.body);
      const result = await identity.login(email, password, localClientIp(request));
      security.setSession(response, result.secret);
      response.status(200).json(result.view);
    } catch (error) { handleError(error, response); }
  });
  router.post('/auth/password/change-temporary', security.requireCsrf, async (request, response) => {
    const secret = readSessionCookie(request, options);
    if (!secret) { sendIdentityError(response, 401, 'UNAUTHENTICATED', 'Sesión no válida'); return; }
    const body = request.body as unknown;
    if (!identity.changeTemporaryPassword || body === null || typeof body !== 'object' || Array.isArray(body) ||
        Object.keys(body).length !== 1 || !Object.hasOwn(body, 'newPassword')) {
      sendIdentityError(response, 400, 'BAD_REQUEST', 'Entrada inválida'); return;
    }
    try {
      await identity.changeTemporaryPassword(secret, (body as Record<string, unknown>).newPassword);
      response.status(204).end();
    } catch (error) { handleError(error, response); }
  });
  if (recovery) {
    // Respuesta 202 siempre igual, exista o no la cuenta (F011-FR-010, SC-007).
    router.post('/auth/password/reset/request', security.requireCsrf, async (request, response) => {
      if (!exactKeys(request.body, ['email'])) { sendIdentityError(response, 400, 'BAD_REQUEST', 'Entrada inválida'); return; }
      try { await recovery.requestPasswordReset(request.body.email, localClientIp(request)); response.status(202).end(); }
      catch (error) { handleError(error, response); }
    });
    router.post('/auth/password/reset/confirm', security.requireCsrf, async (request, response) => {
      if (!exactKeys(request.body, ['token', 'newPassword'])) { sendIdentityError(response, 400, 'BAD_REQUEST', 'Entrada inválida'); return; }
      try {
        await recovery.confirmPasswordReset(request.body.token, request.body.newPassword, localClientIp(request));
        security.clearSession(response);
        response.status(204).end();
      } catch (error) { handleError(error, response); }
    });
    router.post('/auth/email/verify', security.requireCsrf, async (request, response) => {
      if (!exactKeys(request.body, ['token'])) { sendIdentityError(response, 400, 'BAD_REQUEST', 'Entrada inválida'); return; }
      try { await recovery.verifyEmail(request.body.token, localClientIp(request)); response.status(204).end(); }
      catch (error) { handleError(error, response); }
    });
    router.post('/me/email/verification', security.requireCsrf, async (request, response) => {
      const secret = readSessionCookie(request, options);
      if (!secret) { sendIdentityError(response, 401, 'UNAUTHENTICATED', 'Sesión no válida'); return; }
      try { await recovery.requestEmailVerification(secret); response.status(202).end(); }
      catch (error) { handleError(error, response); }
    });
  }
  router.get('/auth/session', async (request, response) => {
    const secret = readSessionCookie(request, options);
    if (!secret) { sendIdentityError(response, 401, 'UNAUTHENTICATED', 'Sesión no válida'); return; }
    try { response.status(200).json(await identity.session(secret)); }
    catch (error) { handleError(error, response); }
  });
  router.post('/auth/logout', security.requireCsrf, async (request, response) => {
    const secret = readSessionCookie(request, options);
    if (!secret) { sendIdentityError(response, 401, 'UNAUTHENTICATED', 'Sesión no válida'); return; }
    try {
      await identity.logout(secret);
      security.clearSession(response);
      response.status(204).end();
    } catch (error) { handleError(error, response); }
  });
  return router;
}
