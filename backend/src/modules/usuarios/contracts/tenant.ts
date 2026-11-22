/** Public F01 port for authenticated, transaction-local tenant work. */
export type { IdentityTransaction } from '../application/ports.js';
export type { SqlClient } from '../infrastructure/db/tenant-transaction.js';
import type { IdentityTransaction } from '../application/ports.js';
import type { SqlClient } from '../infrastructure/db/tenant-transaction.js';

export interface VerifiedTenantTransactions {
  runWithClient<T>(sessionSecret: string,
    work: (transaction: IdentityTransaction, client: SqlClient, actorUserId: string) => Promise<T>): Promise<T>;
}
