import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { Client } from 'pg';
import { migrateTestDatabase } from '../../src/modules/usuarios/infrastructure/db/migrate.js';
import { migrateF02TestDatabase } from '../../src/modules/inventario/infrastructure/migrate.js';
import { migrateF03TestDatabase } from '../../src/modules/busqueda/infrastructure/migrate.js';
import { migrateF07TestDatabase } from '../../src/modules/busqueda/infrastructure/migrate.js';

const sql = (name: string) => readFileSync(new URL(`../../migrations/f07/${name}`,import.meta.url),'utf8');

describe('F07 migración aditiva y barrera TEST', () => {
  it('no convierte ubicaciones heredadas en verificadas ni infiere ciudad', () => {
    const migration = sql('001_location.sql');
    expect(migration).toContain("DEFAULT 'PENDIENTE'");
    expect(migration).toMatch(/ADD COLUMN ciudad text/);
    expect(migration).not.toMatch(/\bUPDATE\s+f03\.farmacia_publica\b/i);
    expect(migration).not.toMatch(/\b(DROP TABLE|TRUNCATE)\b/i);
  });
  it('preserva búsqueda textual F03 y oculta coordenadas no revisadas', () => {
    const projection = sql('003_public_projection.sql');
    expect(projection).toContain("p.estado_ubicacion='PUBLICADA_VERIFICADA'");
    expect(projection).toContain('p.direccion_texto');
    expect(projection).toContain('f03.search_public_offers');
  });
  it('rechaza bases persistentes, remotas o con usuario runtime antes de conectar', async () => {
    let connected = false;
    const connect = async () => { connected = true; throw new Error('No debe conectar'); };
    for (const url of [
      'postgresql://user:secret@127.0.0.1:55431/farmafind_f01_test',
      'postgresql://user:secret@db.example:55431/farmafind_f01_test_123456789abc',
      'postgresql://f01_runtime:secret@127.0.0.1:55431/farmafind_f01_test_123456789abc',
    ]) await expect(migrateF07TestDatabase(url,connect)).rejects.toThrow(/TEST aislada/);
    expect(connected).toBe(false);
  });
});

const group = process.env.F07_TEST_DATABASE_URL && process.env.F07_RUNTIME_DATABASE_URL ? describe : describe.skip;
group('F07 migración PostgreSQL real — fila F03 heredada', () => {
  let base: Client; let test: Client; let runtime: Client; let database = '';
  let baseBefore: Record<string,unknown>; let pharmacyId = '';
  const connect = async (url: string) => { const client=new Client({connectionString:url}); await client.connect(); return client; };
  beforeAll(async () => {
    const baseUrl=new URL(process.env.F07_TEST_DATABASE_URL!); baseUrl.pathname='/farmafind_f01_test';
    base=await connect(baseUrl.toString());
    baseBefore=(await base.query(`SELECT (SELECT count(*)::int FROM f01.usuario) users,
      (SELECT count(*)::int FROM f01.farmacia_referencia) pharmacies`)).rows[0];
    database=`farmafind_f01_test_${randomBytes(6).toString('hex')}`;
    await base.query(`CREATE DATABASE "${database}"`);
    await base.query(`COMMENT ON DATABASE "${database}" IS 'FarmaFind F07 TEST efimera'`);
    const testUrl=new URL(process.env.F07_TEST_DATABASE_URL!); testUrl.pathname=`/${database}`;
    await migrateTestDatabase(testUrl.toString(),connect);
    await migrateF02TestDatabase(testUrl.toString(),connect);
    await migrateF03TestDatabase(testUrl.toString(),connect);
    test=await connect(testUrl.toString());
    pharmacyId=(await test.query(`INSERT INTO f01.farmacia_referencia(nombre_publico)
      VALUES('Farmacia Legacy F07 TEST') RETURNING id`)).rows[0].id;
    await test.query(`INSERT INTO f03.farmacia_publica(farmacia_id,direccion_texto,latitud,longitud)
      VALUES($1,'Dirección textual heredada',-12.04,-77.03)`,[pharmacyId]);
    const productId=(await test.query(`INSERT INTO f02.medicamento(nombre,principio_activo,concentracion,presentacion,clasificacion)
      VALUES('producto legado','principio ficticio','10 mg','tabletas','venta libre') RETURNING id`)).rows[0].id;
    await test.query(`INSERT INTO f02.inventario(farmacia_id,medicamento_id,precio_centavos,cantidad_fisica,
      cantidad_comprometida,ultima_revision_at) VALUES($1,$2,1200,2,0,now())`,[pharmacyId,productId]);
    await migrateF07TestDatabase(testUrl.toString(),connect);
    const runtimeUrl=new URL(process.env.F07_RUNTIME_DATABASE_URL!); runtimeUrl.pathname=`/${database}`;
    runtime=await connect(runtimeUrl.toString());
  });
  afterAll(async () => {
    if (runtime) await runtime.end();
    if (test) await test.end();
    if (base) {
      if (database) await base.query(`DROP DATABASE "${database}"`);
      if (baseBefore) expect((await base.query(`SELECT (SELECT count(*)::int FROM f01.usuario) users,
        (SELECT count(*)::int FROM f01.farmacia_referencia) pharmacies`)).rows[0]).toEqual(baseBefore);
      await base.end();
    }
  });
  it('mantiene la ciudad nula, dirección y estado PENDIENTE sin inferir ubicación', async () => {
    expect((await test.query(`SELECT ciudad,estado_ubicacion,direccion_texto,latitud,longitud
      FROM f03.farmacia_publica WHERE farmacia_id=$1`,[pharmacyId])).rows[0]).toMatchObject({
        ciudad:null,estado_ubicacion:'PENDIENTE',direccion_texto:'Dirección textual heredada',
      });
  });
  it('preserva oferta F03 pero no expone coordenadas heredadas a runtime', async () => {
    const rows=(await runtime.query(`SELECT * FROM f03.search_public_offers('producto',NULL,NULL,200)`)).rows;
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({farmacia_id:pharmacyId,farmacia_direccion:'Dirección textual heredada',
      farmacia_latitud:null,farmacia_longitud:null,precio_centavos:'1200'});
    expect((await runtime.query("SELECT * FROM f07.list_public_pharmacies('lima')")).rows).toEqual([]);
  });
});
