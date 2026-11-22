import { randomBytes, randomUUID } from 'node:crypto';
import { Client, Pool } from 'pg';
import { migrateTestDatabase } from '../../../src/modules/usuarios/infrastructure/db/migrate.js';
import { migrateF02TestDatabase } from '../../../src/modules/inventario/infrastructure/migrate.js';
import { migrateF03TestDatabase } from '../../../src/modules/busqueda/infrastructure/migrate.js';

const connect = async (connectionString: string) => {
  const client = new Client({ connectionString });
  await client.connect();
  return client;
};

/** Every test owns a fresh child database and login role under an explicitly marked F06.1 TEST mother. */
export async function createConversationRealFixture() {
  const raw = process.env.F061_TEST_BASE_URL;
  if (!raw) throw new Error('F06.1: falta URL de base madre TEST exclusiva');
  const url = new URL(raw);
  if (!['postgres:','postgresql:'].includes(url.protocol) || url.hostname !== '127.0.0.1' ||
      url.port !== '55431' || url.pathname !== '/farmafind_f061_fixture_test' ||
      url.username !== 'f01_migrator' || !url.password || url.search || url.hash) {
    throw new Error('F06.1: solo se permite madre TEST exclusiva en loopback');
  }
  const suffix = randomBytes(6).toString('hex');
  // F01/F02/F03 migrators accept only this child-name pattern; never the mother.
  const databaseName = `farmafind_f01_test_${suffix}`;
  const roleName = `f061_runtime_${suffix}`;
  const marker = `FarmaFind F061 fixture ${suffix}`;
  const password = randomBytes(32).toString('hex');
  const base = await connect(raw);
  let database: Client | undefined;
  let runtime: Pool | undefined;
  let databaseCreated = false;
  let roleCreated = false;
  const motherIdentity = async () => (await base.query(`SELECT current_database() AS database,
    current_user AS role, current_setting('cluster_name') AS cluster,
    (SELECT description FROM pg_shdescription WHERE objoid=(SELECT oid FROM pg_database
      WHERE datname=current_database())) AS marker`)).rows[0];
  const assertMother = async () => {
    const identity = await motherIdentity();
    if (identity?.database !== 'farmafind_f061_fixture_test' || identity?.role !== 'f01_migrator' ||
        identity?.cluster !== 'farmafind-f025-test' || identity?.marker !== 'FarmaFind F061 TEST fixture') {
      throw new Error('F06.1: madre TEST sin identidad verificada');
    }
  };
  const ownDatabase = async () => (await base.query(`SELECT description FROM pg_shdescription
    WHERE objoid=(SELECT oid FROM pg_database WHERE datname=$1)`,[databaseName])).rows[0]?.description === marker;
  const ownRole = async () => (await base.query(`SELECT description FROM pg_shdescription
    WHERE objoid=(SELECT oid FROM pg_roles WHERE rolname=$1)`,[roleName])).rows[0]?.description === marker;
  const close = async () => {
    try {
      if (runtime) await runtime.end();
      if (database) await database.end();
      await assertMother();
      if (databaseCreated) {
        if (!await ownDatabase()) throw new Error('F06.1: hijo sin marca propia; limpieza rechazada');
        await base.query(`DROP DATABASE "${databaseName}"`);
      }
      if (roleCreated) {
        if (!await ownRole()) throw new Error('F06.1: rol sin marca propia; limpieza rechazada');
        await base.query(`DROP ROLE "${roleName}"`);
      }
    } finally { await base.end(); }
  };
  try {
    await assertMother();
    await base.query(`CREATE DATABASE "${databaseName}"`);
    await base.query(`COMMENT ON DATABASE "${databaseName}" IS '${marker}'`);
    databaseCreated = true;
    url.pathname = `/${databaseName}`;
    database = await connect(url.toString());
    await migrateTestDatabase(url.toString(), connect);
    await migrateF02TestDatabase(url.toString(), connect);
    await migrateF03TestDatabase(url.toString(), connect);
    const alpha = randomUUID();
    const beta = randomUUID();
    const product = `producto f061 ${suffix}`;
    await database.query(`INSERT INTO f01.farmacia_referencia(id,nombre_publico,estado)
      VALUES($1,'Farmacia Alfa','ACTIVA'),($2,'Farmacia Beta','ACTIVA')`, [alpha, beta]);
    await database.query(`INSERT INTO f03.farmacia_publica(farmacia_id,direccion_texto)
      VALUES($1,'Alfa TEST'),($2,'Beta TEST')`, [alpha, beta]);
    const medication = (await database.query(`INSERT INTO f02.medicamento
      (nombre,principio_activo,concentracion,presentacion,clasificacion)
      VALUES($1,'compuesto ficticio','10 mg','tabletas','venta libre') RETURNING id`, [product])).rows[0].id;
    await database.query(`INSERT INTO f02.inventario
      (farmacia_id,medicamento_id,precio_centavos,cantidad_fisica,cantidad_comprometida,ultima_revision_at)
      VALUES($1,$3,1200,5,1,now()),($2,$3,1300,6,2,now())`, [alpha, beta, medication]);
    await base.query(`CREATE ROLE "${roleName}" LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE PASSWORD '${password}'`);
    await base.query(`COMMENT ON ROLE "${roleName}" IS '${marker}'`);
    roleCreated = true;
    await base.query(`GRANT f01_runtime TO "${roleName}"`);
    url.username = roleName;
    url.password = password;
    runtime = new Pool({ connectionString: url.toString(), max: 2 });
    await runtime.query('SELECT 1');
    return { base, database, runtime, roleName, alpha, beta, product, close };
  } catch (error) {
    await close();
    throw error;
  }
}
