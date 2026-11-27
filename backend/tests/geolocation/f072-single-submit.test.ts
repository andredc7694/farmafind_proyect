import { describe, expect, it, vi } from 'vitest';
import { ManagePharmacyLocation } from '../../src/modules/farmacias/application/manage-pharmacy-location.js';
import type { LocationRepository, StoredLocationProposal } from '../../src/modules/farmacias/application/location-ports.js';
import { PgLocationRepository, IDENTICAL_WINDOW_SECONDS } from '../../src/modules/farmacias/infrastructure/location-repository.js';
import { NEWER_PROPOSAL_EXISTS } from '../../src/modules/farmacias/infrastructure/location-sql.js';

const pharmacy = '00000000-0000-4000-8000-000000000001';
const owner = '00000000-0000-4000-8000-0000000000aa';
const body = { direccionPublicable: 'Jr. Ficticio 123', ciudad: 'Ayacucho', latitud: -13.165, longitud: -74.216, fuente: 'MAPA' };
const stored = (id: string): StoredLocationProposal => ({ id, pharmacyId: pharmacy, proposerId: owner, reviewerId: null, status: 'PENDIENTE',
  version: 1, basePublicVersion: 0, address: 'Jr. Ficticio 123', city: 'ayacucho', latitude: -13.165, longitude: -74.216,
  precisionMeters: null, source: 'MAPA', evidenceReference: null });

function setup(identical: StoredLocationProposal | null) {
  const calls: string[] = [];
  const repository = {
    publicVersion: vi.fn(async () => 0),
    lockProposals: vi.fn(async () => { calls.push('lock'); }),
    findRecentIdentical: vi.fn(async () => { calls.push('find'); return identical; }),
    insert: vi.fn(async () => { calls.push('insert'); return stored('nueva'); }),
    audit: vi.fn(async () => { calls.push('audit'); }),
  } as unknown as LocationRepository;
  const manage = new ManagePharmacyLocation({ run: (_s, _p, _c, work) => work(repository, { pharmacyId: pharmacy, actorId: owner, capability: 'GEO_LOCATION_PROPOSE' }) });
  return { manage, repository, calls };
}

describe('F07.2 · un solo envío en el servidor (FR-002, D-05 A, T004)', () => {
  it('envío idéntico al instante: devuelve la misma propuesta, sin insertar ni auditar', async () => {
    const { manage, repository, calls } = setup(stored('primera'));
    expect(await manage.propose('s', pharmacy, body)).toEqual({ id: 'primera', estado: 'PENDIENTE', version: 1 });
    expect(calls).toEqual(['lock', 'find']);
    expect(repository.insert).not.toHaveBeenCalled(); expect(repository.audit).not.toHaveBeenCalled();
  });
  it('sin idéntica: bloquea primero, luego inserta y audita como siempre', async () => {
    const { manage, calls } = setup(null);
    expect(await manage.propose('s', pharmacy, body)).toEqual({ id: 'nueva', estado: 'PENDIENTE', version: 1 });
    expect(calls).toEqual(['lock', 'find', 'insert', 'audit']);
  });
  it('la consulta exige mismo autor, mismos datos, PENDIENTE, sin una más nueva y dentro de 10 s; el bloqueo es por farmacia', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    const repository = new PgLocationRepository({ query } as never, pharmacy);
    await repository.lockProposals(pharmacy);
    expect(query.mock.calls[0]).toEqual(["SELECT pg_advisory_xact_lock(hashtextextended('f072:propuesta:'||$1::text,0))", [pharmacy]]);
    expect(await repository.findRecentIdentical(pharmacy, owner, { address: 'Jr. Ficticio 123', city: 'ayacucho', latitude: -13.165,
      longitude: -74.216, precisionMeters: null, source: 'MAPA', evidenceReference: null })).toBeNull();
    const [sql, values] = query.mock.calls[1]!;
    for (const part of ['p.propuesta_por=$2', "p.estado='PENDIENTE'", 'p.latitud=round($5::numeric,6)', 'make_interval(secs => $10)', `NOT ${NEWER_PROPOSAL_EXISTS}`])
      expect(sql).toContain(part);
    expect(values.at(-1)).toBe(IDENTICAL_WINDOW_SECONDS);
    expect(IDENTICAL_WINDOW_SECONDS).toBe(10);
    expect(() => repository.lockProposals('00000000-0000-4000-8000-000000000999')).rejects.toThrow('tenant incorrecto');
  });
});
