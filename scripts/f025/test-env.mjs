/** F02.5 uses a dedicated local TEST cluster, never the persistent F01 cluster. */
export const F025_TEST_MARKER = 'FarmaFind F07 TEST efimera';
export const F025_CLUSTER_NAME = 'farmafind-f025-test';
const testDatabase = /^farmafind_f01_test_[a-f0-9]{12}$/;

export function assertF025EphemeralDatabase(connectionString, { migration = false } = {}) {
  let url;
  try {
    url = new URL(connectionString);
  } catch {
    throw new Error('F02.5: URL de base TEST inválida');
  }
  const database = url.pathname.slice(1);
  if (!['postgres:', 'postgresql:'].includes(url.protocol) ||
      url.hostname !== '127.0.0.1' || url.port !== '55431' ||
      !testDatabase.test(database) || !url.username || !url.password ||
      url.search || url.hash) {
    throw new Error('F02.5: solo se admite una base TEST efímera local distinta de farmafind_f01_test');
  }
  if (migration && url.username !== 'f01_migrator') {
    throw new Error('F02.5: solo el rol de migración autorizado puede aplicar esquema TEST');
  }
  if (!migration && url.username === 'f01_migrator') {
    throw new Error('F02.5: la aplicación no puede usar credenciales de migración');
  }
  return database;
}

export function validateF025TestConfig(env) {
  const migrationUrl = env.F025_MIGRATION_DATABASE_URL;
  const authUrl = env.F025_AUTH_DATABASE_URL;
  const runtimeUrl = env.F025_RUNTIME_DATABASE_URL;
  const database = assertF025EphemeralDatabase(migrationUrl, { migration: true });
  if (assertF025EphemeralDatabase(authUrl) !== database ||
      assertF025EphemeralDatabase(runtimeUrl) !== database ||
      new URL(authUrl).username === new URL(runtimeUrl).username) {
    throw new Error('F02.5: conexiones TEST deben compartir base y separar roles auth/runtime');
  }
  return { database, migrationUrl, authUrl, runtimeUrl };
}

/** Verify the actual connected database before any F02.5 migration or privileged operation. */
export async function assertF025ConnectedTarget(client, expectedDatabase) {
  if (!testDatabase.test(expectedDatabase)) throw new Error('F02.5: nombre TEST inválido');
  const identity = await client.query(`SELECT current_database() AS database, current_user AS role,
    current_setting('cluster_name') AS cluster,
    (SELECT description FROM pg_shdescription
     WHERE objoid=(SELECT oid FROM pg_database WHERE datname=current_database())) AS marker`);
  const row = identity.rows[0];
  if (row?.database !== expectedDatabase || row?.marker !== F025_TEST_MARKER ||
      row?.cluster !== F025_CLUSTER_NAME ||
      !row.role || row.role === 'f01_runtime') {
    throw new Error('F02.5: conexión, rol o marca de base TEST no autorizados');
  }
  return { database: row.database, role: row.role };
}
