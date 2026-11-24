import { describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createPublicSuggestRouter } from '../../src/modules/busqueda/presentation/public-suggest-router.js';
import { InMemoryPublicRateLimit } from '../../src/modules/busqueda/presentation/public-rate-limit.js';
import { derive, SuggestPublicOffers } from '../../src/modules/busqueda/application/suggest-public.js';
import { PublicQueryError } from '../../src/modules/busqueda/contracts/public-search.js';
import type { PublicOffer } from '../../src/modules/busqueda/contracts/public-search.js';

const offer = (name: string, active: string, concentration: string, presentation: string): PublicOffer => ({
  medicamento: { id: 'id', nombreComercial: name, principioActivo: active, concentracion: concentration, presentacion: presentation, clasificacion: 'venta libre' },
  farmacia: { id: 'f', nombre: 'Farmacia', direccion: 'Dirección' }, precioReferencialCentavos: 1000, disponibilidadReferencial: 'DISPONIBLE', ultimaRevision: '2026-11-24T10:00:00.000Z', distanciaKm: null });

function app(execute: ReturnType<typeof vi.fn>, limit = new InMemoryPublicRateLimit(120)) {
  const server = express(); server.use('/api/v1', createPublicSuggestRouter({ execute } as unknown as SuggestPublicOffers, limit)); return server;
}

describe('F08.1 ruta pública de sugerencias', () => {
  it('responde las sugerencias sin caché del navegador y sin exigir sesión', async () => {
    const execute = vi.fn().mockResolvedValue({ suggestions: [{ text: 'paracetamol', kind: 'NOMBRE' }] });
    const response = await request(app(execute)).get('/api/v1/busquedas/sugerencias?q=para');
    expect(response.status).toBe(200); expect(response.headers['cache-control']).toBe('no-store');
    expect(response.body).toEqual({ suggestions: [{ text: 'paracetamol', kind: 'NOMBRE' }] });
    expect(execute).toHaveBeenCalledWith('para');
  });

  it.each(['', '?q=a&extra=1', '?otro=1', '?q=a&q=b'])('rechaza la consulta mal formada «%s» sin llamar al servicio', async query => {
    const execute = vi.fn().mockResolvedValue({ suggestions: [] });
    const response = await request(app(execute)).get(`/api/v1/busquedas/sugerencias${query}`);
    expect(response.status).toBe(400); expect(execute).not.toHaveBeenCalled();
  });

  it('traduce consulta inválida (400), límite (429 con Retry-After) y fallo de fuente (503) sin detalles internos', async () => {
    const invalid = await request(app(vi.fn().mockRejectedValue(new PublicQueryError('INVALID_QUERY', 'La consulta debe tener entre 2 y 120 caracteres')))).get('/api/v1/busquedas/sugerencias?q=a');
    expect(invalid.status).toBe(400);
    const down = await request(app(vi.fn().mockRejectedValue(new Error('detalle SQL interno')))).get('/api/v1/busquedas/sugerencias?q=para');
    expect(down.status).toBe(503); expect(JSON.stringify(down.body)).not.toContain('SQL');
    const limited = app(vi.fn().mockResolvedValue({ suggestions: [] }), new InMemoryPublicRateLimit(2));
    expect((await request(limited).get('/api/v1/busquedas/sugerencias?q=ab')).status).toBe(200);
    expect((await request(limited).get('/api/v1/busquedas/sugerencias?q=ab')).status).toBe(200);
    const blocked = await request(limited).get('/api/v1/busquedas/sugerencias?q=ab');
    expect(blocked.status).toBe(429); expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);
  });

  it('deriva nombres y presentaciones sin duplicados (sin distinguir mayúsculas), con tope de 8 y nombres primero', () => {
    const offers = [offer('Paracetamol', 'Activo A', '500 mg', 'tabletas'), offer('paracetamol', 'activo a', '500 mg', 'tabletas'), offer('Paracetamol', 'Activo A', '1 g', 'jarabe'),
      ...Array.from({ length: 9 }, (_, i) => offer(`Marca ${i}`, `Activo ${i}`, `${i} mg`, 'cápsulas'))];
    const result = derive(offers);
    expect(result.length).toBe(8);
    expect(result.slice(0, 5).every(item => item.kind === 'NOMBRE')).toBe(true);
    expect(new Set(result.map(item => item.text.toLowerCase())).size).toBe(result.length);
  });

  it('el caso de uso consulta solo la proyección pública con una consulta canónica y sin ubicación', async () => {
    const search = vi.fn().mockResolvedValue([offer('Paracetamol', 'Activo', '500 mg', 'tabletas')]);
    const result = await new SuggestPublicOffers({ search, pharmacy: vi.fn() } as never).execute('  PARA   cet  ');
    expect(search.mock.calls[0][0]).toMatchObject({ term: 'para cet', latitude: null, longitude: null, minimumPrice: null, page: 1 });
    expect(result.suggestions.map(item => item.text)).toContain('Paracetamol 500 mg tabletas');
  });
});
