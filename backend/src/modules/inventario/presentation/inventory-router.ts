import { Router, json } from 'express';
import type { NextFunction, Request, Response } from 'express';
import { authHttpSecurity, readSessionCookie, sendIdentityError,
  type AuthHttpOptions } from '../../usuarios/contracts/http-security.js';
import type { ManualInventory } from '../application/manual-review.js';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function cents(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null;
  const scaled = Math.round(value * 100);
  return Number.isSafeInteger(scaled) && Math.abs(scaled / 100 - value) < 1e-9 ? scaled : null;
}

export function createInventoryRouter(service: Pick<ManualInventory, 'list' | 'movements' | 'review'>,
  options: AuthHttpOptions): Router {
  const router = Router();
  const security = authHttpSecurity(options);
  router.use((_request, response, next) => { response.set('Cache-Control', 'no-store'); next(); });
  router.use(json({ limit: '8kb' }));
  router.use((_error: unknown, _request: Request, response: Response, _next: NextFunction) => {
    sendIdentityError(response, 400, 'BAD_REQUEST', 'Entrada no válida');
  });

  function secretFor(request: Request, response: Response): string | null {
    const secret = readSessionCookie(request, options);
    if (!secret) sendIdentityError(response, 401, 'UNAUTHENTICATED', 'Sesión no válida');
    return secret;
  }

  router.get('/farmacias/:pharmacyId/inventario/movimientos', async (request, response) => {
    const secret = secretFor(request, response);
    if (!secret) return;
    if (typeof request.params.pharmacyId !== 'string' || !uuid.test(request.params.pharmacyId)) {
      sendIdentityError(response, 404, 'NOT_VISIBLE', 'Recurso no visible'); return;
    }
    try { response.status(200).json(await service.movements(secret, request.params.pharmacyId)); }
    catch { sendIdentityError(response, 404, 'NOT_VISIBLE', 'Recurso no visible'); }
  });

  router.get('/farmacias/:pharmacyId/inventario', async (request, response) => {
    const secret = secretFor(request, response);
    if (!secret) return;
    if (typeof request.params.pharmacyId !== 'string' || !uuid.test(request.params.pharmacyId)) {
      sendIdentityError(response, 404, 'NOT_VISIBLE', 'Recurso no visible'); return;
    }
    try { response.status(200).json(await service.list(secret, request.params.pharmacyId)); }
    catch { sendIdentityError(response, 404, 'NOT_VISIBLE', 'Recurso no visible'); }
  });

  router.put('/farmacias/:pharmacyId/inventario/:medicationId', security.requireCsrf, async (request, response) => {
    const secret = secretFor(request, response);
    if (!secret) return;
    const { pharmacyId, medicationId } = request.params;
    if (typeof pharmacyId !== 'string' || typeof medicationId !== 'string' ||
        !uuid.test(pharmacyId) || !uuid.test(medicationId)) {
      sendIdentityError(response, 404, 'NOT_VISIBLE', 'Recurso no visible'); return;
    }
    const body = request.body as unknown;
    if (!body || typeof body !== 'object' || Array.isArray(body) ||
        Object.keys(body).sort().join(',') !== 'cantidadFisica,motivo,precioReferencial') {
      sendIdentityError(response, 400, 'BAD_REQUEST', 'Entrada no válida'); return;
    }
    const values = body as Record<string, unknown>;
    const priceCents = cents(values.precioReferencial);
    if (priceCents === null || !Number.isInteger(values.cantidadFisica) ||
        (values.cantidadFisica as number) < 0 || (values.cantidadFisica as number) > 2147483647 ||
        typeof values.motivo !== 'string' || !values.motivo.trim() || values.motivo.length > 240) {
      sendIdentityError(response, 400, 'BAD_REQUEST', 'Entrada no válida'); return;
    }
    try {
      response.status(200).json(await service.review(secret, pharmacyId, medicationId, {
        priceCents, physicalQuantity: values.cantidadFisica as number, reason: values.motivo,
      }));
    } catch (error) {
      if (error instanceof Error && error.message === 'Revisión de inventario inválida') {
        sendIdentityError(response, 409, 'CONFLICT', 'Cantidad o precio en conflicto');
      } else {
        sendIdentityError(response, 404, 'NOT_VISIBLE', 'Recurso no visible');
      }
    }
  });
  return router;
}
