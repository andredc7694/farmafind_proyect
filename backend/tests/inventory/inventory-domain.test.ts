import { describe, expect, it } from 'vitest';
import { reviewInventory } from '../../src/modules/inventario/domain/inventario.js';

const original = {
  pharmacyId: 'alfa', medicationId: 'med1', physicalQuantity: 12,
  committedQuantity: 3, priceCents: 1500, lastReviewedAt: '2026-11-01T00:00:00.000Z',
};

describe('revisión manual F02', () => {
  it('registra antes/después, motivo, actor y nueva fecha cuando hay revisión efectiva', () => {
    const result = reviewInventory(original, { physicalQuantity: 10, priceCents: 1300,
      reason: 'Conteo ficticio', actorUserId: 'actor1', at: '2026-11-12T00:00:00.000Z' });
    expect(result.inventory.physicalQuantity).toBe(10);
    expect(result.inventory.lastReviewedAt).toBe('2026-11-12T00:00:00.000Z');
    expect(result.movement.beforeQuantity).toBe(12);
    expect(result.movement.afterQuantity).toBe(10);
    expect(original.lastReviewedAt).toBe('2026-11-01T00:00:00.000Z');
  });
  it('rechaza cantidad menor que compromisos y precio negativo', () => {
    expect(() => reviewInventory(original, { physicalQuantity: 2, priceCents: 1300,
      reason: 'Conteo', actorUserId: 'actor1', at: '2026-11-12T00:00:00.000Z' })).toThrow();
    expect(() => reviewInventory(original, { physicalQuantity: 10, priceCents: -1,
      reason: 'Conteo', actorUserId: 'actor1', at: '2026-11-12T00:00:00.000Z' })).toThrow();
  });
  it('rechaza revisión sin motivo o fecha válida', () => {
    expect(() => reviewInventory(original, { physicalQuantity: 12, priceCents: 1500,
      reason: '', actorUserId: 'actor1', at: '2026-11-12T00:00:00.000Z' })).toThrow();
    expect(() => reviewInventory(original, { physicalQuantity: 12, priceCents: 1500,
      reason: 'Conteo', actorUserId: 'actor1', at: 'sin fecha' })).toThrow();
  });
});
