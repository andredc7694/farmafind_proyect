import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { PlatformLocationReview } from '../../src/modules/farmacias/application/platform-location-review.js';
import type { PlatformLocationRepository } from '../../src/modules/farmacias/application/platform-location-review.js';
import { PgPlatformLocationRepository } from '../../src/modules/farmacias/infrastructure/platform-location-repository.js';
import { createPlatformLocationsRouter } from '../../src/modules/farmacias/presentation/platform-locations-router.js';
import { LocationForbiddenError, LocationValidationError } from '../../src/modules/farmacias/domain/pharmacy-location.js';

const actor = '00000000-0000-4000-8000-0000000000aa';
const other = '00000000-0000-4000-8000-0000000000bb';
const ALLOWED_KEYS = ['ciudad', 'decididaAt', 'decididoPor', 'decision', 'direccion', 'enviadaAt', 'farmaciaNombre',
  'latitud', 'longitud', 'motivo', 'propuestaId'].sort();

function review(over: Partial<PlatformLocationRepository> = {}) {
  const repository = { isReviewer: async () => true, listLatestPending: async () => [], find: async () => null,
    isLatestPending: async () => true, forPharmacy: () => { throw new Error('no'); },
    listHistory: vi.fn(async () => ({ total: 45, rows: [] })), ...over } as PlatformLocationRepository & { listHistory: ReturnType<typeof vi.fn> };
  return { repository, review: new PlatformLocationReview({ run: (_secret, work) => work(repository, actor) }) };
}

describe('F07.1 · historial de decisiones (FR-017)', () => {
  it('filtro y paginación: 20 por página, filtro traducido al estado de la base', async () => {
    const { review: useCase, repository } = review();
    await expect(useCase.history('s', 'APROBADA', '3')).resolves.toEqual({ pagina: 3, porPagina: 20, total: 45, filas: [] });
    expect(repository.listHistory).toHaveBeenCalledWith('PUBLICADA_VERIFICADA', actor, 20, 40);
    await useCase.history('s', undefined, undefined);
    expect(repository.listHistory).toHaveBeenLastCalledWith('PENDIENTE', actor, 20, 0);
    for (const [status, page] of [['TODAS', '1'], ['RECHAZADA', '0'], ['RECHAZADA', 'x'], ['RECHAZADA', '1001']])
      await expect(useCase.history('s', status, page)).rejects.toBeInstanceOf(LocationValidationError);
  });
  it('sin concesión: 403', async () => {
    await expect(review({ isReviewer: async () => false }).review.history('s', 'RECHAZADA', '1')).rejects.toBeInstanceOf(LocationForbiddenError);
  });
  it('el repositorio devuelve solo los campos aprobados y «quién decidió» sin correos ni identificadores (D-06 A)', async () => {
    const rows = [
      { id: 'p1', nombre_publico: 'Farmacia Alfa', direccion_publicable: 'Jr. 28 de Julio 145', ciudad: 'ayacucho', latitud: '-13.1631',
        longitud: '-74.2244', estado: 'PUBLICADA_VERIFICADA', propuesta_at: '2026-11-26T10:00:00Z', revisada_at: '2026-11-26T11:00:00Z',
        propia: true, motivo: 'Coincide', propuesta_por: other, revisada_por: actor },
      { id: 'p2', nombre_publico: 'Farmacia Beta', direccion_publicable: 'Av. Larco 345', ciudad: 'lima', latitud: '-12.12',
        longitud: '-77.03', estado: 'RECHAZADA', propuesta_at: '2026-11-25T10:00:00Z', revisada_at: '2026-11-25T12:00:00Z',
        propia: false, motivo: 'Punto en el mar', propuesta_por: actor, revisada_por: other }];
    const client = { query: vi.fn(async (sql: string) => (/count\(\*\)/.test(sql) ? { rows: [{ total: 2 }] } : { rows })) };
    const result = await new PgPlatformLocationRepository(client as never).listHistory('RECHAZADA', actor, 20, 0);
    expect(result.total).toBe(2);
    for (const row of result.rows) expect(Object.keys(row).sort()).toEqual(ALLOWED_KEYS);
    expect(result.rows.map(row => row.decididoPor)).toEqual(['Tú', 'Otro revisor de FarmaFind']);
    expect(JSON.stringify(result.rows)).not.toContain(other);
    expect(JSON.stringify(result.rows)).not.toContain(actor);
    const [sql, values] = client.query.mock.calls[1] as [string, unknown[]];
    expect(sql).toMatch(/ORDER BY COALESCE\(p\.revisada_at,p\.propuesta_at\) DESC,p\.id DESC LIMIT \$3 OFFSET \$4/);
    expect(sql).not.toMatch(/f02\.|f04\.|f025\.|usuario_farmacia|delegacion|email/);
    expect(values).toEqual(['RECHAZADA', actor, 20, 0]);
  });
});

describe('F07.1 · ruta del historial', () => {
  it('200 sin caché, 400 con filtro inválido, 403 sin concesión, 401 sin sesión', async () => {
    const app = createApp();
    let mode: 'ok' | 'bad' | 'forbidden' = 'ok';
    const useCase = { list: async () => [], decide: async () => ({}), history: async () => {
      if (mode === 'bad') throw new LocationValidationError('x');
      if (mode === 'forbidden') throw new LocationForbiddenError('x');
      return { pagina: 1, porPagina: 20, total: 0, filas: [] }; } };
    const options = { allowedOrigin: 'http://127.0.0.1:5173', csrfKey: Buffer.alloc(32, 7), cookieSecure: false };
    app.use('/api/v1', createPlatformLocationsRouter({ session: async () => ({ userId: actor }) }, useCase as never, options));
    const cookie = `ff-session-local=${'a'.repeat(64)}`;
    const ok = await request(app).get('/api/v1/platform/location-proposals/historial?estado=APROBADA&pagina=1').set('Cookie', cookie).expect(200);
    expect(ok.headers['cache-control']).toBe('no-store');
    mode = 'bad'; await request(app).get('/api/v1/platform/location-proposals/historial?estado=TODAS').set('Cookie', cookie).expect(400);
    mode = 'forbidden'; await request(app).get('/api/v1/platform/location-proposals/historial').set('Cookie', cookie).expect(403);
    await request(app).get('/api/v1/platform/location-proposals/historial').expect(401);
  });
});
