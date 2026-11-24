// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { comparableFor, priceGapCents } from '../../src/search/comparable.js';
import { forgetFilters, parseFilters, readRememberedFilters, rememberFilters, serializeFilters } from '../../src/search/filters-state.js';
import { createPublicSearchClient } from '../../src/search/search-client.js';

const offer = (medication, pharmacy, cents, name = pharmacy) => ({ medicamento: { id: medication }, farmacia: { id: pharmacy, nombre: name }, precioReferencialCentavos: cents, ultimaRevision: '2026-11-24T10:00:00.000Z' });

beforeEach(() => window.localStorage.clear());

describe('F08.1 estado de filtros en la URL', () => {
  it('ida y vuelta sin perder datos y descartando valores inválidos o la cercanía (necesita ubicación)', () => {
    const filters = { query: 'paracetamol 500', minimum: '1.5', maximum: '20', order: 'precio_asc' };
    expect(parseFilters(`?${serializeFilters(filters)}`)).toEqual(filters);
    expect(serializeFilters({ query: '', minimum: '', maximum: '', order: 'relevancia' })).toBe('');
    expect(parseFilters('?min=abc&max=-3&orden=hackeo&q=' + 'x'.repeat(200))).toEqual({ query: 'x'.repeat(120), minimum: '', maximum: '', order: 'relevancia' });
    expect(parseFilters('?orden=cercania').order).toBe('relevancia');
    expect(serializeFilters({ query: 'a', order: 'cercania' })).toBe('q=a');
  });

  it('recordar filtros guarda solo precio y orden con consentimiento; olvidar los borra; nunca la consulta ni la ubicación', () => {
    expect(readRememberedFilters()).toBeNull();
    expect(rememberFilters({ query: 'dato sensible', minimum: '2', maximum: '9', order: 'precio_desc', latitude: -12, longitude: -77 })).toBe(true);
    const raw = window.localStorage.getItem('ff-filters');
    expect(JSON.parse(raw)).toEqual({ minimum: '2', maximum: '9', order: 'precio_desc' });
    expect(raw).not.toMatch(/sensible|-12|-77/);
    expect(readRememberedFilters()).toMatchObject({ minimum: '2', maximum: '9', order: 'precio_desc', query: '' });
    forgetFilters(); expect(window.localStorage.getItem('ff-filters')).toBeNull();
  });

  it('sin almacenamiento disponible no falla', () => {
    const broken = { getItem() { throw new Error('x'); }, setItem() { throw new Error('x'); }, removeItem() { throw new Error('x'); } };
    expect(readRememberedFilters(broken)).toBeNull(); expect(rememberFilters({}, broken)).toBe(false); expect(forgetFilters(broken)).toBe(false);
  });
});

describe('F08.1 ofertas comparables derivadas de los resultados', () => {
  const offers = [offer('m1', 'a', 1200, 'Alfa'), offer('m1', 'b', 1000, 'Beta'), offer('m1', 'c', 1000, 'Gamma'), offer('m2', 'a', 500, 'Alfa')];
  it('lista las otras farmacias con el mismo medicamento, de menor a mayor precio y sin repetir la propia', () => {
    expect(comparableFor(offers[0], offers).map(item => item.pharmacy)).toEqual(['Beta', 'Gamma']);
    expect(comparableFor(offers[3], offers)).toEqual([]);
  });
  it('calcula la diferencia frente al precio más bajo del mismo medicamento', () => {
    expect(priceGapCents(offers[0], offers)).toBe(200); expect(priceGapCents(offers[1], offers)).toBe(0); expect(priceGapCents(offers[3], offers)).toBe(0);
  });
});

describe('F08.1 cliente de sugerencias', () => {
  const response = (status, body) => ({ ok: status < 400, status, json: async () => body });
  it('consulta solo con el texto, sin sesión, y devuelve la lista', async () => {
    const fetcher = async url => { expect(url).toBe('/api/v1/busquedas/sugerencias?q=para+ce'); return response(200, { suggestions: [{ text: 'paracetamol', kind: 'NOMBRE' }] }); };
    expect(await createPublicSearchClient(fetcher).suggest('para ce')).toEqual([{ text: 'paracetamol', kind: 'NOMBRE' }]);
  });
  it('un cuerpo inesperado da lista vacía y un error lanza para que la interfaz siga sin sugerencias', async () => {
    expect(await createPublicSearchClient(async () => response(200, { otro: 1 })).suggest('para')).toEqual([]);
    await expect(createPublicSearchClient(async () => response(503, {})).suggest('para')).rejects.toThrow();
  });
});
