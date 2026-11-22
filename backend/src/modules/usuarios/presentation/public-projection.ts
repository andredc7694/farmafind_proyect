import type { PharmacyReference } from '../domain/identity.js';

/** Only fields explicitly classified as public leave the identity boundary. */
export function publicPharmacyView(pharmacy: PharmacyReference): { id: string; name: string } {
  return { id: pharmacy.id, name: pharmacy.publicName };
}
