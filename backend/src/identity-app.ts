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
import { ListCatalog } from './modules/medicamentos/application/list-catalog.js';
import { createCatalogRouter } from './modules/medicamentos/presentation/catalog-router.js';
import { AuthorizedCatalogReader } from './modules/medicamentos/infrastructure/authorized-catalog.js';
import { PgInventoryTenantRunner } from './modules/inventario/infrastructure/tenant-unit-of-work.js';
import { ManualInventory } from './modules/inventario/application/manual-review.js';
import { createInventoryRouter } from './modules/inventario/presentation/inventory-router.js';
import { PreviewImport } from './modules/inventario/application/preview-import.js';
import { ConfirmImport } from './modules/inventario/application/confirm-import.js';
import { createImportRouter } from './modules/inventario/presentation/import-router.js';
import { createClient, type RedisClientType } from 'redis';
import type { SearchRuntimeConfig } from './config/search.js';
import { PgPublicOfferRepository } from './modules/busqueda/infrastructure/public-offer-repository.js';
import { RedisSearchCache } from './modules/busqueda/infrastructure/redis-search-cache.js';
import { RedisSearchInvalidator } from './modules/busqueda/infrastructure/search-invalidator.js';
import { SearchPublicOffers } from './modules/busqueda/application/search-public-offers.js';
import { createPublicSearchRouter } from './modules/busqueda/presentation/public-search-router.js';
import { createPublicPharmacyRouter } from './modules/busqueda/presentation/public-pharmacy-router.js';
import { InMemorySearchMetrics } from './modules/busqueda/infrastructure/in-memory-search-metrics.js';
import { PgReservationUnitOfWork } from './modules/reservas/infrastructure/reservation-unit-of-work.js';
import { CreateReservation } from './modules/reservas/application/create-reservation.js';
import { ListOwnReservations } from './modules/reservas/application/list-own-reservations.js';
import { CancelReservation } from './modules/reservas/application/cancel-reservation.js';
import { ManagePickupWindow } from './modules/reservas/application/manage-pickup-window.js';
import { ConfirmReservation } from './modules/reservas/application/confirm-reservation.js';
import { ReportPhysicalShortage } from './modules/reservas/application/report-physical-shortage.js';
import { DeliverReservation } from './modules/reservas/application/deliver-reservation.js';
import { createCustomerReservationsRouter } from './modules/reservas/presentation/customer-reservations-router.js';
import { createPharmacyReservationsRouter } from './modules/reservas/presentation/pharmacy-reservations-router.js';
import type { ReservationRuntimeConfig } from './config/reservations.js';

export interface LocalIdentityRuntimeConfig {
  authDatabaseUrl: string;
  tenantDatabaseUrl: string;
  csrfKey: Buffer;
  abuseKey: Buffer;
  allowedOrigin: string;
  cookieSecure: false;
  search?: SearchRuntimeConfig;
  reservations?: ReservationRuntimeConfig;
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
  let redisClient: RedisClientType | null = null;
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
    app.use('/api/v1', createCatalogRouter(new ListCatalog(new AuthorizedCatalogReader(tenantTransactions)), http));
    const inventoryTransactions = new PgInventoryTenantRunner(tenantTransactions);
    let invalidator = undefined;
    if (config.search) {
      redisClient = createClient({ url: config.search.redisUrl, socket: { connectTimeout: config.search.cacheTimeoutMs,
        reconnectStrategy: false } });
      redisClient.on('error', () => undefined);
      const repository = new PgPublicOfferRepository(tenantPool);
      const cache = new RedisSearchCache(redisClient, config.search.cacheTimeoutMs);
      invalidator = new RedisSearchInvalidator(redisClient);
      const search = new SearchPublicOffers(repository, cache, { ttlSeconds: config.search.cacheTtlSeconds,
        candidateLimit: config.search.candidateLimit }, new InMemorySearchMetrics());
      app.use('/api/v1', createPublicSearchRouter(search));
      app.use('/api/v1', createPublicPharmacyRouter(repository));
    }
    app.use('/api/v1', createInventoryRouter(new ManualInventory(inventoryTransactions, invalidator), http));
    app.use('/api/v1', createImportRouter(new PreviewImport(inventoryTransactions),
      new ConfirmImport(inventoryTransactions, invalidator), http));
    if (config.reservations) {
      const reservationTransactions = new PgReservationUnitOfWork(tenantTransactions);
      const clock = { now: () => new Date() };
      const create = new CreateReservation(reservationTransactions, clock, config.reservations.pendingMinutes);
      const own = new ListOwnReservations(reservationTransactions);
      const cancel = new CancelReservation(reservationTransactions, clock);
      const settings = new ManagePickupWindow(reservationTransactions);
      const confirm = new ConfirmReservation(reservationTransactions, clock);
      const shortage = new ReportPhysicalShortage(reservationTransactions, clock);
      const deliver = new DeliverReservation(reservationTransactions, clock);
      app.use('/api/v1', createCustomerReservationsRouter({ create, own, cancel }, http));
      app.use('/api/v1', createPharmacyReservationsRouter({ confirm, settings, shortage, deliver }, http));
    }
    return {
      app,
      close: async () => {
        if (redisClient?.isOpen) await redisClient.quit();
        await Promise.all([authPool.end(), tenantPool.end()]);
      },
    };
  } catch {
    if (redisClient?.isOpen) await redisClient.quit();
    await Promise.all([authPool.end(), tenantPool.end()]);
    throw new Error('F01: no se pudo iniciar la composición local; revisar configuración y roles');
  }
}
