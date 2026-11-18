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

/** Every test owns a fresh database and login role. The persistent TEST database is read only. */
export async function createConversationRealFixture() {
  const raw = process.env.F01_TEST_DATABASE_URL;
  if (!raw) throw new Error('F06.1: falta URL PostgreSQL TEST');
  const url = new URL(raw);
  if (url.hostname !== '127.0.0.1' || url.port !== '55431' || url.pathname !== '/farmafind_f01_test') {
    throw new Error('F06.1: solo se permite PostgreSQL TEST local');
  }
  const suffix = randomBytes(6).toString('hex');
  // Reuse the strict F01 migration allowlist; the random suffix keeps this database isolated.
  const databaseName = `farmafind_f01_test_${suffix}`;
  const roleName = `f061_runtime_${suffix}`;
  const password = randomBytes(32).toString('hex');
  const base = await connect(raw);
  let database: Client | undefined;
  let runtime: Pool | undefined;
  let databaseCreated = false;
  let roleCreated = false;
  const baseCounts = async () => (await base.query(`SELECT
    (SELECT count(*)::int FROM f01.usuario) users,
    (SELECT count(*)::int FROM f01.sesion) sessions,
    (SELECT count(*)::int FROM f01.farmacia_referencia) pharmacies,
    (SELECT count(*)::int FROM f01.usuario_farmacia) memberships`)).rows[0];
  let before: Record<string, number> | undefined;
  const close = async () => {
    try {
      if (runtime) await runtime.end();
      if (database) await database.end();
      if (databaseCreated) await base.query(`DROP DATABASE "${databaseName}"`);
      if (roleCreated) await base.query(`DROP ROLE "${roleName}"`);
      if (before && JSON.stringify(await baseCounts()) !== JSON.stringify(before)) {
        throw new Error('F06.1: cambió la base persistente');
      }
    } finally { await base.end(); }
  };
  try {
    before = await baseCounts();
    await base.query(`CREATE DATABASE "${databaseName}"`);
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
