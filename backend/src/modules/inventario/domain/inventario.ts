import type { InventoryMovement } from './movimiento.js';

export interface InventoryState {
  readonly pharmacyId: string;
  readonly medicationId: string;
  readonly physicalQuantity: number;
  readonly committedQuantity: number;
  readonly priceCents: number;
  readonly lastReviewedAt: string | null;
}

export interface InventoryReview {
  readonly physicalQuantity: number;
  readonly priceCents: number;
  readonly reason: string;
  readonly actorUserId: string;
  readonly at: string;
}

export function reviewInventory(before: InventoryState, change: InventoryReview):
  { readonly inventory: InventoryState; readonly movement: InventoryMovement } {
  if (!Number.isSafeInteger(before.committedQuantity) || before.committedQuantity < 0 ||
      !Number.isSafeInteger(change.physicalQuantity) || change.physicalQuantity < before.committedQuantity ||
      !Number.isSafeInteger(change.priceCents) || change.priceCents < 0 ||
      !change.reason.trim() || change.reason.length > 500 || !change.actorUserId.trim() ||
      !Number.isFinite(Date.parse(change.at))) {
    throw new Error('Revisión de inventario inválida');
  }
  const inventory: InventoryState = { ...before, physicalQuantity: change.physicalQuantity,
    priceCents: change.priceCents, lastReviewedAt: new Date(change.at).toISOString() };
  const movement: InventoryMovement = {
    pharmacyId: before.pharmacyId, medicationId: before.medicationId,
    beforeQuantity: before.physicalQuantity, afterQuantity: change.physicalQuantity,
    beforePriceCents: before.priceCents, afterPriceCents: change.priceCents,
    reason: change.reason.trim(), actorUserId: change.actorUserId,
    occurredAt: inventory.lastReviewedAt!,
  };
  return { inventory, movement };
}
