import { describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createPharmacyReservationsRouter } from '../../src/modules/reservas/presentation/pharmacy-reservations-router.js';
import { createInventoryRouter } from '../../src/modules/inventario/presentation/inventory-router.js';

const options = { allowedOrigin: 'http://127.0.0.1:5173', csrfKey: Buffer.alloc(32, 9), cookieSecure: false };
const cookie = `ff-session-local=${'a'.repeat(64)}`;
const pharmacy = '00000000-0000-4000-8000-00000000000a';

function reservationApp(summary?: ReturnType<typeof vi.fn>) {
  const unused = { list: vi.fn(), execute: vi.fn(), get: vi.fn(), save: vi.fn() };
  const center = { snapshot: vi.fn(), history: vi.fn(), exportCsv: vi.fn(), ...(summary ? { summary } : {}) };
  const app = express(); app.use('/api/v1', createPharmacyReservationsRouter({ confirm: unused, settings: unused, shortage: unused, deliver: unused, center } as never, options));
  return app;
}
function inventoryApp(summary?: ReturnType<typeof vi.fn>) {
  const service = { list: vi.fn(), movements: vi.fn(), review: vi.fn(), ...(summary ? { summary } : {}) };
  const app = express(); app.use('/api/v1', createInventoryRouter(service as never, options));
  return app;
}

describe('F08.1 rutas de resumen', () => {
  it('reservas: exige sesión, valida el identificador y responde no-store con las cifras', async () => {
    const summary = vi.fn().mockResolvedValue({ generatedAt: '2026-11-24T15:00:00.000Z', pending: 2, confirmed: 1, expiringSoon: 0 });
    const app = reservationApp(summary);
    expect((await request(app).get(`/api/v1/farmacias/${pharmacy}/reservas/resumen`)).status).toBe(401);
    expect((await request(app).get('/api/v1/farmacias/no-es-uuid/reservas/resumen').set('Cookie', cookie)).status).toBe(404);
    const response = await request(app).get(`/api/v1/farmacias/${pharmacy}/reservas/resumen`).set('Cookie', cookie);
    expect(response.status).toBe(200); expect(response.headers['cache-control']).toBe('no-store');
    expect(response.body).toEqual({ generatedAt: '2026-11-24T15:00:00.000Z', pending: 2, confirmed: 1, expiringSoon: 0 });
    expect(summary).toHaveBeenCalledWith('a'.repeat(64), pharmacy);
  });

  it('reservas: una denegación del servicio es 403 sin detalles y sin servicio la ruta no existe', async () => {
    const denied = reservationApp(vi.fn().mockRejectedValue(new Error('detalle interno')));
    const response = await request(denied).get(`/api/v1/farmacias/${pharmacy}/reservas/resumen`).set('Cookie', cookie);
    expect(response.status).toBe(403); expect(JSON.stringify(response.body)).not.toContain('detalle interno');
    expect((await request(reservationApp()).get(`/api/v1/farmacias/${pharmacy}/reservas/resumen`).set('Cookie', cookie)).status).toBe(404);
  });

  it('inventario: exige sesión, valida el identificador y una denegación es 404 como el resto de rutas de inventario', async () => {
    const summary = vi.fn().mockResolvedValue({ generatedAt: '2026-11-24T15:00:00.000Z', products: 3, withoutStock: 1 });
    const app = inventoryApp(summary);
    expect((await request(app).get(`/api/v1/farmacias/${pharmacy}/inventario/resumen`)).status).toBe(401);
    expect((await request(app).get('/api/v1/farmacias/x/inventario/resumen').set('Cookie', cookie)).status).toBe(404);
    const ok = await request(app).get(`/api/v1/farmacias/${pharmacy}/inventario/resumen`).set('Cookie', cookie);
    expect(ok.status).toBe(200); expect(ok.body).toEqual({ generatedAt: '2026-11-24T15:00:00.000Z', products: 3, withoutStock: 1 });
    const denied = inventoryApp(vi.fn().mockRejectedValue(new Error('x')));
    expect((await request(denied).get(`/api/v1/farmacias/${pharmacy}/inventario/resumen`).set('Cookie', cookie)).status).toBe(404);
    expect((await request(inventoryApp()).get(`/api/v1/farmacias/${pharmacy}/inventario/resumen`).set('Cookie', cookie)).status).toBe(404);
  });
});
