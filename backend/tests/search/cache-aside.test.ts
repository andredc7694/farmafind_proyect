import { describe, expect, it, vi } from 'vitest';
import { SearchPublicOffers, searchCacheKey } from '../../src/modules/busqueda/application/search-public-offers.js';
import { parsePublicQuery } from '../../src/modules/busqueda/domain/public-query.js';

const query = parsePublicQuery({ q: 'paracetamol' });
const offer = { medicamento: { id: 'm', nombreComercial: 'paracetamol', principioActivo: 'paracetamol',
  concentracion: '500 mg', presentacion: 'tabletas', clasificacion: 'venta libre' },
farmacia: { id: 'f', nombre: 'Farmacia Alfa', direccion: 'Dirección ficticia' }, precioReferencialCentavos: 1200,
disponibilidadReferencial: 'DISPONIBLE' as const, ultimaRevision: '2026-11-12T00:00:00.000Z', distanciaKm: null };

describe('Cache-Aside F03', () => {
  it('genera clave opaca estable sin término visible', () => {
    const key = searchCacheKey('4', query);
    expect(key).toMatch(/^farmafind:f03:v1:g4:search:[a-f0-9]{64}$/);
    expect(key).not.toContain('paracetamol');
  });
  it('usa miss, guarda TTL y luego acepta hit público', async () => {
    const cache = { generation: vi.fn().mockResolvedValue('0'), get: vi.fn().mockResolvedValue(null), set: vi.fn().mockResolvedValue(undefined) };
    const repository = { search: vi.fn().mockResolvedValue([offer]), pharmacy: vi.fn() };
    const service = new SearchPublicOffers(repository, cache, { ttlSeconds: 60, candidateLimit: 200 });
    expect((await service.execute(query)).ofertas).toHaveLength(1);
    expect(cache.set).toHaveBeenCalledWith(expect.any(String), expect.any(String), 60);
  });
  it('caída o payload corrupto cae a PostgreSQL sin devolver datos corruptos', async () => {
    const repository = { search: vi.fn().mockResolvedValue([offer]), pharmacy: vi.fn() };
    const broken = { generation: vi.fn().mockRejectedValue(new Error('caído')), get: vi.fn(), set: vi.fn() };
    expect((await new SearchPublicOffers(repository, broken, { ttlSeconds: 60, candidateLimit: 200 }).execute(query)).ofertas).toHaveLength(1);
    const corrupt = { generation: vi.fn().mockResolvedValue('0'), get: vi.fn().mockResolvedValue('{'), set: vi.fn() };
    expect((await new SearchPublicOffers(repository, corrupt, { ttlSeconds: 60, candidateLimit: 200 }).execute(query)).ofertas).toHaveLength(1);
  });
});
