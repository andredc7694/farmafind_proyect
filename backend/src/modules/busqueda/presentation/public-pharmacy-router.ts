import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import type { PublicOfferRepository } from '../application/ports.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function createPublicPharmacyRouter(repository: PublicOfferRepository): Router {
  const router = Router();
  router.get('/farmacias/:pharmacyId', async (request, response) => {
    const correlationId = randomUUID();
    if (!UUID.test(request.params.pharmacyId)) return response.status(400).json({ code: 'INVALID_ID', message: 'Identificador inválido.', correlationId });
    try {
      const pharmacy = await repository.pharmacy(request.params.pharmacyId);
      return pharmacy ? response.json(pharmacy) : response.status(404).json({ code: 'NOT_FOUND', message: 'Farmacia no disponible.', correlationId });
    } catch { return response.status(503).json({ code: 'SOURCE_UNAVAILABLE', message: 'Consulta no disponible temporalmente.', correlationId }); }
  });
  return router;
}
