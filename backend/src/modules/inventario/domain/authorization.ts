export const INVENTORY_CAPABILITIES = [
  'inventory.read',
  'inventory.write',
  'inventory.import.preview',
  'inventory.import.confirm',
  'inventory.history',
] as const;

export type InventoryCapability = (typeof INVENTORY_CAPABILITIES)[number];

export interface InventoryAuthorization {
  readonly authenticated: boolean;
  readonly membershipActive: boolean;
  readonly pharmacyActive: boolean;
  readonly actorRole: string;
  readonly selectedPharmacyId: string;
  readonly resourcePharmacyId: string;
  readonly capabilities: readonly string[];
}

/** A role identifies eligibility; only a live, scoped, explicit capability grants an action. */
export function canUseInventory(context: InventoryAuthorization, capability: InventoryCapability): boolean {
  return context.authenticated && context.membershipActive && context.pharmacyActive &&
    (context.actorRole === 'DUENO' || context.actorRole === 'ADMINISTRADOR') &&
    context.selectedPharmacyId === context.resourcePharmacyId &&
    context.capabilities.includes(capability);
}
