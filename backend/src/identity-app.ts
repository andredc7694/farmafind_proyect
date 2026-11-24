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
import { createRestrictedSessionGuard } from './modules/usuarios/presentation/auth-middleware.js';
import { MfaUseCases } from './modules/usuarios/application/mfa.js';
import { OwnProfileUseCases } from './modules/usuarios/application/profile.js';
import { createProfileRouter } from './modules/usuarios/presentation/profile-router.js';
import { createMfaRouter } from './modules/usuarios/presentation/mfa-router.js';
import { SecretBox } from './modules/usuarios/infrastructure/secret-box.js';
import { createStaffRouter } from './modules/usuarios/presentation/staff-router.js';
import { ManageStaff } from './modules/usuarios/application/manage-staff.js';
import { ManageStaffAccess } from './modules/usuarios/application/manage-staff-access.js';
import { AccountRecovery } from './modules/usuarios/application/account-recovery.js';
import type { AccountMessageDelivery } from './modules/usuarios/application/account-messages.js';
import { createStaffAccessRouter } from './modules/usuarios/presentation/staff-access-router.js';
import { PgStaffUnitOfWork } from './modules/usuarios/infrastructure/staff-unit-of-work.js';
import { ManagePlatformAuthorizations } from './modules/usuarios/application/manage-platform-authorizations.js';
import { PgPlatformAuthorizationUnitOfWork } from './modules/usuarios/infrastructure/platform-authorization-repository.js';
import { createPlatformAuthorizationRouter } from './modules/usuarios/presentation/platform-authorization-router.js';
import { ListCatalog } from './modules/medicamentos/application/list-catalog.js';
import { createCatalogRouter } from './modules/medicamentos/presentation/catalog-router.js';
import { AuthorizedCatalogReader } from './modules/medicamentos/infrastructure/authorized-catalog.js';
import { PgInventoryTenantRunner } from './modules/inventario/infrastructure/tenant-unit-of-work.js';
import { ManualInventory } from './modules/inventario/application/manual-review.js';
import { createInventoryRouter } from './modules/inventario/presentation/inventory-router.js';
import { PreviewImport } from './modules/inventario/application/preview-import.js';
import { ConfirmImport } from './modules/inventario/application/confirm-import.js';
import { createImportRouter } from './modules/inventario/presentation/import-router.js';
import { ImportProfiles } from './modules/inventario/application/import-profiles.js';
import { InspectImport } from './modules/inventario/application/inspect-import.js';
import { inspectInventoryFile, selectInventoryFile } from './modules/inventario/infrastructure/file-parser.js';
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
import { AttentionCenter } from './modules/reservas/application/attention-center.js';
import { createPharmacyReservationsRouter } from './modules/reservas/presentation/pharmacy-reservations-router.js';
import type { ReservationRuntimeConfig } from './config/reservations.js';
import { MockAIProvider } from './modules/asistente-ia/infrastructure/mock-ai-provider.js';
import { F03PublicKnowledgeTools } from './modules/asistente-ia/infrastructure/public-knowledge-tools.js';
import { InMemoryAssistantMetrics } from './modules/asistente-ia/infrastructure/assistant-metrics.js';
import { QueryAssistant } from './modules/asistente-ia/application/query-assistant.js';
import { createAssistantRouter } from './modules/asistente-ia/presentation/assistant-router.js';
import { F03PublicAssistantGateway } from './modules/busqueda/infrastructure/public-assistant-gateway.js';
import { ConverseAssistant } from './modules/asistente-ia/application/converse-assistant.js';
import { selectDemoConversationProvider } from './modules/asistente-ia/infrastructure/demo-conversation-provider.js';
import { InMemoryReviewedSourceCatalog } from './modules/asistente-ia/infrastructure/reviewed-source-catalog.js';
import { InMemoryConversationStore } from './modules/asistente-ia/infrastructure/in-memory-conversation-store.js';
import { createConversationRouter } from './modules/asistente-ia/presentation/conversation-router.js';
import { F03ConversationPublicTools } from './modules/asistente-ia/infrastructure/conversation-public-tools.js';
import { ListNearbyPharmacies } from './modules/busqueda/application/list-nearby-pharmacies.js';
import { createGeolocationRouter } from './modules/busqueda/presentation/geolocation-router.js';
import { PgLocationUnitOfWork } from './modules/farmacias/infrastructure/location-unit-of-work.js';
import { ManagePharmacyLocation } from './modules/farmacias/application/manage-pharmacy-location.js';
import { createLocationRouter } from './modules/farmacias/presentation/location-router.js';
import { PgPharmacyUnitOfWork } from './modules/farmacias/infrastructure/pharmacy-unit-of-work.js';
import { ManageApplications } from './modules/farmacias/application/manage-applications.js';
import { createPharmacyApplicationRouter } from './modules/farmacias/presentation/application-router.js';
import { ReviewApplications } from './modules/farmacias/application/review-applications.js';
import { createPlatformApplicationsRouter } from './modules/farmacias/presentation/platform-applications-router.js';
import { TestDocumentService } from './modules/farmacias/infrastructure/test-document-service.js';
import { createTestDocumentRouter } from './modules/farmacias/presentation/test-document-router.js';
import { PharmacyPublicationInvalidator } from './modules/farmacias/infrastructure/publication-invalidator.js';
import { ManagePharmacyProfile } from './modules/farmacias/application/manage-pharmacy-profile.js';
import { createPharmacyProfileRouter } from './modules/farmacias/presentation/pharmacy-profile-router.js';

export interface LocalIdentityRuntimeConfig {
  authDatabaseUrl: string;
  tenantDatabaseUrl: string;
  csrfKey: Buffer;
  abuseKey: Buffer;
  allowedOrigin: string;
  cookieSecure: false;
  /** F01.1: entrega de mensajes de cuenta. En TEST, el simulador local; sin él no se envía nada. */
  accountMessages?: AccountMessageDelivery;
  /** F01.1 US4: clave de cifrado del secreto TOTP (32 bytes). Sin ella no se montan las rutas del segundo factor. */
  mfaKey?: Buffer;
  search?: SearchRuntimeConfig;
  reservations?: ReservationRuntimeConfig;
  /** F07 is limited to isolated local TEST databases until persistent migration is authorized. */
  geolocationTest?: true;
  /** F02.5 routes are never mounted on persistent or production databases. */
  pharmaciesTest?: true;
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
    if (config.geolocationTest && (!config.search ||
        !/^\/farmafind_f01_test_[a-f0-9]{12}$/.test(new URL(config.tenantDatabaseUrl).pathname) ||
        new URL(config.authDatabaseUrl).pathname !== new URL(config.tenantDatabaseUrl).pathname)) {
      throw new Error('F07: solo base TEST aislada con búsqueda pública F03');
    }
    const geoRepository=config.geolocationTest ? new PgPublicOfferRepository(tenantPool) : null;
    const geoRouter=geoRepository ? createGeolocationRouter(new ListNearbyPharmacies(geoRepository)) : undefined;
    // F01.1: la guardia de sesión restringida se monta antes que cualquier ruta de negocio.
    const restrictedGuard = createRestrictedSessionGuard({ ...http, prefix: '/api/v1', restrictionOf: secret => identity.restrictionOf(secret) });
    const app = createApp(createIdentityRouter(identity, http, new AccountRecovery(new PgAuthUnitOfWork(authPool, config.abuseKey), hasher,
      { now: () => new Date() }, config.accountMessages ?? null)), createMembershipRouter(identity, memberships, http),geoRouter,restrictedGuard);
    let invalidator: RedisSearchInvalidator | undefined;
    if(config.pharmaciesTest){
      const authUrl=new URL(config.authDatabaseUrl),tenantUrl=new URL(config.tenantDatabaseUrl);
      if(!/^\/farmafind_f01_test_[a-f0-9]{12}$/.test(tenantUrl.pathname)||
        authUrl.pathname!==tenantUrl.pathname||authUrl.hostname!=='127.0.0.1'||
        tenantUrl.hostname!=='127.0.0.1'||authUrl.port!=='55431'||tenantUrl.port!=='55431')
        throw new Error('F02.5: solo base TEST efímera local');
      const result=await tenantPool.query(`SELECT current_setting('cluster_name') AS cluster,
        (SELECT description FROM pg_shdescription WHERE objoid=(SELECT oid FROM pg_database
          WHERE datname=current_database())) AS marker`);
      if(result.rows[0]?.cluster!=='farmafind-f025-test'||
        result.rows[0]?.marker!=='FarmaFind F07 TEST efimera')
        throw new Error('F02.5: clúster TEST no autorizado');
      const pharmacyWork=new PgPharmacyUnitOfWork(tenantTransactions);
      app.use('/api/v1',createPharmacyApplicationRouter(identity,
        new ManageApplications(pharmacyWork),http));
      app.use('/api/v1',createPlatformApplicationsRouter(identity,
        new ReviewApplications(pharmacyWork,new PharmacyPublicationInvalidator(()=>invalidator)),http));
      app.use('/api/v1',createTestDocumentRouter(new TestDocumentService(pharmacyWork),http));
      app.use('/api/v1',createPharmacyProfileRouter(new ManagePharmacyProfile(tenantTransactions),http));
    }
    app.use('/api/v1', createAdminMembershipRouter(identity, management, http));
    const staffTransactions = new PgStaffUnitOfWork(tenantTransactions);
    app.use('/api/v1', createStaffRouter(identity, new ManageStaff(staffTransactions, hasher), http));
    app.use('/api/v1', createStaffAccessRouter(identity, new ManageStaffAccess(staffTransactions), http));
    const platformManagement = new ManagePlatformAuthorizations(new PgPlatformAuthorizationUnitOfWork(tenantTransactions));
    app.use('/api/v1', createProfileRouter(new OwnProfileUseCases(new PgAuthUnitOfWork(authPool, config.abuseKey), hasher,
      { now: () => new Date() }, config.accountMessages ?? null), http));
    if (config.mfaKey) {
      app.use('/api/v1', createMfaRouter(new MfaUseCases(new PgAuthUnitOfWork(authPool, config.abuseKey),
        new SecretBox(config.mfaKey), { now: () => new Date() }), http));
    }
    app.use('/api/v1', createPlatformAuthorizationRouter(identity, platformManagement, http));
    app.use('/api/v1', createCatalogRouter(new ListCatalog(new AuthorizedCatalogReader(tenantTransactions)), http));
    const inventoryTransactions = new PgInventoryTenantRunner(tenantTransactions);
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
      const publicGateway = new F03PublicAssistantGateway(search, repository);
      const publicTools = new F03PublicKnowledgeTools(publicGateway);
      const assistant = new QueryAssistant(new MockAIProvider(), publicTools, new InMemoryAssistantMetrics());
      app.use('/api/v1', createAssistantRouter(assistant));
      // Real pharmacological content is deliberately unavailable until licensed and reviewed.
      const selectedConversation = selectDemoConversationProvider(process.env.FARMAFIND_AI_PROVIDER);
      if (selectedConversation.externalSelectionRejected) {
        // Reject an external selection locally; keep F03 and the deterministic assistant available.
        console.warn('F06.1: proveedor externo deshabilitado; modo DEMO determinista activo');
      }
      app.use('/api/v1', createConversationRouter(new ConverseAssistant(selectedConversation.provider,
        new InMemoryReviewedSourceCatalog([]), new F03ConversationPublicTools(publicGateway), new InMemoryConversationStore())));
    }
    if (config.geolocationTest) {
      app.use('/api/v1', createLocationRouter(identity,
        new ManagePharmacyLocation(new PgLocationUnitOfWork(tenantTransactions), invalidator), http));
    }
    app.use('/api/v1', createInventoryRouter(new ManualInventory(inventoryTransactions, invalidator), http));
    const previewImport = new PreviewImport(inventoryTransactions);
    app.use('/api/v1', createImportRouter(previewImport,
      new ConfirmImport(inventoryTransactions, invalidator), http, new ImportProfiles(inventoryTransactions),
      new InspectImport(previewImport, { inspect: inspectInventoryFile, select: selectInventoryFile })));
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
      app.use('/api/v1', createPharmacyReservationsRouter({ confirm, settings, shortage, deliver, center: new AttentionCenter(reservationTransactions, clock) }, http));
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
