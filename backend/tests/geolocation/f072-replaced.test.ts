import { describe, expect, it, vi } from 'vitest';
import type { LocationHistoryRow, StoredLocationProposal } from '../../src/modules/farmacias/application/location-ports.js';
import { buildLocationStatus, replacedProposals } from '../../src/modules/farmacias/application/location-status.js';
import { PlatformLocationReview } from '../../src/modules/farmacias/application/platform-location-review.js';
import type { PlatformLocationRepository } from '../../src/modules/farmacias/application/platform-location-review.js';
import { PgPlatformLocationRepository } from '../../src/modules/farmacias/infrastructure/platform-location-repository.js';
import { NEWER_PROPOSAL_EXISTS } from '../../src/modules/farmacias/infrastructure/location-sql.js';
import { LocationConflictError } from '../../src/modules/farmacias/domain/pharmacy-location.js';

const owner = '00000000-0000-4000-8000-0000000000aa';
const reviewer = '00000000-0000-4000-8000-0000000000bb';
const pharmacy = '00000000-0000-4000-8000-000000000001';
const proposal = (over: Partial<StoredLocationProposal>): StoredLocationProposal => ({ id: 'x', pharmacyId: pharmacy, proposerId: owner,
  reviewerId: null, status: 'PENDIENTE', version: 1, basePublicVersion: 0, address: 'Jr. Ficticio 123', city: 'ayacucho',
  latitude: -13.165, longitude: -74.216, precisionMeters: null, source: 'MAPA', evidenceReference: null, ...over });
const row = (over: Partial<StoredLocationProposal>, proposedAt: string, reviewedAt: string | null = null): LocationHistoryRow =>
  ({ proposal: proposal(over), proposedAt, reviewedAt, reason: null });
// Caso real (STUART-FAR, 27/11): dos envíos idénticos con 4 s de diferencia; se aprueba la más nueva.
const OLD = '2026-11-27T22:33:42.000Z', NEW = '2026-11-27T22:33:46.000Z';
const realCase = (newer: Partial<StoredLocationProposal>) => [row({ id: 'nueva', ...newer }, NEW, newer.status === 'PENDIENTE' ? null : '2026-11-27T22:40:00.000Z'),
  row({ id: 'vieja' }, OLD)];

describe('F07.2 · regla única de «Reemplazada» (D-01 A, T001)', () => {
  for (const status of ['PUBLICADA_VERIFICADA', 'RECHAZADA', 'PENDIENTE'] as const) {
    it(`dos envíos seguidos con la más nueva ${status}: la vieja queda «Reemplazada» por la de 4 s después`, () => {
      expect([...replacedProposals(realCase({ status, reviewerId: status === 'PENDIENTE' ? null : reviewer }))]).toEqual([['vieja', NEW]]);
    });
  }
  it('el historial del dueño muestra «Reemplazada» aunque la más nueva ya esté aprobada (antes no)', () => {
    const view = buildLocationStatus(realCase({ status: 'PUBLICADA_VERIFICADA', reviewerId: reviewer }),
      { verified: true, address: 'Jr. Ficticio 123', city: 'ayacucho', latitude: -13.165, longitude: -74.216, verifiedAt: NEW }, owner);
    expect(view.estado).toBe('VERIFICADA');
    expect(view.pendiente).toBeNull();
    expect(view.historial.filter(item => item.accion === 'REEMPLAZADA')).toEqual([
      { fecha: NEW, accion: 'REEMPLAZADA', autor: 'FarmaFind', motivo: 'Se envió una propuesta más reciente', direccion: 'Jr. Ficticio 123' }]);
  });
  it('decididas antiguas no se marcan; una sola propuesta pendiente no está reemplazada', () => {
    expect(replacedProposals([row({ id: 'b', status: 'PUBLICADA_VERIFICADA', reviewerId: reviewer }, NEW), row({ id: 'a', status: 'RECHAZADA', reviewerId: reviewer }, OLD)]).size).toBe(0);
    expect(replacedProposals([row({ id: 'a' }, OLD)]).size).toBe(0);
  });
  it('tres pendientes: las dos viejas quedan reemplazadas, cada una por la inmediatamente más nueva', () => {
    const t3 = '2026-11-27T23:00:00.000Z';
    expect(Object.fromEntries(replacedProposals([row({ id: 'c' }, t3), row({ id: 'b' }, NEW), row({ id: 'a' }, OLD)]))).toEqual({ b: t3, a: NEW });
  });
});

describe('F07.2 · consultas del revisor con la misma regla (T002)', () => {
  const client = (rows: Array<Record<string, unknown>>) => ({ query: vi.fn().mockResolvedValue({ rows }) });
  it('«Pendientes» y «más reciente» comparan contra CUALQUIER propuesta más nueva', async () => {
    const db = client([]);
    const repository = new PgPlatformLocationRepository(db as never);
    await repository.listLatestPending(10);
    expect(db.query.mock.calls[0]![0]).toContain(`NOT ${NEWER_PROPOSAL_EXISTS}`);
    db.query.mockResolvedValueOnce({ rows: [{ latest: false }] });
    expect(await repository.isLatestPending(proposal({ id: 'vieja' }))).toBe(false);
    expect(db.query.mock.calls[1]![0]).not.toContain("n.estado='PENDIENTE'");
  });
  it('historial: filtro REEMPLAZADA y filas con decision REEMPLAZADA, fecha de reemplazo y motivo', async () => {
    const db = client([]);
    db.query.mockResolvedValueOnce({ rows: [{ total: 1 }] }).mockResolvedValueOnce({ rows: [{ id: 'vieja', nombre_publico: 'STUART-FAR (ficticia)',
      direccion_publicable: 'Jr. Ficticio 123', ciudad: 'ayacucho', latitud: '-13.165', longitud: '-74.216', estado: 'PENDIENTE', propuesta_at: OLD,
      revisada_at: null, propia: false, motivo: null, reemplazada: true, reemplazada_at: NEW }] });
    const result = await new PgPlatformLocationRepository(db as never).listHistory('REEMPLAZADA', reviewer, 20, 0);
    expect(db.query.mock.calls[0]![0]).toContain(`p.estado='PENDIENTE' AND ${NEWER_PROPOSAL_EXISTS}`);
    expect(result).toEqual({ total: 1, rows: [{ propuestaId: 'vieja', farmaciaNombre: 'STUART-FAR (ficticia)', direccion: 'Jr. Ficticio 123',
      ciudad: 'ayacucho', latitud: -13.165, longitud: -74.216, decision: 'REEMPLAZADA', motivo: 'Se envió una propuesta más reciente',
      enviadaAt: OLD, decididaAt: NEW, decididoPor: null }] });
    const pending = client([]); pending.query.mockResolvedValueOnce({ rows: [{ total: 0 }] }).mockResolvedValueOnce({ rows: [] });
    await new PgPlatformLocationRepository(pending as never).listHistory('PENDIENTE', reviewer, 20, 0);
    expect(pending.query.mock.calls[0]![0]).toContain(`p.estado='PENDIENTE' AND NOT ${NEWER_PROPOSAL_EXISTS}`);
  });
  it('el caso de uso acepta el filtro REEMPLAZADA y decidir una reemplazada da 409 «Propuesta reemplazada»', async () => {
    const listHistory = vi.fn().mockResolvedValue({ total: 0, rows: [] });
    const repository = { isReviewer: vi.fn().mockResolvedValue(true), listHistory, find: vi.fn().mockResolvedValue(proposal({ id: 'vieja' })),
      isLatestPending: vi.fn().mockResolvedValue(false), listLatestPending: vi.fn(), forPharmacy: vi.fn() } as unknown as PlatformLocationRepository;
    const review = new PlatformLocationReview({ run: (_secret, work) => work(repository, reviewer) });
    await review.history('s', 'REEMPLAZADA', '1');
    expect(listHistory).toHaveBeenCalledWith('REEMPLAZADA', reviewer, 20, 0);
    await expect(review.decide('s', 'vieja', { decision: 'APROBAR', version: 1, evidenciaConfirmada: true, motivo: 'x' }))
      .rejects.toEqual(new LocationConflictError('Propuesta reemplazada'));
  });
});
