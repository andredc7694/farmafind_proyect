import { Router, json } from 'express';
import type { NextFunction, Request, Response } from 'express';
import type { AuthHttpOptions } from './auth-middleware.js';
import { authHttpSecurity, readSessionCookie, sendIdentityError } from './auth-middleware.js';
import { MembershipConflictError, MembershipForbiddenError, MembershipNotVisibleError } from '../application/manage-memberships.js';
import { SessionRestrictedError } from '../application/ports.js';
import type { InvitationRow, MyInvitationRow } from '../application/ports.js';
import { StaffPolicyError } from '../domain/staff-policy.js';

interface LiveSession { session(secret: string): Promise<{ userId: string }> }
interface StaffAccess {
  invite(secret: string, pharmacyId: string, email: unknown): Promise<void>;
  listInvitations(secret: string, pharmacyId: string): Promise<readonly InvitationRow[]>;
  revokeInvitation(secret: string, pharmacyId: string, invitationId: unknown): Promise<void>;
  setCapabilities(secret: string, pharmacyId: string, membershipId: unknown, capabilities: unknown): Promise<void>;
  listMine(secret: string): Promise<readonly MyInvitationRow[]>;
  accept(secret: string, invitationId: unknown): Promise<void>;
  decline(secret: string, invitationId: unknown): Promise<void>;
}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function sendFailure(error: unknown, response: Response): void {
  if (error instanceof MembershipNotVisibleError) sendIdentityError(response, 404, 'NOT_VISIBLE', 'Recurso no visible');
  else if (error instanceof MembershipConflictError) sendIdentityError(response, 409, 'CONFLICT', 'Operacion no disponible');
  else if (error instanceof MembershipForbiddenError || error instanceof SessionRestrictedError) {
    sendIdentityError(response, 403, 'FORBIDDEN', 'Permiso insuficiente');
  } else if (error instanceof StaffPolicyError || (error instanceof Error && error.message === 'Entrada inválida')) {
    sendIdentityError(response, 400, 'BAD_REQUEST', 'Entrada no valida');
  } else if (error instanceof Error && error.message === 'No autorizado') {
    sendIdentityError(response, 401, 'UNAUTHENTICATED', 'Sesion no valida');
  } else sendIdentityError(response, 500, 'INTERNAL', 'No se pudo completar la solicitud');
}

function exactKeys(body: unknown, keys: readonly string[]): body is Record<string, unknown> {
  return body !== null && typeof body === 'object' && !Array.isArray(body) &&
    Object.keys(body).length === keys.length && keys.every(key => Object.hasOwn(body, key));
}

/** Invitaciones de personal, permisos delegados y respuestas del destinatario (F01.1 US2). */
export function createStaffAccessRouter(identity: LiveSession, access: StaffAccess, options: AuthHttpOptions): Router {
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
  const param = (request: Request, name: string) => String(request.params[name]);
  const bad = (response: Response) => sendIdentityError(response, 400, 'BAD_REQUEST', 'Entrada no valida');

  router.post('/pharmacies/:pharmacyId/staff/invitations', security.requireCsrf, async (request, response) => {
    const secret = await session(request, response);
    if (!secret) return;
    if (!uuid.test(param(request, 'pharmacyId')) || !exactKeys(request.body, ['email'])) { bad(response); return; }
    try {
      await access.invite(secret, param(request, 'pharmacyId'), (request.body as { email: unknown }).email);
      response.status(202).end(); // siempre igual, exista o no la cuenta
    } catch (error) { sendFailure(error, response); }
  });

  router.get('/pharmacies/:pharmacyId/staff/invitations', async (request, response) => {
    const secret = await session(request, response);
    if (!secret) return;
    if (!uuid.test(param(request, 'pharmacyId'))) { bad(response); return; }
    try {
      const rows = await access.listInvitations(secret, param(request, 'pharmacyId'));
      response.status(200).json(rows.map(row => ({ id: row.id, destination: row.destination, state: row.state,
        createdAt: row.createdAt.toISOString(), expiresAt: row.expiresAt.toISOString() })));
    } catch (error) { sendFailure(error, response); }
  });

  router.delete('/pharmacies/:pharmacyId/staff/invitations/:invitationId', security.requireCsrf, async (request, response) => {
    const secret = await session(request, response);
    if (!secret) return;
    if (!uuid.test(param(request, 'pharmacyId')) || !uuid.test(param(request, 'invitationId'))) { bad(response); return; }
    try {
      await access.revokeInvitation(secret, param(request, 'pharmacyId'), param(request, 'invitationId'));
      response.status(204).end();
    } catch (error) { sendFailure(error, response); }
  });

  router.put('/pharmacies/:pharmacyId/staff/:membershipId/capabilities', security.requireCsrf, async (request, response) => {
    const secret = await session(request, response);
    if (!secret) return;
    if (!uuid.test(param(request, 'pharmacyId')) || !uuid.test(param(request, 'membershipId')) ||
        !exactKeys(request.body, ['capabilities'])) { bad(response); return; }
    try {
      await access.setCapabilities(secret, param(request, 'pharmacyId'), param(request, 'membershipId'),
        (request.body as { capabilities: unknown }).capabilities);
      response.status(204).end();
    } catch (error) { sendFailure(error, response); }
  });

  router.get('/me/invitations', async (request, response) => {
    const secret = await session(request, response);
    if (!secret) return;
    try {
      const rows = await access.listMine(secret);
      response.status(200).json(rows.map(row => ({ id: row.id, pharmacyName: row.pharmacyName, state: row.state,
        expiresAt: row.expiresAt.toISOString() })));
    } catch (error) { sendFailure(error, response); }
  });

  for (const action of ['accept', 'decline'] as const) {
    router.post(`/me/invitations/:invitationId/${action}`, security.requireCsrf, async (request, response) => {
      const secret = await session(request, response);
      if (!secret) return;
      if (!uuid.test(param(request, 'invitationId'))) { bad(response); return; }
      try {
        await (action === 'accept' ? access.accept(secret, param(request, 'invitationId'))
          : access.decline(secret, param(request, 'invitationId')));
        response.status(204).end();
      } catch (error) { sendFailure(error, response); }
    });
  }
  return router;
}
