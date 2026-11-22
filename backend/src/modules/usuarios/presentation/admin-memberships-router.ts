import { Router, json } from 'express';
import type { NextFunction, Request, Response } from 'express';
import type { AuthHttpOptions } from './auth-middleware.js';
import { authHttpSecurity, readSessionCookie, sendIdentityError } from './auth-middleware.js';
import { MembershipConflictError, MembershipForbiddenError, MembershipNotVisibleError } from '../application/manage-memberships.js';
import type { WorkerMembershipRow } from '../application/ports.js';

interface LiveSession { session(secret: string): Promise<{ userId: string }> }
interface LocalManagement {
  list(secret: string, pharmacyId: string): Promise<readonly WorkerMembershipRow[]>;
  grant(secret: string, pharmacyId: string, userId: string, role: string): Promise<WorkerMembershipRow>;
  revoke(secret: string, pharmacyId: string, membershipId: string): Promise<WorkerMembershipRow>;
}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function exactBody(body: unknown, keys: readonly string[]): body is Record<string, unknown> {
  return body !== null && typeof body === 'object' && !Array.isArray(body) &&
    Object.keys(body).length === keys.length && keys.every(key => Object.hasOwn(body, key));
}

function sendFailure(error: unknown, response: Response): void {
  if (error instanceof MembershipNotVisibleError || (error instanceof Error && error.message === 'No visible')) {
    sendIdentityError(response, 404, 'NOT_VISIBLE', 'Recurso no visible');
  } else if (error instanceof MembershipConflictError || (error instanceof Error && error.message === 'Conflicto')) {
    sendIdentityError(response, 409, 'CONFLICT', 'Operacion no disponible');
  } else if (error instanceof MembershipForbiddenError || (error instanceof Error && error.message === 'Permiso insuficiente')) {
    sendIdentityError(response, 403, 'FORBIDDEN', 'Permiso insuficiente');
  } else if (error instanceof Error && error.message === 'No autorizado') {
    sendIdentityError(response, 401, 'UNAUTHENTICATED', 'Sesion no valida');
  } else {
    sendIdentityError(response, 500, 'INTERNAL', 'No se pudo completar la solicitud');
  }
}

/** Local worker routes only; no global grants, owners or administrators. */
export function createAdminMembershipRouter(identity: LiveSession, management: LocalManagement,
  options: AuthHttpOptions): Router {
  const router = Router();
  const security = authHttpSecurity(options);
  router.use((_request, response, next) => { response.set('Cache-Control', 'no-store'); next(); });
  router.use(json({ limit: '8kb' }));
  router.use((_error: unknown, _request: Request, response: Response, _next: NextFunction) => {
    sendIdentityError(response, 400, 'BAD_REQUEST', 'Entrada no valida');
  });

  async function session(request: Request, response: Response): Promise<{ secret: string; userId: string } | null> {
    const secret = readSessionCookie(request, options);
    if (!secret) { sendIdentityError(response, 401, 'UNAUTHENTICATED', 'Sesion no valida'); return null; }
    try {
      const view = await identity.session(secret);
      if (!uuid.test(view.userId)) throw new Error('No autorizado');
      return { secret, userId: view.userId };
    } catch {
      sendIdentityError(response, 401, 'UNAUTHENTICATED', 'Sesion no valida');
      return null;
    }
  }

  router.get('/pharmacies/:pharmacyId/memberships', async (request, response) => {
    const actor = await session(request, response);
    if (!actor) return;
    const pharmacyId = String(request.params.pharmacyId);
    if (!uuid.test(pharmacyId)) { sendIdentityError(response, 400, 'BAD_REQUEST', 'Entrada no valida'); return; }
    try { response.status(200).json(await management.list(actor.secret, pharmacyId)); }
    catch (error) { sendFailure(error, response); }
  });

  router.post('/pharmacies/:pharmacyId/memberships', security.requireCsrf, async (request, response) => {
    const actor = await session(request, response);
    if (!actor) return;
    const pharmacyId = String(request.params.pharmacyId);
    const body = request.body as unknown;
    if (!uuid.test(pharmacyId) || !exactBody(body, ['userId', 'role']) ||
        typeof body.userId !== 'string' || !uuid.test(body.userId) || body.role !== 'TRABAJADOR') {
      sendIdentityError(response, 400, 'BAD_REQUEST', 'Entrada no valida'); return;
    }
    if (body.userId === actor.userId) {
      sendIdentityError(response, 403, 'FORBIDDEN', 'Permiso insuficiente'); return;
    }
    try { response.status(201).json(await management.grant(actor.secret, pharmacyId, body.userId, 'TRABAJADOR')); }
    catch (error) { sendFailure(error, response); }
  });

  router.patch('/pharmacies/:pharmacyId/memberships/:membershipId', security.requireCsrf,
    async (request, response) => {
      const actor = await session(request, response);
      if (!actor) return;
      const pharmacyId = String(request.params.pharmacyId);
      const membershipId = String(request.params.membershipId);
      if (!uuid.test(pharmacyId) || !uuid.test(membershipId) ||
          !exactBody(request.body, ['status']) || request.body.status !== 'REVOCADA') {
        sendIdentityError(response, 400, 'BAD_REQUEST', 'Entrada no valida'); return;
      }
      try { response.status(200).json(await management.revoke(actor.secret, pharmacyId, membershipId)); }
      catch (error) { sendFailure(error, response); }
    });
  return router;
}
