import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client, Pool } from 'pg';
import { randomBytes, randomUUID } from 'node:crypto';
import { migrateTestDatabase } from '../../src/modules/usuarios/infrastructure/db/migrate.js';
import { migrateF02TestDatabase } from '../../src/modules/inventario/infrastructure/migrate.js';
import { migrateF03TestDatabase } from '../../src/modules/busqueda/infrastructure/migrate.js';
import { PgPublicOfferRepository } from '../../src/modules/busqueda/infrastructure/public-offer-repository.js';
import { SuggestPublicOffers, SUGGESTION_MAX } from '../../src/modules/busqueda/application/suggest-public.js';

const baseText = process.env.F01_TEST_DATABASE_URL;
const group = baseText ? describe : describe.skip;
const hex = (size: number) => randomBytes(size).toString('hex');

/** F08.1: las sugerencias salen solo de la proyección pública F03 (PostgreSQL real, rol runtime sin BYPASSRLS). */
group('F08.1 sugerencias públicas (PostgreSQL RLS real)', () => {
  let base: Client; let database: Client; let pool: Pool; let databaseName = ''; let roleName = '';
  let suggest: SuggestPublicOffers; const pharmacyA = randomUUID(); const pharmacyB = randomUUID();
  async function connect(url: string) { const client = new Client({ connectionString: url }); await client.connect(); return client; }

  beforeAll(async () => {
    const baseUrl = new URL(baseText!);
    if (baseUrl.hostname !== '127.0.0.1' || baseUrl.port !== '55431' || !/^\/farmafind_f01_test_[a-f0-9]{12}$/.test(baseUrl.pathname)) throw new Error('F08.1: solo fixture TEST marcado');
    base = await connect(baseText!); const suffix = hex(6); databaseName = `farmafind_f01_test_${suffix}`; roleName = `f081_sug_${suffix}`;
    await base.query(`CREATE DATABASE "${databaseName}"`); baseUrl.pathname = `/${databaseName}`; database = await connect(baseUrl.toString());
    await migrateTestDatabase(baseUrl.toString(), connect); await migrateF02TestDatabase(baseUrl.toString(), connect); await migrateF03TestDatabase(baseUrl.toString(), connect);
    await database.query("INSERT INTO f01.farmacia_referencia(id,nombre_publico,estado) VALUES($1,'Farmacia Alfa','ACTIVA'),($2,'Farmacia Beta','ACTIVA')", [pharmacyA, pharmacyB]);
    await database.query("INSERT INTO f03.farmacia_publica(farmacia_id,direccion_texto,latitud,longitud) VALUES($1,'Dirección Alfa ficticia',-12.04,-77.03),($2,'Dirección Beta ficticia',-12.08,-77.08)", [pharmacyA, pharmacyB]);
    const add = async (name: string, active: string | null, concentration: string, presentation: string) =>
      (await database.query("INSERT INTO f02.medicamento(nombre,principio_activo,concentracion,presentacion,clasificacion) VALUES($1,$2,$3,$4,'venta libre') RETURNING id", [name, active, concentration, presentation])).rows[0].id as string;
    const visible = await add('paracetamol ficticio', 'principio ficticio uno', '500 mg', 'tabletas');
    const visible2 = await add('paracetamol ficticio', 'principio ficticio uno', '1 g', 'jarabe');
    const noStock = await add('paracetamol agotado', 'principio ficticio dos', '500 mg', 'tabletas');
    const noPublic = await add('paracetamol privado', null, '500 mg', 'tabletas'); // sin principio activo: no se proyecta
    await database.query(`INSERT INTO f02.inventario(farmacia_id,medicamento_id,precio_centavos,cantidad_fisica,cantidad_comprometida,ultima_revision_at) VALUES
      ($1,$2,1000,5,1,now()),($3,$4,1100,5,0,now()),($1,$5,1000,3,3,now()),($1,$6,1000,3,0,now())`, [pharmacyA, visible, pharmacyB, visible2, noStock, noPublic]);
    for (let i = 0; i < 12; i++) { // más de 8 candidatos distintos para comprobar el tope
      const id = await add(`ibuprofeno ficticio ${i}`, `activo ficticio ${i}`, `${100 + i} mg`, 'tabletas');
      await database.query('INSERT INTO f02.inventario(farmacia_id,medicamento_id,precio_centavos,cantidad_fisica,ultima_revision_at) VALUES($1,$2,900,4,now())', [pharmacyA, id]);
    }
    const password = hex(32); await base.query(`CREATE ROLE "${roleName}" LOGIN NOSUPERUSER NOBYPASSRLS PASSWORD '${password}'`);
    await base.query(`GRANT f01_runtime TO "${roleName}"`); baseUrl.username = roleName; baseUrl.password = password;
    pool = new Pool({ connectionString: baseUrl.toString(), max: 2 });
    suggest = new SuggestPublicOffers(new PgPublicOfferRepository(pool));
  }, 120000);

  afterAll(async () => {
    if (pool) await pool.end(); if (database) await database.end();
    if (base) { if (databaseName) await base.query(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`); if (roleName) await base.query(`DROP ROLE IF EXISTS "${roleName}"`); await base.end(); }
  });

  it('sugiere nombre y presentación de ofertas públicas, sin duplicados y sin ids, precios ni farmacias', async () => {
    const result = await suggest.execute('paraceta');
    const texts = result.suggestions.map(item => item.text);
    expect(texts).toContain('paracetamol ficticio');
    expect(texts).toContain('paracetamol ficticio 500 mg tabletas'); expect(texts).toContain('paracetamol ficticio 1 g jarabe');
    expect(new Set(texts.map(text => text.toLowerCase())).size).toBe(texts.length);
    for (const item of result.suggestions) expect(Object.keys(item).sort()).toEqual(['kind', 'text']);
    expect(JSON.stringify(result)).not.toMatch(/1000|1100|Farmacia|Dirección|[0-9a-f]{8}-[0-9a-f]{4}/);
  });

  it('un medicamento sin oferta pública (sin stock disponible o sin principio activo) jamás aparece', async () => {
    const texts = (await suggest.execute('paracetamol')).suggestions.map(item => item.text).join(' | ');
    expect(texts).not.toContain('agotado'); expect(texts).not.toContain('privado');
    expect(texts).not.toContain('principio ficticio dos');
  });

  it('una farmacia inactiva deja de aportar sugerencias', async () => {
    await database.query("UPDATE f01.farmacia_referencia SET estado='INACTIVA' WHERE id=$1", [pharmacyB]);
    const texts = (await suggest.execute('paracetamol')).suggestions.map(item => item.text);
    expect(texts).toContain('paracetamol ficticio 500 mg tabletas');
    expect(texts).not.toContain('paracetamol ficticio 1 g jarabe'); // solo estaba en Beta
    await database.query("UPDATE f01.farmacia_referencia SET estado='ACTIVA' WHERE id=$1", [pharmacyB]);
  });

  it('respeta el tope de 8 y no suma más aunque haya muchos candidatos', async () => {
    const result = await suggest.execute('ibuprofeno');
    expect(result.suggestions.length).toBe(SUGGESTION_MAX);
  });

  it('rechaza consultas demasiado cortas o largas y el rol de aplicación no ve inventario directo', async () => {
    await expect(suggest.execute('a')).rejects.toMatchObject({ code: 'INVALID_QUERY' });
    await expect(suggest.execute('x'.repeat(121))).rejects.toMatchObject({ code: 'INVALID_QUERY' });
    await expect(suggest.execute(undefined)).rejects.toMatchObject({ code: 'INVALID_QUERY' });
    expect((await pool.query('SELECT id FROM f02.inventario')).rows).toEqual([]);
  });
});
