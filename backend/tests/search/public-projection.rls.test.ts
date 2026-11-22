import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client } from 'pg';
import { randomBytes, randomUUID } from 'node:crypto';
import { migrateTestDatabase } from '../../src/modules/usuarios/infrastructure/db/migrate.js';
import { migrateF02TestDatabase } from '../../src/modules/inventario/infrastructure/migrate.js';
import { migrateF03TestDatabase } from '../../src/modules/busqueda/infrastructure/migrate.js';

const baseText = process.env.F01_TEST_DATABASE_URL;
const group = baseText ? describe : describe.skip;
const hex = (size: number) => randomBytes(size).toString('hex');
group('proyección PostgreSQL RLS real F03', () => {
  let base: Client; let database: Client; let runtime: Client; let databaseName = ''; let roleName = '';
  const pharmacyA = randomUUID(); const pharmacyB = randomUUID();
  async function connect(url: string) { const client = new Client({ connectionString:url }); await client.connect(); return client; }
  beforeAll(async () => {
    const baseUrl = new URL(baseText!);
    if (baseUrl.hostname !== '127.0.0.1' || baseUrl.port !== '55431' || baseUrl.pathname !== '/farmafind_f01_test') throw new Error('F03 RLS: solo base local TEST');
    base = await connect(baseText!); const suffix = hex(6); databaseName = `farmafind_f01_test_${suffix}`; roleName = `f03_test_runtime_${suffix}`;
    await base.query(`CREATE DATABASE "${databaseName}"`); baseUrl.pathname = `/${databaseName}`; database = await connect(baseUrl.toString());
    await migrateTestDatabase(baseUrl.toString(),connect); await migrateF02TestDatabase(baseUrl.toString(),connect); await migrateF03TestDatabase(baseUrl.toString(),connect);
    await database.query(`INSERT INTO f01.farmacia_referencia(id,nombre_publico,estado) VALUES($1,'Farmacia Alfa','ACTIVA'),($2,'Farmacia Beta','ACTIVA')`,[pharmacyA,pharmacyB]);
    await database.query(`INSERT INTO f03.farmacia_publica(farmacia_id,direccion_texto,latitud,longitud)
      VALUES($1,'Dirección Alfa ficticia',-12.04,-77.03),($2,'Dirección Beta ficticia',-12.08,-77.08)`,[pharmacyA,pharmacyB]);
    const medication = (await database.query(`INSERT INTO f02.medicamento(nombre,principio_activo,concentracion,presentacion,clasificacion)
      VALUES('producto alfa','principio ficticio','10 mg','tabletas','venta libre') RETURNING id`)).rows[0].id;
    await database.query(`INSERT INTO f02.inventario(farmacia_id,medicamento_id,precio_centavos,cantidad_fisica,cantidad_comprometida,ultima_revision_at)
      VALUES($1,$3,1000,5,1,now()),($2,$3,1200,2,2,now())`,[pharmacyA,pharmacyB,medication]);
    const password = hex(32); await base.query(`CREATE ROLE "${roleName}" LOGIN NOSUPERUSER NOBYPASSRLS PASSWORD '${password}'`);
    await base.query(`GRANT f01_runtime TO "${roleName}"`); baseUrl.username=roleName; baseUrl.password=password; runtime=await connect(baseUrl.toString());
  });
  afterAll(async () => {
    if (runtime) await runtime.end(); if (database) await database.end();
    if (base) { if (databaseName) await base.query(`DROP DATABASE "${databaseName}"`); if (roleName) await base.query(`DROP ROLE "${roleName}"`); await base.end(); }
  });
  it('rol runtime carece de SUPERUSER/BYPASSRLS y tablas usan FORCE RLS', async () => {
    expect((await base.query('SELECT rolsuper,rolbypassrls FROM pg_roles WHERE rolname=$1',[roleName])).rows[0]).toEqual({ rolsuper:false,rolbypassrls:false });
    const rows = (await database.query(`SELECT relrowsecurity,relforcerowsecurity FROM pg_class WHERE oid IN ('f02.inventario'::regclass,'f03.farmacia_publica'::regclass)`)).rows;
    expect(rows).toHaveLength(2); expect(rows.every(row => row.relrowsecurity && row.relforcerowsecurity)).toBe(true);
  });
  it('publica solo disponibilidad positiva y campos expresamente permitidos', async () => {
    const result = await runtime.query(`SELECT * FROM f03.search_public_offers('producto',NULL,NULL,200)`);
    expect(result.rows).toHaveLength(1); expect(result.rows[0].farmacia_id).toBe(pharmacyA);
    expect(Object.keys(result.rows[0])).not.toContain('cantidad_fisica'); expect(Object.keys(result.rows[0])).not.toContain('cantidad_comprometida');
  });
  it('excluye una farmacia inactiva aunque tenga disponibilidad positiva', async () => {
    await database.query('UPDATE f02.inventario SET cantidad_comprometida=0 WHERE farmacia_id=$1',[pharmacyB]);
    await database.query("UPDATE f01.farmacia_referencia SET estado='INACTIVA' WHERE id=$1",[pharmacyB]);
    expect((await runtime.query(`SELECT farmacia_id FROM f03.search_public_offers('producto',NULL,NULL,200)`)).rows.map(row=>row.farmacia_id)).toEqual([pharmacyA]);
    await database.query("UPDATE f01.farmacia_referencia SET estado='ACTIVA' WHERE id=$1",[pharmacyB]);
  });
  it('runtime no puede consultar inventario ni perfil directamente sin contexto', async () => {
    expect((await runtime.query('SELECT id FROM f02.inventario')).rows).toEqual([]);
    await expect(runtime.query('SELECT farmacia_id FROM f03.farmacia_publica')).rejects.toMatchObject({ code: '42501' });
  });
});
