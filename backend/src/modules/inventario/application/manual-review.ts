import { NO_INVENTORY_SEARCH_INVALIDATOR, type InventorySearchInvalidator, type InventoryUnitOfWork, type InventoryRow } from './ports.js';

export class ManualInventory {
  constructor(private readonly transactions: InventoryUnitOfWork,
    private readonly searchInvalidator: InventorySearchInvalidator = NO_INVENTORY_SEARCH_INVALIDATOR) {}

  list(secret: string, pharmacyId: string): Promise<readonly InventoryRow[]> {
    return this.transactions.run(secret, pharmacyId, 'inventory.read', async ports => ports.inventory.list());
  }

  movements(secret: string, pharmacyId: string): Promise<readonly Record<string, unknown>[]> {
    return this.transactions.run(secret, pharmacyId, 'inventory.history', async ports => ports.inventory.movements());
  }

  async review(secret: string, pharmacyId: string, medicationId: string,
    input: { readonly priceCents: number; readonly physicalQuantity: number; readonly reason: string }): Promise<InventoryRow> {
    const result = await this.transactions.run(secret, pharmacyId, 'inventory.write', async (ports, context) =>
      ports.inventory.review(medicationId, {
        priceCents: input.priceCents, physicalQuantity: input.physicalQuantity,
        reason: input.reason, actorUserId: context.actorUserId, at: new Date().toISOString(),
      }));
    await this.searchInvalidator.invalidate();
    return result;
  }
}
