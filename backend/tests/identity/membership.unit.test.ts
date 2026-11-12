import { describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { IdentityTransaction, IdentityUnitOfWork } from '../../src/modules/usuarios/application/ports.js';
import type { Membership, PharmacyReference } from '../../src/modules/usuarios/domain/identity.js';
import { ActivePharmacyService } from '../../src/modules/usuarios/application/active-pharmacy.js';

const actor = randomUUID();
const pharmacyA = randomUUID();
const pharmacyB = randomUUID();
const pharmacyC = randomUUID();
const now = new Date('2026-11-11T00:00:00Z');

function membership(pharmacyId: string, state: Membership['state'] = 'ACTIVA'): Membership {
  return { id: randomUUID(), userId: actor, pharmacyId, roleCode: 'TRABAJADOR', state,
    createdAt: now, updatedAt: now, changedByUserId: null };
}

function scenario(memberships: Membership[], pharmacies: PharmacyReference[]) {
  const selected: string[] = [];
  const transaction = {
    listOwnMemberships: async (userId: string) => userId === actor ? memberships : [],
    findPharmacyReference: async (id: string) => pharmacies.find(item => item.id === id) ?? null,
    listOwnDelegations: async (_id: string) => [],
    useAuthorizedPharmacy: async (userId: string, id: string) => {
      const own = memberships.find(item => item.userId === userId && item.pharmacyId === id && item.state === 'ACTIVA');
      const pharmacy = pharmacies.find(item => item.id === id && item.state === 'ACTIVA');
      if (!own || !pharmacy) throw new Error('No autorizado');
      selected.push(id);
      return own;
    },
    context: async () => ({ actorUserId: actor, pharmacyId: selected.at(-1) ?? null, role: 'f01_runtime' }),
  } satisfies IdentityTransaction;
  const uow: IdentityUnitOfWork = { run: async (_secret, work) => work(transaction, actor) };
  return { service: new ActivePharmacyService(uow), selected, memberships };
}

describe('selección de membresía propia sin autoasignación', () => {
  const activeA: PharmacyReference = { id: pharmacyA, state: 'ACTIVA', publicName: 'Farmacia A ficticia' };
  const activeB: PharmacyReference = { id: pharmacyB, state: 'ACTIVA', publicName: 'Farmacia B ficticia' };
  const inactiveC: PharmacyReference = { id: pharmacyC, state: 'INACTIVA', publicName: 'Farmacia C ficticia' };

  it('cero membresías devuelve lista vacía y niega elegir un ID conocido', async () => {
    const { service, selected } = scenario([], [activeA]);
    expect(await service.listAvailable('secret-fixture')).toEqual([]);
    await expect(service.select('secret-fixture', pharmacyA)).rejects.toThrow('No autorizado');
    expect(selected).toEqual([]);
  });

  it('una o varias membresías activas solo ofrecen farmacias activas propias', async () => {
    const own = [membership(pharmacyA), membership(pharmacyB), membership(pharmacyC), membership(randomUUID(), 'SUSPENDIDA')];
    const { service, memberships } = scenario(own, [activeA, activeB, inactiveC]);
    const available = await service.listAvailable('secret-fixture');
    expect(available.map(item => item.pharmacyId)).toEqual([pharmacyA, pharmacyB]);
    expect(available.map(item => item.roleCode)).toEqual(['TRABAJADOR', 'TRABAJADOR']);
    expect(memberships).toHaveLength(4);
    const selected = await service.select('secret-fixture', pharmacyB);
    expect(selected).toEqual({ pharmacyId: pharmacyB, roleCode: 'TRABAJADOR', delegationCodes: [] });
  });

  it('revocación, farmacia inactiva o intento de B ajena deniegan selección posterior', async () => {
    const own = [membership(pharmacyA)];
    const { service, selected } = scenario(own, [activeA, inactiveC]);
    await expect(service.select('secret-fixture', pharmacyB)).rejects.toThrow('No autorizado');
    await expect(service.select('secret-fixture', pharmacyC)).rejects.toThrow('No autorizado');
    await service.select('secret-fixture', pharmacyA);
    own[0] = { ...own[0], state: 'REVOCADA' };
    await expect(service.select('secret-fixture', pharmacyA)).rejects.toThrow('No autorizado');
    expect(selected).toEqual([pharmacyA]);
  });
});
