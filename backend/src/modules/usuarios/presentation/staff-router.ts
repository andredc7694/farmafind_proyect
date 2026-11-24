import { Router, json } from 'express';
import type { NextFunction, Request, Response } from 'express';
import type { AuthHttpOptions } from './auth-middleware.js';
import { authHttpSecurity, readSessionCookie, sendIdentityError } from './auth-middleware.js';
import { MembershipConflictError, MembershipForbiddenError, MembershipNotVisibleError } from '../application/manage-memberships.js';
import { SessionRestrictedError } from '../application/ports.js';
import type { StaffMemberRow } from '../application/ports.js';
import type { CreatedStaff } from '../application/manage-staff.js';
import { StaffPolicyError } from '../domain/staff-policy.js';

interface LiveSession { session(secret: string): Promise<{ userId: string }> }
interface StaffManagement {
  list(secret: string, pharmacyId: string): Promise<readonly StaffMemberRow[]>;
  create(secret: string, pharmacyId: string, input: { alias: unknown; displayName: unknown; capabilities?: unknown }): Promise<CreatedStaff>;
  issueTemporaryKey?(secret: string, pharmacyId: string, userId: unknown): Promise<{ temporaryPassword: string; expiresAt: Date }>;
}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function sendFailure(error: unknown, response: Response): void {
  if (error instanceof MembershipNotVisibleError) sendIdentityError(response, 404, 'NOT_VISIBLE', 'Recurso no visible');
  else if (error instanceof MembershipConflictError) sendIdentityError(response, 409, 'CONFLICT', 'No disponible');
  else if (error instanceof MembershipForbiddenError || error instanceof SessionRestrictedError) {
    sendIdentityError(response, 403, 'FORBIDDEN', 'Permiso insuficiente');
  } else if (error instanceof StaffPolicyError || (error instanceof Error && error.message === 'Entrada inválida')) {
    sendIdentityError(response, 400, 'BAD_REQUEST', 'Entrada no valida');
  } else if (error instanceof Error && error.message === 'No autorizado') {
    sendIdentityError(response, 401, 'UNAUTHENTICATED', 'Sesion no valida');
  } else sendIdentityError(response, 500, 'INTERNAL', 'No se pudo completar la solicitud');
}

/** Personal de la farmacia: solo propietario/administrador autorizado, nunca roles globales (F01.1 US1). */
export function createStaffRouter(identity: LiveSession, staff: StaffManagement, options: AuthHttpOptions): Router {
  const router = Router();
  const security = authHttpSecurity(options);
  router.use((_request, response, next) => { response.set('Cache-Control', 'no-store'); next(); });
  router.use(json({ limit: '8kb' }));
  router.use((_error: unknown, _request: Request, response: Response, _next: NextFunction) => {
    sendIdentityError(response, 400, 'BAD_REQUEST', 'Entrada no valida');
  });

  async function session(request: Request, response: Response): Promise<string | null> {
    const secret = readSessionCookie(request, options);
    if (!secret) { sendIdentityError(response, 401, 'UNAUTHENTICATED', 'Sesion no valida'); return null; }
    try {
      const view = await identity.session(secret);
      if (!uuid.test(view.userId)) throw new Error('No autorizado');
      return secret;
    } catch { sendIdentityError(response, 401, 'UNAUTHENTICATED', 'Sesion no valida'); return null; }
  }

  router.get('/pharmacies/:pharmacyId/staff', async (request, response) => {
    const secret = await session(request, response);
    if (!secret) return;
    const pharmacyId = String(request.params.pharmacyId);
    if (!uuid.test(pharmacyId)) { sendIdentityError(response, 400, 'BAD_REQUEST', 'Entrada no valida'); return; }
    try { response.status(200).json(await staff.list(secret, pharmacyId)); } catch (error) { sendFailure(error, response); }
  });

  router.post('/pharmacies/:pharmacyId/staff', security.requireCsrf, async (request, response) => {
    const secret = await session(request, response);
    if (!secret) return;
    const pharmacyId = String(request.params.pharmacyId);
    const body = request.body as unknown;
    const isObject = body !== null && typeof body === 'object' && !Array.isArray(body);
    const keys = isObject ? Object.keys(body as object) : [];
    if (!uuid.test(pharmacyId) || !isObject || keys.some(key => !['alias', 'displayName', 'capabilities'].includes(key)) ||
        !keys.includes('alias') || !keys.includes('displayName')) {
      sendIdentityError(response, 400, 'BAD_REQUEST', 'Entrada no valida'); return;
    }
    const input = body as { alias: unknown; displayName: unknown; capabilities?: unknown };
    try {
      const created = await staff.create(secret, pharmacyId, input);
      response.status(201).json({ userId: created.userId, alias: created.alias,
        temporaryPassword: created.temporaryPassword, expiresAt: created.expiresAt.toISOString() });
    } catch (error) { sendFailure(error, response); }
  });
  router.post('/pharmacies/:pharmacyId/staff/:userId/temporary-key', security.requireCsrf, async (request, response) => {
    const secret = await session(request, response);
    if (!secret) return;
    const pharmacyId = String(request.params.pharmacyId);
    const userId = String(request.params.userId);
    if (!staff.issueTemporaryKey || !uuid.test(pharmacyId) || !uuid.test(userId)) {
      sendIdentityError(response, 400, 'BAD_REQUEST', 'Entrada no valida'); return;
    }
    try {
      const issued = await staff.issueTemporaryKey(secret, pharmacyId, userId);
      response.status(201).json({ temporaryPassword: issued.temporaryPassword, expiresAt: issued.expiresAt.toISOString() });
    } catch (error) { sendFailure(error, response); }
  });
  return router;
}
