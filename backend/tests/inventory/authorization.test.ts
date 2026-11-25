import { describe, expect, it } from 'vitest';
import { canUseInventory } from '../../src/modules/inventario/domain/authorization.js';

const base = {
  authenticated: true,
  membershipActive: true,
  pharmacyActive: true,
  actorRole: 'DUENO',
  selectedPharmacyId: 'alfa',
  resourcePharmacyId: 'alfa',
  capabilities: ['inventory.read', 'inventory.write'],
} as const;

describe('autorización de inventario F02', () => {
  it('permite al dueño propio solo la capacidad explícita', () => {
    expect(canUseInventory(base, 'inventory.read')).toBe(true);
    expect(canUseInventory(base, 'inventory.import.confirm')).toBe(false);
  });

  it('rechaza farmacia ajena aunque se conozca el identificador', () => {
    expect(canUseInventory({ ...base, resourcePharmacyId: 'beta' }, 'inventory.read')).toBe(false);
  });

  it('trabajador solo opera con la capacidad delegada (F01.2)', () => {
    expect(canUseInventory({ ...base, actorRole: 'TRABAJADOR' }, 'inventory.read')).toBe(true);
    expect(canUseInventory({ ...base, actorRole: 'TRABAJADOR' }, 'inventory.import.confirm')).toBe(false);
    expect(canUseInventory({ ...base, actorRole: 'TRABAJADOR', capabilities: [] }, 'inventory.read')).toBe(false);
    expect(canUseInventory({ ...base, actorRole: 'OTRO' }, 'inventory.read')).toBe(false);
  });

  it('rechaza membresía, farmacia o sesión inactivas', () => {
    expect(canUseInventory({ ...base, membershipActive: false }, 'inventory.read')).toBe(false);
    expect(canUseInventory({ ...base, pharmacyActive: false }, 'inventory.read')).toBe(false);
    expect(canUseInventory({ ...base, authenticated: false }, 'inventory.read')).toBe(false);
  });
});
