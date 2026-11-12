import { Router, json } from 'express';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import type { ActivePharmacyService } from '../application/active-pharmacy.js';
import { authHttpSecurity, readSessionCookie, sendIdentityError } from './auth-middleware.js';
import type { AuthHttpOptions } from './auth-middleware.js';

interface LiveIdentity {
  session(secret: string): Promise<unknown>;
  auditDenied(secret: string, action: 'MEMBERSHIP_LIST' | 'PHARMACY_SELECT', correlationId: string): Promise<void>;
}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Own memberships only. No third-party membership mutation is mounted. */
export function createMembershipRouter(identity: LiveIdentity, memberships: Pick<ActivePharmacyService, 'listAvailable' | 'select'>,
  options: AuthHttpOptions): Router {
  const router = Router();
  const security = authHttpSecurity(options);
  router.use((_request, response, next) => { response.set('Cache-Control', 'no-store'); next(); });
  router.use(json({ limit: '8kb' }));
  router.use((_error: unknown, _request: Request, response: Response, _next: NextFunction) => {
    sendIdentityError(response, 400, 'BAD_REQUEST', 'Entrada no valida');
  });

  async function liveSecret(request: Request, response: Response): Promise<string | null> {
    const secret = readSessionCookie(request, options);
    if (!secret) {
      sendIdentityError(response, 401, 'UNAUTHENTICATED', 'Sesion no valida');
      return null;
    }
    try {
      await identity.session(secret);
      return secret;
    } catch {
      sendIdentityError(response, 401, 'UNAUTHENTICATED', 'Sesion no valida');
      return null;
    }
  }

  router.get('/me/memberships', async (request, response) => {
    const secret = await liveSecret(request, response);
    if (!secret) return;
    try {
      response.status(200).json(await memberships.listAvailable(secret));
    } catch {
      const correlationId = randomUUID();
      try { await identity.auditDenied(secret, 'MEMBERSHIP_LIST', correlationId); }
      catch { sendIdentityError(response, 500, 'INTERNAL', 'No se pudo completar la solicitud'); return; }
      sendIdentityError(response, 401, 'UNAUTHENTICATED', 'Sesion no valida', correlationId);
    }
  });

  router.put('/me/active-pharmacy', security.requireCsrf, async (request, response) => {
    const secret = await liveSecret(request, response);
    if (!secret) return;
    const body = request.body as unknown;
    if (!body || typeof body !== 'object' || Array.isArray(body) ||
        Object.keys(body).length !== 1 || !('pharmacyId' in body) ||
        typeof body.pharmacyId !== 'string' || !uuid.test(body.pharmacyId)) {
      sendIdentityError(response, 400, 'BAD_REQUEST', 'Entrada no valida');
      return;
    }
    try {
      response.status(200).json(await memberships.select(secret, body.pharmacyId));
    } catch {
      const correlationId = randomUUID();
      try { await identity.auditDenied(secret, 'PHARMACY_SELECT', correlationId); }
      catch { sendIdentityError(response, 500, 'INTERNAL', 'No se pudo completar la solicitud'); return; }
      sendIdentityError(response, 404, 'NOT_VISIBLE', 'Recurso no visible', correlationId);
    }
  });

  return router;
}
