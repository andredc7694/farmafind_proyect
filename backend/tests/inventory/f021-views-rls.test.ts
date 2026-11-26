import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client, Pool } from 'pg';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { migrateTestDatabase } from '../../src/modules/usuarios/infrastructure/db/migrate.js';
import { migrateF02TestDatabase } from '../../src/modules/inventario/infrastructure/migrate.js';
import { PgIdentityUnitOfWork } from '../../src/modules/usuarios/infrastructure/db/tenant-transaction.js';
import { PgInventoryTenantRunner } from '../../src/modules/inventario/infrastructure/tenant-unit-of-work.js';
import { ManualInventory } from '../../src/modules/inventario/application/manual-review.js';
import { ConfirmImport } from '../../src/modules/inventario/application/confirm-import.js';

const baseUrlText = process.env.F01_TEST_DATABASE_URL;
const group = baseUrlText ? describe : describe.skip;
const hex = (size: number) => randomBytes(size).toString('hex');

group('F02.1 lecturas de pantalla (nombres, historial y cambios) bajo RLS', () => {
  let base: Client; let database: Client; let pool: Pool;
  let databaseName = ''; let roleName = '';
  const userA = randomUUID(); const userB = randomUUID();
  const pharmacyA = randomUUID(); const pharmacyB = randomUUID();
  const secretA = hex(32); const secretB = hex(32);
  const first = randomUUID(); const second = randomUUID();
  let manual: ManualInventory; let imports: ConfirmImport;
  let importA = '';
  async function connect(url: string) {
    const client = new Client({ connectionString: url }); await client.connect(); return client;
  }
  async function preview(secret: string, pharmacy: string, user: string, digest: number, rows: readonly (readonly [string, number, number])[]) {
    return new PgIdentityUnitOfWork(pool).runWithClient(secret, async (identity, client, actor) => {
      await identity.useAuthorizedPharmacy(actor, pharmacy);
      const id = (await client.query(`INSERT INTO f02.importacion(farmacia_id,actor_usuario_id,digest,expires_at,error_count)
        VALUES($1,$2,$3,now()+interval '30 minutes',0) RETURNING id`, [pharmacy, user, Buffer.alloc(32, digest)])).rows[0].id as string;
      for (const [index, [medication, cents, quantity]] of rows.entries()) {
        await client.query(`INSERT INTO f02.importacion_fila(importacion_id,farmacia_id,actor_usuario_id,numero_fila,medicamento_id,
          precio_centavos,cantidad_fisica) VALUES($1,$2,$3,$4,$5,$6,$7)`, [id, pharmacy, user, index + 2, medication, cents, quantity]);
      }
      return id;
    });
  }
  beforeAll(async () => {
    const url = new URL(baseUrlText!);
    if (url.hostname !== '127.0.0.1' || url.port !== '55431' ||
        !/^\/farmafind_f01_test_[a-f0-9]{12}$/.test(url.pathname)) throw new Error('F02.1: solo fixture TEST marcado, nunca farmafind_f01_test');
    base = await connect(baseUrlText!);
    const suffix = hex(6);
    databaseName = `farmafind_f01_test_${suffix}`; roleName = `f021_views_runtime_${suffix}`;
    await base.query(`CREATE DATABASE "${databaseName}"`);
    url.pathname = `/${databaseName}`;
    database = await connect(url.toString());
    await migrateTestDatabase(url.toString(), connect);
    await migrateF02TestDatabase(url.toString(), connect);
    await database.query(`INSERT INTO f01.usuario(id,email_canonico,password_hash)
      VALUES($1,'vistas-a@example.invalid','$argon2id$fixture-only'),($2,'vistas-b@example.invalid','$argon2id$fixture-only')`, [userA, userB]);
    await database.query(`INSERT INTO f01.farmacia_referencia(id,nombre_publico) VALUES($1,'Alfa ficticia'),($2,'Beta ficticia')`, [pharmacyA, pharmacyB]);
    await database.query(`INSERT INTO f02.medicamento(id,nombre,concentracion,presentacion,clasificacion)
      VALUES($1,'producto uno','10 mg','tabletas','venta libre'),($2,'producto dos','5 mg','jarabe','venta libre')`, [first, second]);
    for (const [user, pharmacy, secret] of [[userA, pharmacyA, secretA], [userB, pharmacyB, secretB]]) {
      const membership = (await database.query(`INSERT INTO f01.usuario_farmacia(usuario_id,farmacia_id,rol)
        VALUES($1,$2,'DUENO') RETURNING id`, [user, pharmacy])).rows[0].id;
      for (const capability of ['inventory.read', 'inventory.write', 'inventory.import.preview', 'inventory.import.confirm', 'inventory.history']) {
        await database.query(`INSERT INTO f01.delegacion(membresia_id,farmacia_id,capacidad,granted_by_usuario_id)
          VALUES($1,$2,$3,$4)`, [membership, pharmacy, capability, user]);
      }
      await database.query(`INSERT INTO f01.sesion(usuario_id,token_fingerprint,idle_expires_at,absolute_expires_at)
        VALUES($1,$2,now()+interval '1 hour',now()+interval '4 hours')`,
      [user, createHash('sha256').update(Buffer.from(secret, 'hex')).digest()]);
    }
    const password = hex(32);
    await base.query(`CREATE ROLE "${roleName}" LOGIN NOSUPERUSER NOBYPASSRLS PASSWORD '${password}'`);
    await base.query(`GRANT f01_runtime TO "${roleName}"`);
    url.username = roleName; url.password = password;
    pool = new Pool({ connectionString: url.toString(), max: 1 });
    const runner = new PgInventoryTenantRunner(new PgIdentityUnitOfWork(pool));
    manual = new ManualInventory(runner); imports = new ConfirmImport(runner);
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

  it('cuenta agregados y actualizados y entrega nombres y qué cambió a la propia farmacia', async () => {
    await manual.review(secretA, pharmacyA, first, { priceCents: 100, physicalQuantity: 4, reason: 'Conteo inicial' });
    importA = await preview(secretA, pharmacyA, userA, 3, [[first, 150, 9], [second, 300, 2]]);
    await imports.confirm(secretA, pharmacyA, importA);
    const [item] = await imports.history(secretA, pharmacyA);
    expect(item).toMatchObject({ importacionId: importA, estado: 'CONFIRMADA', autorId: userA, porMi: true,
      filas: 2, listas: 2, pendientes: 0, conErrores: 0, agregados: 1, actualizados: 1 });
    const detail = await imports.status(secretA, pharmacyA, importA);
    expect(detail.cambios).toEqual([
      expect.objectContaining({ nombre: 'producto dos', added: true, priceAfterCents: 300, quantityAfter: 2 }),
      expect.objectContaining({ nombre: 'producto uno', added: false, priceBeforeCents: 100, priceAfterCents: 150, quantityBefore: 4, quantityAfter: 9 }),
    ]);
    expect((await manual.list(secretA, pharmacyA)).map(row => row.nombre)).toEqual(['producto dos', 'producto uno']);
    expect((await manual.movements(secretA, pharmacyA)).every(row => typeof row.nombre === 'string')).toBe(true);
  });

  it('lo que llega igual no cuenta como actualizado', async () => {
    const again = await preview(secretA, pharmacyA, userA, 4, [[first, 150, 9], [second, 310, 2]]);
    await imports.confirm(secretA, pharmacyA, again);
    expect((await imports.history(secretA, pharmacyA))[0]).toMatchObject({ importacionId: again, filas: 2, agregados: 0, actualizados: 1 });
  });

  it('Beta no ve inventario, movimientos, historial ni cambios de Alfa, con la misma conexión', async () => {
    expect(await manual.list(secretB, pharmacyB)).toEqual([]);
    expect(await manual.movements(secretB, pharmacyB)).toEqual([]);
    expect(await imports.history(secretB, pharmacyB)).toEqual([]);
    await expect(imports.status(secretB, pharmacyB, importA)).rejects.toThrow();
    await expect(imports.status(secretB, pharmacyA, importA)).rejects.toThrow();
    await expect(manual.list(secretB, pharmacyA)).rejects.toThrow();
    await expect(manual.movements(secretB, pharmacyA)).rejects.toThrow();
    await expect(imports.history(secretB, pharmacyA)).rejects.toThrow();
    // Aun consultando con el identificador ajeno, las políticas no entregan filas.
    await new PgIdentityUnitOfWork(pool).runWithClient(secretB, async (identity, client, actor) => {
      await identity.useAuthorizedPharmacy(actor, pharmacyB);
      expect((await client.query('SELECT id FROM f02.movimiento WHERE motivo=$1', [`Importación ${importA}`])).rows).toEqual([]);
      expect((await client.query('SELECT id FROM f02.inventario WHERE farmacia_id=$1', [pharmacyA])).rows).toEqual([]);
    });
    expect(await imports.history(secretA, pharmacyA)).toHaveLength(2);
  });
});
