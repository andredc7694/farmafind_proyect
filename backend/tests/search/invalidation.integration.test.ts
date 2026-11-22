import { describe, expect, it, vi } from 'vitest';
import { ManualInventory } from '../../src/modules/inventario/application/manual-review.js';

describe('invalidación post-commit F03', () => {
  it('invalida solo después de una revisión confirmada', async () => {
    const events: string[] = [];
    const transactions = { run: vi.fn(async (_secret, _pharmacy, _capability, work) => {
      events.push('transaction');
      return work({ inventory: { review: async () => ({ id: 'i' }) } }, { actorUserId: 'u' });
    }) };
    const service = new ManualInventory(transactions as never, { invalidate: async () => { events.push('invalidate'); } });
    await service.review('s', 'f', 'm', { priceCents: 10, physicalQuantity: 1, reason: 'Prueba' });
    expect(events).toEqual(['transaction','invalidate']);
  });
  it('no invalida si la transacción falla', async () => {
    const invalidate = vi.fn();
    const service = new ManualInventory({ run: vi.fn().mockRejectedValue(new Error('rollback')) } as never, { invalidate });
    await expect(service.review('s','f','m',{ priceCents: 1, physicalQuantity: 1, reason: 'Prueba' })).rejects.toThrow();
    expect(invalidate).not.toHaveBeenCalled();
  });
});
