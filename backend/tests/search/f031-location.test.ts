import { describe, expect, it, vi } from 'vitest';
import { SearchPublicOffers } from '../../src/modules/busqueda/application/search-public-offers.js';
import { PgPublicOfferRepository } from '../../src/modules/busqueda/infrastructure/public-offer-repository.js';
import { parsePublicQuery } from '../../src/modules/busqueda/domain/public-query.js';
import { PUBLIC_NOTICE } from '../../src/modules/busqueda/contracts/public-search.js';
import { searchTerms } from '../../src/modules/busqueda/domain/search-terms.js';

const query = parsePublicQuery({ q: 'paracetamol' });
const terms = searchTerms(query.term);
const row = (id: string, latitude: unknown, longitude: unknown) => ({ medicamento_id: 'm', nombre_comercial: 'paracetamol',
  principio_activo: 'paracetamol', concentracion: '500 mg', presentacion: 'tabletas', clasificacion: 'venta libre',
  farmacia_id: id, farmacia_nombre: `Farmacia ${id}`, farmacia_direccion: 'Jr. Ficticio 1', farmacia_latitud: latitude,
  farmacia_longitud: longitude, precio_centavos: 1200, ultima_revision: '2026-11-12T00:00:00.000Z' });
const database = (rows: Array<Record<string, unknown>>) => ({ query: vi.fn().mockResolvedValue({ rows }) });
const rows = [row('verificada', '-13.163100', '-74.224400'), row('sin-verificar', null, null), row('rara', 'x', '-74')];

describe('F03.1 · farmacia.ubicacion en la búsqueda pública (D-01 A)', () => {
  it('con F07 activo: coordenadas solo si la función las devuelve (verificada); el resto null', async () => {
    const offers = (await new PgPublicOfferRepository(database(rows), { exposeVerifiedLocation: true }).search(terms, query, 200)).map(item => item.offer);
    expect(offers.map(offer => offer.farmacia.ubicacion)).toEqual([{ latitud: -13.1631, longitud: -74.2244 }, null, null]);
    expect(Object.keys(offers[0]!.farmacia).sort()).toEqual(['direccion', 'id', 'nombre', 'ubicacion']);
    expect(offers[1]!.farmacia.direccion).toBe('Jr. Ficticio 1');
  });
  it('sin F07 (opción apagada o ausente): ubicacion siempre null aunque la fila traiga coordenadas', async () => {
    for (const repository of [new PgPublicOfferRepository(database(rows)), new PgPublicOfferRepository(database(rows), { exposeVerifiedLocation: false })])
      expect((await repository.search(terms, query, 200)).every(item => item.offer.farmacia.ubicacion === null)).toBe(true);
  });
  it('la ficha /farmacias/{id} no cambia de forma', async () => {
    const detail = await new PgPublicOfferRepository(database([{ farmacia_id: 'f', farmacia_nombre: 'Farmacia f', farmacia_direccion: 'Jr. 1' }]),
      { exposeVerifiedLocation: true }).pharmacy('f');
    expect(detail).toEqual({ id: 'f', nombre: 'Farmacia f', direccion: 'Jr. 1' });
  });
});

describe('F03.1 · caché con la forma nueva (T002, T003)', () => {
  const fresh = { medicamento: { id: 'm', nombreComercial: 'paracetamol', principioActivo: 'paracetamol', concentracion: '500 mg',
    presentacion: 'tabletas', clasificacion: 'venta libre' }, farmacia: { id: 'f', nombre: 'Farmacia Alfa', direccion: 'Jr. 1',
    ubicacion: { latitud: -13.16, longitud: -74.22 } }, precioReferencialCentavos: 1200, disponibilidadReferencial: 'DISPONIBLE' as const,
  ultimaRevision: '2026-11-12T00:00:00.000Z', distanciaKm: null };
  const payload = (farmacia: Record<string, unknown>) => JSON.stringify({ consulta: 'paracetamol', aviso: PUBLIC_NOTICE,
    paginacion: { pagina: 1, tamano: 20, total: 1, totalPaginas: 1 }, coincidencia: 'EXACTA', ofertas: [{ ...fresh, farmacia }] });

  it('una entrada vieja (sin ubicacion) se descarta sin error, se recalcula y se reescribe', async () => {
    const metrics = { record: vi.fn() };
    const cache = { generation: vi.fn().mockResolvedValue('0'), set: vi.fn().mockResolvedValue(undefined),
      get: vi.fn().mockResolvedValue(payload({ id: 'f', nombre: 'Farmacia Alfa', direccion: 'Jr. 1' })) };
    const repository = { search: vi.fn().mockResolvedValue([{ offer: fresh, matches: 1 }]), pharmacy: vi.fn() };
    const result = await new SearchPublicOffers(repository, cache, { ttlSeconds: 60, candidateLimit: 200 }, metrics).execute(query);
    expect(result.ofertas[0]!.farmacia.ubicacion).toEqual({ latitud: -13.16, longitud: -74.22 });
    expect(metrics.record).toHaveBeenCalledWith('invalid');
    expect(repository.search).toHaveBeenCalledTimes(1);
    expect(JSON.parse(cache.set.mock.calls[0]![1] as string).ofertas[0].farmacia.ubicacion).toEqual({ latitud: -13.16, longitud: -74.22 });
  });
  it('entradas nuevas (con ubicacion o null) son acierto; formas inválidas se descartan', async () => {
    for (const ubicacion of [null, { latitud: -13.16, longitud: -74.22 }]) {
      const metrics = { record: vi.fn() };
      const cache = { generation: vi.fn().mockResolvedValue('0'), set: vi.fn(),
        get: vi.fn().mockResolvedValue(payload({ id: 'f', nombre: 'Farmacia Alfa', direccion: 'Jr. 1', ubicacion })) };
      const repository = { search: vi.fn(), pharmacy: vi.fn() };
      const result = await new SearchPublicOffers(repository, cache, { ttlSeconds: 60, candidateLimit: 200 }, metrics).execute(query);
      expect(metrics.record).toHaveBeenCalledWith('hit'); expect(repository.search).not.toHaveBeenCalled();
      expect(result.ofertas[0]!.farmacia.ubicacion).toEqual(ubicacion);
    }
    for (const ubicacion of [{ latitud: '1', longitud: 2 }, { latitud: 1 }, { latitud: 1, longitud: 2, extra: 3 }]) {
      const metrics = { record: vi.fn() };
      const cache = { generation: vi.fn().mockResolvedValue('0'), set: vi.fn().mockResolvedValue(undefined),
        get: vi.fn().mockResolvedValue(payload({ id: 'f', nombre: 'Farmacia Alfa', direccion: 'Jr. 1', ubicacion })) };
      const repository = { search: vi.fn().mockResolvedValue([{ offer: fresh, matches: 1 }]), pharmacy: vi.fn() };
      await new SearchPublicOffers(repository, cache, { ttlSeconds: 60, candidateLimit: 200 }, metrics).execute(query);
      expect(metrics.record).toHaveBeenCalledWith('invalid');
    }
  });
});
