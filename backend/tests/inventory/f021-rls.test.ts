import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client, Pool } from 'pg';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { migrateTestDatabase } from '../../src/modules/usuarios/infrastructure/db/migrate.js';
import { migrateF02TestDatabase } from '../../src/modules/inventario/infrastructure/migrate.js';
import { PgIdentityUnitOfWork } from '../../src/modules/usuarios/infrastructure/db/tenant-transaction.js';

const baseUrlText = process.env.F01_TEST_DATABASE_URL;
const group = baseUrlText ? describe : describe.skip;
const hex = (size: number) => randomBytes(size).toString('hex');

group('F02.1 perfiles e incidencias bajo RLS', () => {
  let base: Client; let database: Client; let pool: Pool;
  let databaseName = ''; let roleName = '';
  let userA: string; let userB: string; let pharmacyA: string; let pharmacyB: string;
  let secretA: string; let secretB: string;
  async function connect(url: string) {
    const client = new Client({ connectionString: url }); await client.connect(); return client;
  }
  beforeAll(async () => {
    const url = new URL(baseUrlText!);
    if (url.hostname !== '127.0.0.1' || url.port !== '55431' ||
        !/^\/farmafind_f01_test_[a-f0-9]{12}$/.test(url.pathname)) throw new Error('F02.1: solo fixture TEST marcado, nunca farmafind_f01_test');
    base = await connect(baseUrlText!);
    const suffix = hex(6);
    databaseName = `farmafind_f01_test_${suffix}`;
    roleName = `f021_test_runtime_${suffix}`;
    await base.query(`CREATE DATABASE "${databaseName}"`);
    url.pathname = `/${databaseName}`;
    database = await connect(url.toString());
    await migrateTestDatabase(url.toString(), connect);
    await migrateF02TestDatabase(url.toString(), connect);
    userA = randomUUID(); userB = randomUUID();
    pharmacyA = randomUUID(); pharmacyB = randomUUID();
    secretA = hex(32); secretB = hex(32);
    await database.query(`INSERT INTO f01.usuario(id,email_canonico,password_hash)
      VALUES($1,'f021-a@example.invalid','$argon2id$fixture-only'),
            ($2,'f021-b@example.invalid','$argon2id$fixture-only')`, [userA,userB]);
    await database.query(`INSERT INTO f01.farmacia_referencia(id,nombre_publico)
      VALUES($1,'Alfa ficticia'),($2,'Beta ficticia')`, [pharmacyA,pharmacyB]);
    for (const [user, pharmacy, secret] of [[userA,pharmacyA,secretA],[userB,pharmacyB,secretB]]) {
      const membership = (await database.query(`INSERT INTO f01.usuario_farmacia(usuario_id,farmacia_id,rol)
        VALUES($1,$2,'DUENO') RETURNING id`, [user,pharmacy])).rows[0].id;
      for (const capability of ['inventory.import.preview','inventory.import.confirm','inventory.history']) {
        await database.query(`INSERT INTO f01.delegacion(membresia_id,farmacia_id,capacidad,granted_by_usuario_id)
          VALUES($1,$2,$3,$4)`, [membership,pharmacy,capability,user]);
      }
      await database.query(`INSERT INTO f01.sesion(usuario_id,token_fingerprint,idle_expires_at,absolute_expires_at)
        VALUES($1,$2,now()+interval '1 hour',now()+interval '4 hours')`,
      [user,createHash('sha256').update(Buffer.from(secret, 'hex')).digest()]);
    }
    const password = hex(32);
    await base.query(`CREATE ROLE "${roleName}" LOGIN NOSUPERUSER NOBYPASSRLS PASSWORD '${password}'`);
    await base.query(`GRANT f01_runtime TO "${roleName}"`);
    url.username = roleName; url.password = password;
    pool = new Pool({ connectionString: url.toString(), max: 1 });
  });
  afterAll(async () => {
    if (pool) await pool.end();
    if (database) await database.end();
    if (base) {
      if (databaseName) await base.query(`DROP DATABASE "${databaseName}"`);
      if (roleName && (await base.query('SELECT 1 FROM pg_roles WHERE rolname=$1', [roleName])).rows.length)
        await base.query(`DROP ROLE "${roleName}"`);
      await base.end();
    }
  });

  it('mantiene FORCE RLS y rol runtime sin bypass', async () => {
    expect((await base.query('SELECT rolsuper,rolbypassrls FROM pg_roles WHERE rolname=$1', [roleName])).rows[0])
      .toMatchObject({ rolsuper: false, rolbypassrls: false });
    const tables = (await database.query(`SELECT relname,relrowsecurity,relforcerowsecurity FROM pg_class
      WHERE oid IN ('f02.perfil_importacion'::regclass,'f02.importacion_incidencia'::regclass)`)).rows;
    expect(tables).toHaveLength(2);
    expect(tables.every(row => row.relrowsecurity && row.relforcerowsecurity)).toBe(true);
  });

  it('Alfa no lee ni cambia perfiles de Beta, incluso reutilizando conexión', async () => {
    const uow = new PgIdentityUnitOfWork(pool);
    const digest = Buffer.alloc(32, 1);
    await uow.runWithClient(secretA, async (identity, client, actor) => {
      await identity.useAuthorizedPharmacy(actor, pharmacyA);
      await client.query(`INSERT INTO f02.perfil_importacion
        (farmacia_id,actor_usuario_id,nombre,huella_encabezados,hoja,fila_encabezado,mapeo)
        VALUES($1,$2,'Perfil Alfa',$3,'CSV',1,'{}'::jsonb)`, [pharmacyA,userA,digest]);
    });
    await uow.runWithClient(secretB, async (identity, client, actor) => {
      await identity.useAuthorizedPharmacy(actor, pharmacyB);
      expect((await client.query('SELECT id FROM f02.perfil_importacion')).rows).toEqual([]);
      expect((await client.query(`UPDATE f02.perfil_importacion SET nombre='Cambio'
        WHERE farmacia_id=$1 RETURNING id`, [pharmacyA])).rows).toEqual([]);
    });
    await uow.runWithClient(secretA, async (identity, client, actor) => {
      await identity.useAuthorizedPharmacy(actor, pharmacyA);
      expect((await client.query('SELECT id FROM f02.perfil_importacion')).rows).toHaveLength(1);
      expect((await client.query('SELECT id FROM f02.perfil_importacion WHERE farmacia_id=$1', [pharmacyB])).rows)
        .toEqual([]);
    });
  });

  it('las incidencias pertenecen al actor y farmacia de la vista previa', async () => {
    const uow = new PgIdentityUnitOfWork(pool);
    await uow.runWithClient(secretA, async (identity, client, actor) => {
      await identity.useAuthorizedPharmacy(actor, pharmacyA);
      const id = (await client.query(`INSERT INTO f02.importacion
        (farmacia_id,actor_usuario_id,digest,expires_at,error_count)
        VALUES($1,$2,$3,now()+interval '30 minutes',1) RETURNING id`,
      [pharmacyA,userA,Buffer.alloc(32, 2)])).rows[0].id;
      await client.query(`INSERT INTO f02.importacion_fila
        (importacion_id,farmacia_id,actor_usuario_id,numero_fila,error_code)
        VALUES($1,$2,$3,2,'VALOR_INVALIDO')`, [id,pharmacyA,userA]);
      await client.query(`INSERT INTO f02.importacion_incidencia
        (importacion_id,farmacia_id,actor_usuario_id,numero_fila,ordinal,columna_origen,campo_destino,codigo)
        VALUES($1,$2,$3,2,1,'precio','precioReferencial','PRECIO_REQUERIDO')`,
      [id,pharmacyA,userA]);
      expect((await client.query('SELECT codigo FROM f02.importacion_incidencia')).rows)
        .toMatchObject([{ codigo: 'PRECIO_REQUERIDO' }]);
    });
    await uow.runWithClient(secretB, async (identity, client, actor) => {
      await identity.useAuthorizedPharmacy(actor, pharmacyB);
      expect((await client.query('SELECT codigo FROM f02.importacion_incidencia')).rows).toEqual([]);
      await expect(client.query(`INSERT INTO f02.importacion_incidencia
        (importacion_id,farmacia_id,actor_usuario_id,numero_fila,ordinal,columna_origen,campo_destino,codigo)
        SELECT importacion_id,$1,$2,2,2,'precio','precioReferencial','PRECIO_INVALIDO'
        FROM f02.importacion_incidencia WHERE farmacia_id=$3`, [pharmacyB,userB,pharmacyA]))
        .resolves.toMatchObject({ rows: [] });
    });
  });
});
