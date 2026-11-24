import type { ImportProfile, InventoryUnitOfWork } from './ports.js';
import { validateImportProfileName } from '../domain/importacion.js';

/** Profiles are private tenant configuration, never public catalog data. */
export class ImportProfiles {
  constructor(private readonly transactions: InventoryUnitOfWork) {}

  async list(secret: string, pharmacyId: string): Promise<readonly ImportProfile[]> {
    return this.transactions.run(secret, pharmacyId, 'inventory.import.preview', async ports => {
      if (!ports.imports.profiles) throw new Error('Perfiles no disponibles');
      return ports.imports.profiles();
    });
  }

  async save(secret: string, pharmacyId: string, importId: string, name: string): Promise<ImportProfile> {
    validateImportProfileName(name);
    return this.transactions.run(secret, pharmacyId, 'inventory.import.confirm', async ports => {
      if (!ports.imports.saveProfile) throw new Error('Perfiles no disponibles');
      return ports.imports.saveProfile(importId, name);
    });
  }
}
