import type { VerifiedTenantTransactions, SqlClient } from '../../usuarios/contracts/tenant.js';
import { authorizeInventoryContext, type AuthorizedInventoryContext } from '../application/authorized-context.js';
import type { InventoryCapability } from '../domain/authorization.js';
import type { InventoryUnitOfWork, InventoryOperationPorts } from '../application/ports.js';
import { PgInventoryRepository } from './inventory-repository.js';
import { PgImportRepository } from './import-repository.js';
import { parseInventoryFile } from './file-parser.js';
import { createMedicationReference, type MedicationReference } from '../../medicamentos/contracts/reference.js';

/** Shares one verified F01 transaction and pool client; RLS independently checks the context. */
export class PgInventoryTenantRunner implements InventoryUnitOfWork {
  constructor(private readonly identity: VerifiedTenantTransactions) {}

  run<T>(sessionSecret: string, pharmacyId: string, capability: InventoryCapability,
    work: (ports: InventoryOperationPorts, context: AuthorizedInventoryContext) => Promise<T>): Promise<T> {
    return this.identity.runWithClient(sessionSecret, async (transaction, client, actorUserId) => {
      const context = await authorizeInventoryContext(transaction, actorUserId, pharmacyId, capability);
      const ports: InventoryOperationPorts = {
        inventory: new PgInventoryRepository(client, pharmacyId),
        imports: new PgImportRepository(client, pharmacyId, actorUserId),
        parseFile: parseInventoryFile,
        lookupReferences: async (names: readonly string[]): Promise<readonly MedicationReference[]> => {
          const result = await client.query(`SELECT id,nombre,concentracion,presentacion,clasificacion
            FROM f02.medicamento WHERE estado='ACTIVO' AND nombre=ANY($1::text[])`, [names]);
          return result.rows.map(row => ({ ...createMedicationReference({
            name: String(row.nombre), concentration: String(row.concentracion),
            presentation: String(row.presentacion), classification: String(row.clasificacion),
          }), id: String(row.id) }));
        },
      };
      return work(ports, context);
    });
  }
}
