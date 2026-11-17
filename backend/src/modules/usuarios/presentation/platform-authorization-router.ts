import { Router, json } from 'express';
import type { NextFunction, Request, Response } from 'express';
import type { AuthHttpOptions } from './auth-middleware.js';
import { authHttpSecurity, readSessionCookie, sendIdentityError } from './auth-middleware.js';
import { PlatformAuthorizationConflictError, PlatformAuthorizationForbiddenError } from
  '../application/manage-platform-authorizations.js';
import type { PlatformAssignment } from '../application/manage-platform-authorizations.js';

interface LiveSession { session(secret: string): Promise<{ userId: string }> }
interface Management {
  list(secret: string): Promise<readonly PlatformAssignment[]>;
  grant(secret: string, actor: string, target: string, role: string, approval: string): Promise<PlatformAssignment>;
  revoke(secret: string, actor: string, assignment: string, approval: string): Promise<PlatformAssignment>;
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const exact = (value: unknown, keys: readonly string[]): value is Record<string, unknown> => value !== null &&
  typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === keys.length &&
  keys.every(key => Object.hasOwn(value, key));

export function createPlatformAuthorizationRouter(identity: LiveSession, management: Management,
  options: AuthHttpOptions): Router {
  const router = Router();
  const security = authHttpSecurity(options);
  router.use(json({ limit: '8kb' }));
  router.use((_error: unknown, _request: Request, response: Response, _next: NextFunction) =>
    sendIdentityError(response, 400, 'BAD_REQUEST', 'Entrada no valida'));

  async function actor(request: Request, response: Response) {
    const secret = readSessionCookie(request, options);
    if (!secret) { sendIdentityError(response, 401, 'UNAUTHENTICATED', 'Sesion no valida'); return null; }
    try {
      const session = await identity.session(secret);
      if (!uuid.test(session.userId)) throw new Error();
      return { secret, userId: session.userId };
    } catch { sendIdentityError(response, 401, 'UNAUTHENTICATED', 'Sesion no valida'); return null; }
  }
  function failure(error: unknown, response: Response) {
    if (error instanceof PlatformAuthorizationForbiddenError || (error as { code?: string }).code === '42501')
      sendIdentityError(response, 403, 'FORBIDDEN', 'Permiso insuficiente');
    else if (error instanceof PlatformAuthorizationConflictError || ['23505','23514'].includes((error as { code?: string }).code ?? ''))
      sendIdentityError(response, 409, 'CONFLICT', 'Operacion no disponible');
    else sendIdentityError(response, 500, 'INTERNAL', 'No se pudo completar la solicitud');
  }

  router.get('/platform/role-assignments', async (request, response) => {
    const current = await actor(request,response); if (!current) return;
    try { response.status(200).json(await management.list(current.secret)); } catch (error) { failure(error,response); }
  });
  router.post('/platform/role-assignments', security.requireCsrf, async (request,response) => {
    const current = await actor(request,response); if (!current) return;
    if (!exact(request.body,['userId','role','approvalId']) || !uuid.test(String(request.body.userId)) ||
        request.body.role !== 'ADMINISTRADOR_PLATAFORMA' || !uuid.test(String(request.body.approvalId))) {
      sendIdentityError(response,400,'BAD_REQUEST','Entrada no valida'); return;
    }
    if (request.body.userId === current.userId) {
      sendIdentityError(response,403,'FORBIDDEN','Permiso insuficiente'); return;
    }
    try { response.status(201).json(await management.grant(current.secret,current.userId,String(request.body.userId),
      'ADMINISTRADOR_PLATAFORMA',String(request.body.approvalId))); } catch (error) { failure(error,response); }
  });
  router.patch('/platform/role-assignments/:assignmentId', security.requireCsrf, async (request,response) => {
    const current = await actor(request,response); if (!current) return;
    if (!uuid.test(String(request.params.assignmentId)) || !exact(request.body,['status','approvalId']) ||
        request.body.status !== 'REVOCADA' || !uuid.test(String(request.body.approvalId))) {
      sendIdentityError(response,400,'BAD_REQUEST','Entrada no valida'); return;
    }
    try { response.status(200).json(await management.revoke(current.secret,current.userId,
      String(request.params.assignmentId),String(request.body.approvalId)));
    } catch (error) { failure(error,response); }
  });
  return router;
}
