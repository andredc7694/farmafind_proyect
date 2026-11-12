import { createApp } from './app.js';
import { Argon2PasswordHasher } from './modules/usuarios/infrastructure/argon2-password.js';
import { PgAuthUnitOfWork } from './modules/usuarios/infrastructure/db/auth-transaction.js';
import { PgIdentityUnitOfWork } from './modules/usuarios/infrastructure/db/tenant-transaction.js';
import { IdentityUseCases } from './modules/usuarios/application/identity-use-cases.js';
import { ActivePharmacyService } from './modules/usuarios/application/active-pharmacy.js';
import { ManageMemberships } from './modules/usuarios/application/manage-memberships.js';
import { createIdentityRouter } from './modules/usuarios/presentation/auth-router.js';
import { createMembershipRouter } from './modules/usuarios/presentation/membership-router.js';
import { createAdminMembershipRouter } from './modules/usuarios/presentation/admin-memberships-router.js';

export interface LocalIdentityRuntimeConfig {
  authDatabaseUrl: string;
  tenantDatabaseUrl: string;
  csrfKey: Buffer;
  abuseKey: Buffer;
  allowedOrigin: string;
  cookieSecure: false;
}

interface SqlClient {
  query(sql: string, values?: unknown[]): Promise<{ rows: Array<Record<string, unknown>> }>;
  release(discard?: boolean): void;
}

interface SqlPool {
  query(sql: string, values?: unknown[]): Promise<{ rows: Array<Record<string, unknown>> }>;
  connect(): Promise<SqlClient>;
  end(): Promise<void>;
}

async function verifyPool(pool: SqlPool, required: 'f01_auth' | 'f01_runtime', forbidden: 'f01_auth' | 'f01_runtime'): Promise<void> {
  const result = await pool.query(`SELECT rolsuper, rolbypassrls,
    pg_has_role(session_user,$1,'member') AS permitted,
    pg_has_role(session_user,$2,'member') AS forbidden
    FROM pg_roles WHERE rolname=session_user`, [required, forbidden]);
  const row = result.rows[0];
  if (result.rows.length !== 1 || row.rolsuper !== false || row.rolbypassrls !== false ||
      row.permitted !== true || row.forbidden !== false) {
    throw new Error('F01: credenciales locales sin separación de roles o con privilegios excesivos');
  }
}

/** Compose identity, own memberships and EXC-01/ROL-01 local worker routes only. */
export async function createLocalIdentityApp(config: LocalIdentityRuntimeConfig, createPool: (url: string) => SqlPool) {
  const authPool = createPool(config.authDatabaseUrl);
  const tenantPool = createPool(config.tenantDatabaseUrl);
  try {
    await verifyPool(authPool, 'f01_auth', 'f01_runtime');
    await verifyPool(tenantPool, 'f01_runtime', 'f01_auth');
    const hasher = new Argon2PasswordHasher();
    const dummyHash = await hasher.hash('f01-dummy-password-never-used-for-login');
    const identity = new IdentityUseCases(new PgAuthUnitOfWork(authPool, config.abuseKey),
      hasher, { now: () => new Date() }, dummyHash);
    const tenantTransactions = new PgIdentityUnitOfWork(tenantPool);
    const memberships = new ActivePharmacyService(tenantTransactions);
    const management = new ManageMemberships(tenantTransactions);
    const http = { allowedOrigin: config.allowedOrigin, csrfKey: config.csrfKey, cookieSecure: config.cookieSecure };
    const app = createApp(createIdentityRouter(identity, http), createMembershipRouter(identity, memberships, http));
    app.use('/api/v1', createAdminMembershipRouter(identity, management, http));
    return {
      app,
      close: async () => { await Promise.all([authPool.end(), tenantPool.end()]); },
    };
  } catch {
    await Promise.all([authPool.end(), tenantPool.end()]);
    throw new Error('F01: no se pudo iniciar la composición local; revisar configuración y roles');
  }
}
