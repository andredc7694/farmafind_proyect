import { describe, expect, it, vi } from 'vitest';
import { ConfirmImport, ImportConflictError } from '../../src/modules/inventario/application/confirm-import.js';
import type { InventoryUnitOfWork } from '../../src/modules/inventario/application/ports.js';

describe('F02.1: confirmación íntegra', () => {
  it('rechaza un archivo con incidencia persistida antes de revisar stock', async () => {
    const record = { id: 'import-a', pharmacyId: 'alfa', actorUserId: 'user-a',
      state: 'VISTA_PREVIA', errorCount: 0, createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 60000).toISOString(), confirmedAt: null };
    const review = vi.fn();
    const transition = vi.fn().mockResolvedValue(true);
    let state = record.state;
    transition.mockImplementation(async (_id, next) => { state = next; return true; });
    const imports = {
      find: vi.fn(async () => ({ ...record, state })),
      rows: vi.fn().mockResolvedValue([{ line: 2, medicationId: 'med-a',
        priceCents: 1200, physicalQuantity: 3, errorCode: null }]),
      incidents: vi.fn().mockResolvedValue([{ line: 2, code: 'PRECIO_INVALIDO' }]),
      transition,
    };
    const run = vi.fn(async (_secret, _pharmacy, _capability, work) =>
      work({ imports, inventory: { review } }, { actorUserId: 'user-a' }));
    const service = new ConfirmImport({ run } as unknown as InventoryUnitOfWork);
    await expect(service.confirm('session-a', 'alfa', 'import-a')).rejects.toBeInstanceOf(ImportConflictError);
    expect(review).not.toHaveBeenCalled();
    expect(transition).toHaveBeenCalledWith('import-a', 'RECHAZADA');
  });
});
