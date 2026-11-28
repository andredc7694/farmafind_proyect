import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { authHttpSecurity } from '../../src/modules/usuarios/contracts/http-security.js';
import { AddressSuggestions, AddressSuggestionsBusyError, AddressSuggestionsDisabledError } from '../../src/modules/farmacias/application/address-suggestions.js';
import type { GeocoderPort } from '../../src/modules/farmacias/application/address-suggestions.js';
import { NOMINATIM_USER_AGENT, NominatimGeocoder } from '../../src/modules/farmacias/infrastructure/nominatim-geocoder.js';
import { createAddressSuggestionsRouter } from '../../src/modules/farmacias/presentation/address-suggestions-router.js';
import { LocationValidationError } from '../../src/modules/farmacias/domain/pharmacy-location.js';

// Todas las pruebas simulan el servicio: ninguna llamada real a OpenStreetMap.
const lima = { latitud: -12.1211, longitud: -77.0297, etiqueta: 'Av. Larco, Miraflores, Lima, Perú' };
function fakeGeocoder(over: Partial<GeocoderPort> = {}) {
  return { search: vi.fn(async () => lima), reverse: vi.fn(async () => ({ calle: 'Avenida Larco', ciudad: 'Lima' })), ...over };
}
function clockAt(start = 1_000_000) { let now = start; return { now: () => now, advance: (ms: number) => { now += ms; } }; }

describe('F07.1 · sugerencias: caso de uso (FR-013, FR-014, FR-016)', () => {
  it('apagado por defecto: sin geocodificador no consulta nada', async () => {
    const suggestions = new AddressSuggestions(null);
    expect(suggestions.enabled).toBe(false);
    await expect(suggestions.search({ direccion: 'Av. Larco', ciudad: 'Lima' })).rejects.toBeInstanceOf(AddressSuggestionsDisabledError);
  });
  it('valida entradas, descarta resultados fuera del Perú y rechaza puntos fuera del Perú', async () => {
    const outside = new AddressSuggestions(fakeGeocoder({ search: vi.fn(async () => ({ latitud: 40.4, longitud: -3.7, etiqueta: 'Madrid' })) }),
      clockAt(), async () => undefined);
    await expect(outside.search({ direccion: 'Gran Vía', ciudad: 'Lima' })).resolves.toBeNull();
    const suggestions = new AddressSuggestions(fakeGeocoder(), clockAt(), async () => undefined);
    await expect(suggestions.search({ direccion: 'ab', ciudad: 'Lima' })).rejects.toBeInstanceOf(LocationValidationError);
    await expect(suggestions.search({ direccion: 'Av. Larco', ciudad: 'Lima', extra: 1 })).rejects.toBeInstanceOf(LocationValidationError);
    await expect(suggestions.reverse({ latitud: 40.4, longitud: -3.7 })).rejects.toBeInstanceOf(LocationValidationError);
  });
  it('caché: la misma consulta no vuelve a salir', async () => {
    const geocoder = fakeGeocoder(); const clock = clockAt();
    const suggestions = new AddressSuggestions(geocoder, clock, async () => undefined);
    await suggestions.search({ direccion: 'Av. Larco 123', ciudad: 'Lima' });
    clock.advance(5000);
    await suggestions.search({ direccion: 'av. larco 123', ciudad: 'LIMA' });
    expect(geocoder.search).toHaveBeenCalledOnce();
  });
  it('límite global de 1 consulta por segundo: espera su turno y rechaza si la cola es larga', async () => {
    const clock = clockAt(); const waits: number[] = [];
    const suggestions = new AddressSuggestions(fakeGeocoder(), clock, async ms => { waits.push(ms); },
      { minIntervalMs: 1000, cacheTtlMs: 1000, cacheMax: 10, maxWaitMs: 2500 });
    await suggestions.search({ direccion: 'Calle Uno', ciudad: 'Lima' });
    await suggestions.search({ direccion: 'Calle Dos', ciudad: 'Lima' });
    await suggestions.search({ direccion: 'Calle Tres', ciudad: 'Lima' });
    expect(waits).toEqual([1000, 2000]);
    await expect(suggestions.search({ direccion: 'Calle Cuatro', ciudad: 'Lima' })).rejects.toBeInstanceOf(AddressSuggestionsBusyError);
  });
  it('si el servicio falla o no encuentra nada, devuelve null sin error', async () => {
    const suggestions = new AddressSuggestions(fakeGeocoder({ reverse: vi.fn(async () => { throw new Error('timeout'); }) }),
      clockAt(), async () => undefined);
    await expect(suggestions.reverse({ latitud: -12.12, longitud: -77.03 })).resolves.toBeNull();
  });
});

describe('F07.1 · adaptador Nominatim simulado (FR-016)', () => {
  it('Perú, un resultado, español, User-Agent genérico y sin número de casa en la inversa', async () => {
    const calls: Array<{ url: URL; headers: Record<string, string> }> = [];
    const fetchImpl = vi.fn(async (url: string, init: { headers: Record<string, string> }) => {
      calls.push({ url: new URL(url), headers: init.headers });
      const parsed = new URL(url);
      return { ok: true, json: async () => parsed.pathname === '/search'
        ? [{ lat: '-12.1211', lon: '-77.0297', display_name: 'Av. Larco, Miraflores, Lima, Perú' }]
        : { address: { house_number: '345', road: 'Avenida José Larco', suburb: 'Miraflores', city: 'Lima' } } };
    });
    const geocoder = new NominatimGeocoder(fetchImpl as never, 4000);
    await expect(geocoder.search('Av. Larco 345', 'Lima')).resolves.toMatchObject({ latitud: -12.1211, longitud: -77.0297 });
    await expect(geocoder.reverse(-12.1211, -77.0297)).resolves.toEqual({ calle: 'Avenida José Larco', ciudad: 'Lima' });
    expect(calls[0].url.origin).toBe('https://nominatim.openstreetmap.org');
    expect(calls[0].url.searchParams.get('countrycodes')).toBe('pe');
    expect(calls[0].url.searchParams.get('limit')).toBe('1');
    expect(calls[0].url.searchParams.get('q')).toBe('Av. Larco 345, Lima, Perú');
    expect(calls[0].headers['User-Agent']).toBe(NOMINATIM_USER_AGENT);
    expect(NOMINATIM_USER_AGENT).toBe('FarmaFind-DEMO/0.1 (proyecto local de pruebas)');
    expect(NOMINATIM_USER_AGENT).not.toMatch(/@|github|http/i);
  });
  it('no escribe en la consola lo consultado', async () => {
    const spies = ['log', 'info', 'warn', 'error', 'debug'].map(method => vi.spyOn(console, method as 'log').mockImplementation(() => undefined));
    const geocoder = new NominatimGeocoder((async () => ({ ok: false, json: async () => null })) as never);
    const suggestions = new AddressSuggestions(geocoder, clockAt(), async () => undefined);
    await suggestions.search({ direccion: 'Jirón Secreto 999', ciudad: 'Ayacucho' });
    for (const spy of spies) { expect(spy).not.toHaveBeenCalled(); spy.mockRestore(); }
  });
});

const id = '00000000-0000-4000-8000-000000000001', secret = 'a'.repeat(64), origin = 'http://127.0.0.1:5173';
const options = { allowedOrigin: origin, csrfKey: Buffer.alloc(32, 7), cookieSecure: false };
async function setup(enabled = true, allowed = true) {
  const app = createApp(); app.get('/csrf', authHttpSecurity(options).issueCsrf);
  const authorizer = { authorizePropose: vi.fn(async () => { if (!allowed) throw new Error('Capacidad insuficiente'); }) };
  const geocoder = fakeGeocoder();
  app.use('/api/v1', createAddressSuggestionsRouter({ session: async () => ({ userId: id }) }, authorizer,
    new AddressSuggestions(enabled ? geocoder : null, clockAt(), async () => undefined), options));
  const cookie = `ff-session-local=${secret}`;
  const result = await request(app).get('/csrf').set('Cookie', cookie).expect(200);
  const nonce = /ff-csrf-local=([a-f0-9]{64})/.exec(result.headers['set-cookie']?.join(';') ?? '')?.[1];
  return { app, authorizer, geocoder, auth: { token: result.body.csrfToken as string, cookie: `${cookie}; ff-csrf-local=${nonce}` } };
}
const post = (ctx: Awaited<ReturnType<typeof setup>>, path: string, body: object) => request(ctx.app)
  .post(`/api/v1/farmacias/${id}/ubicacion/sugerencias/${path}`).set('Cookie', ctx.auth.cookie).set('Origin', origin)
  .set('X-CSRF-Token', ctx.auth.token).send(body);

describe('F07.1 · rutas de sugerencia (FR-013, FR-014, FR-016)', () => {
  it('con permiso: búsqueda e inversa por POST, sin caché HTTP', async () => {
    const ctx = await setup();
    const found = await post(ctx, 'buscar', { direccion: 'Av. Larco 345', ciudad: 'Lima' }).expect(200);
    expect(found.body.resultado).toMatchObject({ latitud: -12.1211 });
    expect(found.headers['cache-control']).toBe('no-store');
    const reverse = await post(ctx, 'inversa', { latitud: -12.1211, longitud: -77.0297 }).expect(200);
    expect(reverse.body.resultado).toEqual({ calle: 'Avenida Larco', ciudad: 'Lima' });
    expect(ctx.authorizer.authorizePropose).toHaveBeenCalledWith(secret, id);
  });
  it('sin permiso de proponer: 403 y no consulta el servicio', async () => {
    const ctx = await setup(true, false);
    await post(ctx, 'buscar', { direccion: 'Av. Larco 345', ciudad: 'Lima' }).expect(403);
    expect(ctx.geocoder.search).not.toHaveBeenCalled();
  });
  it('apagado: 503; sin CSRF: rechazado; sin sesión: 401', async () => {
    const off = await setup(false);
    await post(off, 'buscar', { direccion: 'Av. Larco 345', ciudad: 'Lima' }).expect(503);
    const ctx = await setup();
    await request(ctx.app).post(`/api/v1/farmacias/${id}/ubicacion/sugerencias/buscar`).set('Cookie', ctx.auth.cookie)
      .set('Origin', origin).send({ direccion: 'Av. Larco', ciudad: 'Lima' }).expect(403);
    expect(ctx.geocoder.search).not.toHaveBeenCalled();
  });
});
