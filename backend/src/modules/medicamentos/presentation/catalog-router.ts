import { Router } from 'express';
import type { Request, Response } from 'express';
import type { AuthHttpOptions } from '../../usuarios/contracts/http-security.js';
import { readSessionCookie, sendIdentityError } from '../../usuarios/contracts/http-security.js';
import type { ListCatalog } from '../application/list-catalog.js';

export function createCatalogRouter(catalog: Pick<ListCatalog, 'run'>, options: AuthHttpOptions): Router {
  const router = Router();
  router.get('/catalogo/medicamentos', async (request: Request, response: Response) => {
    response.set('Cache-Control', 'no-store');
    const secret = readSessionCookie(request, options);
    if (!secret) { sendIdentityError(response, 401, 'UNAUTHENTICATED', 'Sesión no válida'); return; }
    const query = request.query.q ?? '';
    const page = request.query.page ?? '1';
    if (typeof query !== 'string' || query.length > 120 || typeof page !== 'string' ||
        !/^[1-9]\d{0,5}$/.test(page)) {
      sendIdentityError(response, 400, 'BAD_REQUEST', 'Consulta no válida'); return;
    }
    try {
      response.status(200).json(await catalog.run(secret, query.trim(), Number(page)));
    } catch {
      sendIdentityError(response, 404, 'NOT_VISIBLE', 'Recurso no visible');
    }
  });
  return router;
}
