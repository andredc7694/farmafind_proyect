import { describe, expect, it, vi } from 'vitest';
import { AddressSuggestions, SEARCH_AREA_HALF_SIDE_DEGREES, type GeocoderPort } from '../../src/modules/farmacias/application/address-suggestions.js';
import { NominatimGeocoder } from '../../src/modules/farmacias/infrastructure/nominatim-geocoder.js';
import { LocationValidationError } from '../../src/modules/farmacias/domain/pharmacy-location.js';

const AYACUCHO = { latitud: -13.1588, longitud: -74.2239 };
const noWait = { now: () => 0 };
const make = (geocoder: GeocoderPort) => new AddressSuggestions(geocoder, noWait, async () => undefined,
  { minIntervalMs: 0, cacheTtlMs: 1000, cacheMax: 10, maxWaitMs: 1000 });

describe('F07.2 · «Buscar en el mapa» limitado a la ciudad (D-02 A, T006)', () => {
  it('con centro: pasa la zona de ±0,27° al geocodificador y acepta un resultado dentro', async () => {
    const search = vi.fn().mockResolvedValue({ latitud: -13.16, longitud: -74.22, etiqueta: 'Jr. Ficticio, Ayacucho' });
    const result = await make({ search, reverse: vi.fn() }).search({ direccion: 'Jr. Ficticio 123', ciudad: 'Ayacucho', centro: AYACUCHO });
    expect(result).toMatchObject({ latitud: -13.16 });
    expect(search).toHaveBeenCalledWith('Jr. Ficticio 123', 'Ayacucho', { latitude: -13.1588, longitude: -74.2239, halfSideDegrees: 0.27 });
    expect(SEARCH_AREA_HALF_SIDE_DEGREES).toBe(0.27);
  });
  it('doble control: un resultado fuera de la zona (Moquegua para «Ayacucho») se descarta', async () => {
    const search = vi.fn().mockResolvedValue({ latitud: -17.195, longitud: -70.936, etiqueta: 'Calle homónima, Moquegua' });
    expect(await make({ search, reverse: vi.fn() }).search({ direccion: 'Jr. Ficticio 123', ciudad: 'Ayacucho', centro: AYACUCHO })).toBeNull();
  });
  it('sin centro: igual que F07.1 (sin zona)', async () => {
    const search = vi.fn().mockResolvedValue({ latitud: -17.195, longitud: -70.936, etiqueta: 'x' });
    expect(await make({ search, reverse: vi.fn() }).search({ direccion: 'Jr. Ficticio 123', ciudad: 'Pueblo pequeño' })).toMatchObject({ latitud: -17.195 });
    expect(search).toHaveBeenCalledWith('Jr. Ficticio 123', 'Pueblo pequeño', null);
  });
  it('centro inválido o fuera del Perú, o campos de más: 400', async () => {
    const service = make({ search: vi.fn(), reverse: vi.fn() });
    for (const centro of [{ latitud: 40.4, longitud: -3.7 }, { latitud: '-13', longitud: -74 }, { latitud: -13 }, { latitud: -13, longitud: -74, x: 1 }, 'Ayacucho'])
      await expect(service.search({ direccion: 'Jr. Ficticio 123', ciudad: 'Ayacucho', centro })).rejects.toBeInstanceOf(LocationValidationError);
    await expect(service.search({ direccion: 'Jr. Ficticio 123', ciudad: 'Ayacucho', otra: 1 })).rejects.toBeInstanceOf(LocationValidationError);
  });
  it('la caché distingue la zona (la misma dirección con y sin centro no se mezcla)', async () => {
    const search = vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce({ latitud: -17.195, longitud: -70.936, etiqueta: 'x' });
    const service = make({ search, reverse: vi.fn() });
    expect(await service.search({ direccion: 'Jr. Ficticio 123', ciudad: 'Ayacucho', centro: AYACUCHO })).toBeNull();
    expect(await service.search({ direccion: 'Jr. Ficticio 123', ciudad: 'Ayacucho' })).toMatchObject({ latitud: -17.195 });
    expect(search).toHaveBeenCalledTimes(2);
  });
  it('Nominatim recibe viewbox (izq,arriba,der,abajo) y bounded=1 con zona; sin zona, no (fetch falso, sin red)', async () => {
    const urls: string[] = [];
    const fetchImpl = vi.fn(async (url: string) => { urls.push(url); return { ok: true, json: async () => [] }; });
    const geocoder = new NominatimGeocoder(fetchImpl);
    await geocoder.search('Jr. Ficticio 123', 'Ayacucho', { latitude: -13.1588, longitude: -74.2239, halfSideDegrees: 0.27 });
    await geocoder.search('Jr. Ficticio 123', 'Ayacucho');
    const zoned = new URL(urls[0]!), free = new URL(urls[1]!);
    expect(zoned.searchParams.get('viewbox')).toBe('-74.4939,-12.8888,-73.9539,-13.4288');
    expect(zoned.searchParams.get('bounded')).toBe('1');
    expect(zoned.searchParams.get('countrycodes')).toBe('pe');
    expect(free.searchParams.has('viewbox')).toBe(false); expect(free.searchParams.has('bounded')).toBe(false);
  });
});
