/** Immutable record of a confirmed inventory review. Persistence adds its own id. */
export interface InventoryMovement {
  readonly pharmacyId: string;
  readonly medicationId: string;
  readonly beforeQuantity: number;
  readonly afterQuantity: number;
  readonly beforePriceCents: number;
  readonly afterPriceCents: number;
  readonly reason: string;
  readonly actorUserId: string;
  readonly occurredAt: string;
}
