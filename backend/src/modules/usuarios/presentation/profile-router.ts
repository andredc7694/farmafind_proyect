import { Router, json } from 'express';
import type { NextFunction, Request, Response } from 'express';
import type { AuthHttpOptions } from './auth-middleware.js';
import { authHttpSecurity, readSessionCookie, sendIdentityError } from './auth-middleware.js';
import { RateLimitedError } from '../application/ports.js';
import type { OwnProfile, OwnSession } from '../application/ports.js';
import { OwnSessionNotFoundError, ReauthenticationError } from '../application/profile.js';

interface ProfileEndpoints {
  getProfile(secret: string): Promise<OwnProfile>;
  updateProfile(secret: string, input: unknown): Promise<OwnProfile>;
  requestEmailChange(secret: string, newEmail: unknown, currentPassword: unknown): Promise<void>;
  changePassword(secret: string, currentPassword: unknown, newPassword: unknown): Promise<void>;
  listSessions(secret: string): Promise<readonly OwnSession[]>;
  revokeSession(secret: string, sessionId: unknown): Promise<void>;
  revokeOtherSessions(secret: string): Promise<void>;
}

const exactKeys = (body: unknown, keys: readonly string[]): body is Record<string, unknown> =>
  body !== null && typeof body === 'object' && !Array.isArray(body) && Object.keys(body).length === keys.length &&
  keys.every(key => Object.hasOwn(body, key));

function failure(error: unknown, response: Response): void {
  const code = (error as { code?: string }).code;
  if (error instanceof RateLimitedError) {
    response.set('Retry-After', String(error.retryAfterSeconds));
    sendIdentityError(response, 429, 'RATE_LIMITED', 'Solicitud limitada. Inténtalo más tarde.');
  } else if (error instanceof ReauthenticationError) sendIdentityError(response, 401, 'UNAUTHENTICATED', 'La clave actual no es correcta');
  else if (error instanceof OwnSessionNotFoundError || code === 'F0404') sendIdentityError(response, 404, 'NOT_FOUND', 'No encontrado');
  else if (error instanceof Error && error.message === 'Entrada inválida' || code === '22023' || code === '23514' || code === '22P02' || code === '22003') {
    sendIdentityError(response, 400, 'BAD_REQUEST', 'Entrada inválida');
  } else if (error instanceof Error && error.message === 'No autorizado' || code === '42501') {
    sendIdentityError(response, 401, 'UNAUTHENTICATED', 'Sesión no válida');
  } else sendIdentityError(response, 500, 'INTERNAL', 'No se pudo completar la solicitud');
}

const profileBody = (profile: OwnProfile) => profile;
const sessionBody = (item: OwnSession) => ({ id: item.id, createdAt: item.createdAt.toISOString(),
  lastUsedAt: item.lastUsedAt.toISOString(), current: item.current });

/** F011-FR-013/014: rutas del propio perfil. Nada aquí acepta roles, membresías ni permisos. */
export function createProfileRouter(profile: ProfileEndpoints, options: AuthHttpOptions): Router {
  const router = Router();
  const security = authHttpSecurity(options);
  router.use((_request, response, next) => { response.set('Cache-Control', 'no-store'); next(); });
  router.use(json({ limit: '4kb' }));
  router.use((_error: unknown, _request: Request, response: Response, _next: NextFunction) =>
    sendIdentityError(response, 400, 'BAD_REQUEST', 'Entrada inválida'));

  const secretOf = (request: Request, response: Response): string | null => {
    const secret = readSessionCookie(request, options);
    if (!secret) sendIdentityError(response, 401, 'UNAUTHENTICATED', 'Sesión no válida');
    return secret ?? null;
  };

  router.get('/me/profile', async (request, response) => {
    const secret = secretOf(request, response); if (!secret) return;
    try { response.status(200).json(profileBody(await profile.getProfile(secret))); } catch (error) { failure(error, response); }
  });
  router.patch('/me/profile', security.requireCsrf, async (request, response) => {
    const secret = secretOf(request, response); if (!secret) return;
    try { response.status(200).json(profileBody(await profile.updateProfile(secret, request.body))); } catch (error) { failure(error, response); }
  });
  router.post('/me/email/change', security.requireCsrf, async (request, response) => {
    const secret = secretOf(request, response); if (!secret) return;
    if (!exactKeys(request.body, ['newEmail', 'currentPassword'])) { sendIdentityError(response, 400, 'BAD_REQUEST', 'Entrada inválida'); return; }
    try { await profile.requestEmailChange(secret, request.body.newEmail, request.body.currentPassword); response.status(202).end(); }
    catch (error) { failure(error, response); }
  });
  router.post('/me/password', security.requireCsrf, async (request, response) => {
    const secret = secretOf(request, response); if (!secret) return;
    if (!exactKeys(request.body, ['currentPassword', 'newPassword'])) { sendIdentityError(response, 400, 'BAD_REQUEST', 'Entrada inválida'); return; }
    try { await profile.changePassword(secret, request.body.currentPassword, request.body.newPassword); response.status(204).end(); }
    catch (error) { failure(error, response); }
  });
  router.get('/me/sessions', async (request, response) => {
    const secret = secretOf(request, response); if (!secret) return;
    try { response.status(200).json((await profile.listSessions(secret)).map(sessionBody)); } catch (error) { failure(error, response); }
  });
  // «revoke-others» se registra antes que «:sessionId» para que no se tome como identificador.
  router.post('/me/sessions/revoke-others', security.requireCsrf, async (request, response) => {
    const secret = secretOf(request, response); if (!secret) return;
    try { await profile.revokeOtherSessions(secret); response.status(204).end(); } catch (error) { failure(error, response); }
  });
  router.delete('/me/sessions/:sessionId', security.requireCsrf, async (request, response) => {
    const secret = secretOf(request, response); if (!secret) return;
    try { await profile.revokeSession(secret, request.params.sessionId); response.status(204).end(); } catch (error) { failure(error, response); }
  });
  return router;
}
