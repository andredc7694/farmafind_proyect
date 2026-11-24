import { describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createPharmacyReservationsRouter } from '../../src/modules/reservas/presentation/pharmacy-reservations-router.js';
import { createCustomerReservationsRouter } from '../../src/modules/reservas/presentation/customer-reservations-router.js';
import { authHttpSecurity } from '../../src/modules/usuarios/contracts/http-security.js';
import { AttentionCenter, AttentionFilterError, decodeCursor } from '../../src/modules/reservas/application/attention-center.js';
import { PickupPreferenceError } from '../../src/modules/reservas/domain/pickup-preference.js';
import { csvCell, toCsv } from '../../src/modules/reservas/domain/csv-export.js';

const origin = 'http://127.0.0.1:5173';
const options = { allowedOrigin: origin, csrfKey: Buffer.alloc(32, 9), cookieSecure: false };
const cookie = `ff-session-local=${'a'.repeat(64)}`;
const pharmacy = '00000000-0000-4000-8000-00000000000a';
const medication = '00000000-0000-4000-8000-00000000000b';

function pharmacyApp(centerOverrides: Record<string, unknown> = {}, withCenter = true) {
  const center = { snapshot: vi.fn().mockResolvedValue({ generatedAt: '2026-11-24T15:00:00.000Z', items: [] }),
    history: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
    exportCsv: vi.fn().mockResolvedValue({ csv: 'a,b\r\n', truncated: false, rows: 0 }), ...centerOverrides };
  const unused = { list: vi.fn(), execute: vi.fn(), get: vi.fn(), save: vi.fn() };
  const app = express();
  app.use('/api/v1', createPharmacyReservationsRouter({ confirm: unused, settings: unused, shortage: unused, deliver: unused, ...(withCenter ? { center } : {}) } as never, options));
  return { app, center };
}
const get = (app: express.Express, path: string, withCookie = true) => request(app).get(`/api/v1${path}`).set('Cookie', withCookie ? cookie : '');

describe('F04.1 rutas de atención de la farmacia', () => {
  it('sin el servicio las rutas nuevas no existen y las demás siguen', async () => {
    const { app } = pharmacyApp({}, false);
    expect((await get(app, `/farmacias/${pharmacy}/reservas/centro`)).status).toBe(404);
  });

  it('exigen sesión y un identificador de farmacia válido', async () => {
    const { app, center } = pharmacyApp();
    for (const path of ['centro', 'historial', 'historial/exportar']) {
      expect((await get(app, `/farmacias/${pharmacy}/reservas/${path}`, false)).status, path).toBe(401);
      expect((await get(app, `/farmacias/no-es-uuid/reservas/${path}`)).status, path).toBe(404);
    }
    expect(center.snapshot).not.toHaveBeenCalled();
  });

  it('la cola responde la instantánea con no-store y traduce los filtros', async () => {
    const { app, center } = pharmacyApp();
    const response = await get(app, `/farmacias/${pharmacy}/reservas/centro?estado=PENDIENTE&desde=2026-11-01T00:00:00Z&hasta=2026-11-30T00:00:00Z`);
    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.body).toEqual({ generatedAt: '2026-11-24T15:00:00.000Z', items: [] });
    expect(center.snapshot).toHaveBeenCalledWith('a'.repeat(64), pharmacy, { state: 'PENDIENTE', from: new Date('2026-11-01T00:00:00Z'), to: new Date('2026-11-30T00:00:00Z') });
  });

  it.each(['estado=ENTREGADA', 'estado=otra', 'desde=ayer', 'desde=2026-12-01&hasta=2026-11-01', 'desconocido=1', 'estado=PENDIENTE&estado=CONFIRMADA'])(
    'la cola rechaza el filtro inválido «%s» con 400 sin consultar', async query => {
      const { app, center } = pharmacyApp();
      expect((await get(app, `/farmacias/${pharmacy}/reservas/centro?${query}`)).status).toBe(400);
      expect(center.snapshot).not.toHaveBeenCalled();
    });

  it('el historial valida límite y cursor y pasa los filtros', async () => {
    const { app, center } = pharmacyApp();
    expect((await get(app, `/farmacias/${pharmacy}/reservas/historial?estado=CANCELADA&limite=10&cursor=abc`)).status).toBe(200);
    expect(center.history).toHaveBeenCalledWith('a'.repeat(64), pharmacy, { state: 'CANCELADA', limit: 10, cursor: 'abc' });
    for (const bad of ['limite=0x', 'limite=-1', 'limite=1000000', 'estado=PENDIENTE']) {
      expect((await get(app, `/farmacias/${pharmacy}/reservas/historial?${bad}`)).status, bad).toBe(400);
    }
  });

  it('la exportación entrega CSV adjunto con cabeceras seguras y marca el truncado', async () => {
    const { app } = pharmacyApp({ exportCsv: vi.fn().mockResolvedValue({ csv: '﻿codigo\r\n', truncated: true, rows: 1 }) });
    const response = await get(app, `/farmacias/${pharmacy}/reservas/historial/exportar?estado=ENTREGADA`);
    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('text/csv');
    expect(response.headers['content-disposition']).toBe('attachment; filename="historial-reservas.csv"');
    expect(response.headers['x-export-truncated']).toBe('true');
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['cache-control']).toBe('no-store');
  });

  it('una denegación del servicio es 403 sin detalles', async () => {
    const { app } = pharmacyApp({ snapshot: vi.fn().mockRejectedValue(new Error('No autorizado: detalle interno')) });
    const response = await get(app, `/farmacias/${pharmacy}/reservas/centro`);
    expect(response.status).toBe(403);
    expect(JSON.stringify(response.body)).not.toContain('detalle interno');
  });
});

describe('F04.1 creación con preferencia (cliente)', () => {
  async function customer(createExecute: ReturnType<typeof vi.fn>) {
    const reservation = { id: pharmacy, state: 'PENDIENTE', pickupPreference: { type: 'MINUTES', minutes: 60 } };
    if (!createExecute.getMockImplementation()) createExecute.mockResolvedValue({ reservation, replay: false });
    const services = { create: { execute: createExecute },
      own: { list: vi.fn(), detail: vi.fn() }, cancel: { execute: vi.fn() } };
    const app = express(); app.use('/api/v1', createCustomerReservationsRouter(services as never, options));
    const security = authHttpSecurity(options); const wrapper = express();
    wrapper.get('/csrf', (req, res) => security.issueCsrf(req, res)); wrapper.use(app);
    const agent = request.agent(wrapper);
    const token = (await agent.get('/csrf').set('Cookie', cookie).expect(200)).body.csrfToken as string;
    return (body: unknown) => agent.post('/api/v1/reservas').set('Origin', origin).set('Cookie', cookie).set('X-CSRF-Token', token).set('Idempotency-Key', 'create-0001').send(body as object);
  }

  it('pasa la preferencia al caso de uso y la devuelve; sin ella no cambia nada', async () => {
    const execute = vi.fn(); const post = await customer(execute);
    expect((await post({ pharmacyId: pharmacy, medicationId: medication, quantity: 1, pickupPreference: { type: 'MINUTES', minutes: 60 } })).status).toBe(201);
    expect(execute.mock.calls[0][1]).toMatchObject({ pickupPreference: { type: 'MINUTES', minutes: 60 } });
    expect((await post({ pharmacyId: pharmacy, medicationId: medication, quantity: 1 })).status).toBe(201);
    expect(execute.mock.calls[1][1]).not.toHaveProperty('pickupPreference');
  });

  it('una preferencia inválida o fuera del plazo es 422 con el mensaje claro', async () => {
    const execute = vi.fn().mockRejectedValue(new PickupPreferenceError('La franja debe terminar dentro de las próximas 1 h (plazo de la farmacia)'));
    const response = await (await customer(execute))({ pharmacyId: pharmacy, medicationId: medication, quantity: 1, pickupPreference: { type: 'MINUTES', minutes: 120 } });
    expect(response.status).toBe(422);
    expect(response.body.message).toContain('plazo de la farmacia');
  });
});

describe('F04.1 casos de uso y utilidades', () => {
  it('AttentionCenter exige reservation.read y devuelve la instantánea con la hora del reloj', async () => {
    const run = vi.fn().mockImplementation(async (_s: string, _p: string, capability: string, work: (ports: unknown) => unknown) => {
      void capability; return work({ reservations: { attention: vi.fn().mockResolvedValue([]), history: vi.fn().mockResolvedValue({ items: [], next: { createdAt: '2026-11-01T00:00:00.000Z', id: '00000000-0000-4000-8000-000000000001' } }),
        exportHistory: vi.fn().mockResolvedValue({ rows: [{ id: 'x', code: 'x', state: 'ENTREGADA', quantity: 1, medication: '=CMD()', createdAt: 'c', confirmedAt: null, pickupExpiresAt: null, closeReason: null, pickupPreference: null }], truncated: false }) } }); });
    const center = new AttentionCenter({ run } as never, { now: () => new Date('2026-11-24T15:00:00Z') });
    expect((await center.snapshot('s', pharmacy, {})).generatedAt).toBe('2026-11-24T15:00:00.000Z');
    expect(run.mock.calls[0][2]).toBe('reservation.read');
    const page = await center.history('s', pharmacy, {});
    expect(decodeCursor(page.nextCursor!)).toEqual({ createdAt: '2026-11-01T00:00:00.000Z', id: '00000000-0000-4000-8000-000000000001' });
    await expect(center.history('s', pharmacy, { limit: 101 })).rejects.toBeInstanceOf(AttentionFilterError);
    await expect(center.history('s', pharmacy, { cursor: 'basura' })).rejects.toBeInstanceOf(AttentionFilterError);
    const exported = await center.exportCsv('s', pharmacy, {});
    expect(exported.csv).toContain("'=CMD()");
    expect(exported.csv.split('\r\n')[0]).toBe('﻿codigo,estado,medicamento,cantidad,creada,confirmada,vence_recogida,motivo_cierre,preferencia');
    expect(exported.csv).not.toMatch(/usuario|correo|email|telefono/i);
  });

  it('el CSV neutraliza fórmulas y escapa comillas, comas y saltos', () => {
    for (const dangerous of ['=1+1', '+SUM(A1)', '-2', '@x', '\tx', '\rx']) expect(csvCell(dangerous).replace(/^"/, '')).toMatch(/^'/);
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('di "hola"')).toBe('"di ""hola"""');
    expect(csvCell('línea\nnueva')).toBe('"línea\nnueva"');
    expect(csvCell(null)).toBe('');
    expect(csvCell(12)).toBe('12');
    expect(toCsv(['h'], [['v']])).toBe('﻿h\r\nv\r\n');
  });
});
