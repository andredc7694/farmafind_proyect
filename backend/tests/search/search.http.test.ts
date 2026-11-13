import { describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createPublicSearchRouter } from '../../src/modules/busqueda/presentation/public-search-router.js';
import { createPublicPharmacyRouter } from '../../src/modules/busqueda/presentation/public-pharmacy-router.js';

const result = { consulta: 'paracetamol', ofertas: [], paginacion: { pagina: 1, tamano: 20, total: 0, totalPaginas: 0 },
  aviso: 'Precio y disponibilidad referenciales; confirma existencias con la farmacia.' as const };
describe('HTTP público F03', () => {
  it('no requiere sesión y valida consulta/paginación', async () => {
    const search = { execute: vi.fn().mockResolvedValue(result) };
    const app = express(); app.use('/api/v1', createPublicSearchRouter(search as never));
    expect((await request(app).get('/api/v1/busquedas?q=paracetamol')).status).toBe(200);
    expect((await request(app).get('/api/v1/busquedas?q=x')).status).toBe(400);
    expect((await request(app).get('/api/v1/busquedas?q=paracetamol&tamano=51')).status).toBe(400);
    expect((await request(app).get('/api/v1/busquedas?q=paracetamol&orden=cercania')).status).toBe(422);
  });
  it('minimiza errores y perfiles inexistentes', async () => {
    const repository = { search: vi.fn(), pharmacy: vi.fn().mockResolvedValue(null) };
    const app = express(); app.use('/api/v1', createPublicPharmacyRouter(repository));
    const invalid = await request(app).get('/api/v1/farmacias/no-uuid').expect(400);
    expect(invalid.body).toEqual({ code: 'INVALID_ID', message: 'Identificador inválido.', correlationId: expect.any(String) });
    await request(app).get('/api/v1/farmacias/00000000-0000-4000-8000-000000000001').expect(404);
  });
});
