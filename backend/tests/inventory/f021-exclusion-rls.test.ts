import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client, Pool } from 'pg';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { migrateTestDatabase } from '../../src/modules/usuarios/infrastructure/db/migrate.js';
import { migrateF02TestDatabase } from '../../src/modules/inventario/infrastructure/migrate.js';
import { PgIdentityUnitOfWork } from '../../src/modules/usuarios/infrastructure/db/tenant-transaction.js';
import { PgInventoryTenantRunner } from '../../src/modules/inventario/infrastructure/tenant-unit-of-work.js';
import { inspectInventoryFile } from '../../src/modules/inventario/infrastructure/file-parser.js';
import { ManualInventory } from '../../src/modules/inventario/application/manual-review.js';
import { PreviewImport } from '../../src/modules/inventario/application/preview-import.js';
import { ConfirmImport, ImportConflictError } from '../../src/modules/inventario/application/confirm-import.js';

const baseUrlText = process.env.F01_TEST_DATABASE_URL;
const group = baseUrlText ? describe : describe.skip;
const hex = (size: number) => randomBytes(size).toString('hex');
const mapping = { nombre: 'nombre', concentracion: 'concentracion', presentacion: 'presentacion', clasificacion: 'clasificacion',
  precioReferencial: 'precio', cantidadFisica: 'cantidad' };
const header = 'nombre,concentracion,presentacion,clasificacion,precio,cantidad\n';
const uno = (price: string, quantity: string) => `producto uno,10 mg,tabletas,venta libre,${price},${quantity}\n`;
const dos = 'producto dos,5 mg,jarabe,venta libre,3.00,2\n';
const nuevo = 'producto nuevo,1 mg,gotas,venta libre,4.00,6\n';

group('F02.1 exclusión explícita de filas bajo RLS', () => {
  let base: Client; let database: Client; let pool: Pool;
  let databaseName = ''; let roleName = '';
  const userA = randomUUID(); const userB = randomUUID();
  const pharmacyA = randomUUID(); const pharmacyB = randomUUID();
  const secretA = hex(32); const secretB = hex(32);
  let manual: ManualInventory; let imports: ConfirmImport; let previews: PreviewImport;
  async function connect(url: string) {
    const client = new Client({ connectionString: url }); await client.connect(); return client;
  }
  async function preview(csv: string) {
    const bytes = Buffer.from(header + csv);
    const inspected = await inspectInventoryFile(bytes, 'archivo.csv');
    return previews.run(secretA, pharmacyA, bytes, 'archivo.csv', mapping, { sheet: 'CSV', headerRow: 1, digest: inspected.digest });
  }
  const snapshot = async () => (await database.query(`SELECT (SELECT count(*)::int FROM f02.inventario) AS inventario,
    (SELECT count(*)::int FROM f02.movimiento) AS movimientos,(SELECT count(*)::int FROM f02.medicamento) AS catalogo`)).rows[0];
  const state = async (id: string) => (await database.query('SELECT estado FROM f02.importacion WHERE id=$1', [id])).rows[0].estado;

  beforeAll(async () => {
    const url = new URL(baseUrlText!);
    if (url.hostname !== '127.0.0.1' || url.port !== '55431' ||
        !/^\/farmafind_f01_test_[a-f0-9]{12}$/.test(url.pathname)) throw new Error('F02.1: solo fixture TEST marcado, nunca farmafind_f01_test');
    base = await connect(baseUrlText!);
    const suffix = hex(6);
    databaseName = `farmafind_f01_test_${suffix}`; roleName = `f021_excl_runtime_${suffix}`;
    await base.query(`CREATE DATABASE "${databaseName}"`);
    url.pathname = `/${databaseName}`;
    database = await connect(url.toString());
    await migrateTestDatabase(url.toString(), connect);
    await migrateF02TestDatabase(url.toString(), connect);
    await database.query(`INSERT INTO f01.usuario(id,email_canonico,password_hash)
      VALUES($1,'excl-a@example.invalid','$argon2id$fixture-only'),($2,'excl-b@example.invalid','$argon2id$fixture-only')`, [userA, userB]);
    await database.query(`INSERT INTO f01.farmacia_referencia(id,nombre_publico) VALUES($1,'Alfa ficticia'),($2,'Beta ficticia')`, [pharmacyA, pharmacyB]);
    await database.query(`INSERT INTO f02.medicamento(nombre,concentracion,presentacion,clasificacion)
      VALUES('producto uno','10 mg','tabletas','venta libre'),('producto dos','5 mg','jarabe','venta libre')`);
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
    manual = new ManualInventory(runner); imports = new ConfirmImport(runner); previews = new PreviewImport(runner);
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

  it('un error de datos bloquea aunque se pida excluir; nada cambia', async () => {
    const item = await preview(uno('1.00', '4') + uno('2.00', '9') + 'producto dos,5 mg,jarabe,venta libre,-1,2\n');
    const before = await snapshot();
    await expect(imports.confirm(secretA, pharmacyA, item.importacionId, { duplicadas: 1, pendientes: 0 })).rejects.toBeInstanceOf(ImportConflictError);
    expect(await snapshot()).toEqual(before);
    expect(await state(item.importacionId)).toBe('VISTA_PREVIA');
  });

  it('números que no coinciden, o de otra farmacia, no cambian nada', async () => {
    const item = await preview(uno('1.00', '4') + uno('2.00', '9') + dos + nuevo);
    const before = await snapshot();
    for (const exclusion of [{ duplicadas: 0, pendientes: 1 }, { duplicadas: 1, pendientes: 0 }, { duplicadas: 2, pendientes: 1 }]) {
      await expect(imports.confirm(secretA, pharmacyA, item.importacionId, exclusion)).rejects.toBeInstanceOf(ImportConflictError);
    }
    await expect(imports.confirm(secretB, pharmacyB, item.importacionId, { duplicadas: 1, pendientes: 1 })).rejects.toThrow();
    await expect(imports.confirm(secretB, pharmacyA, item.importacionId, { duplicadas: 1, pendientes: 1 })).rejects.toThrow();
    expect(await snapshot()).toEqual(before);
    expect(await state(item.importacionId)).toBe('VISTA_PREVIA');
  });

  it('confirma solo las listas, registra las excluidas y Beta no las ve', async () => {
    const item = await preview(uno('1.00', '4') + uno('2.00', '9') + dos + nuevo);
    const before = await snapshot();
    await imports.confirm(secretA, pharmacyA, item.importacionId, { duplicadas: 1, pendientes: 1 });
    expect((await manual.list(secretA, pharmacyA)).map(row => [row.nombre, row.precioReferencial, row.cantidadFisica]))
      .toEqual([['producto dos', 3, 2], ['producto uno', 1, 4]]); // la primera fila, nunca la repetida
    expect(await snapshot()).toEqual({ inventario: before.inventario + 2, movimientos: before.movimientos + 2, catalogo: before.catalogo });
    expect((await imports.history(secretA, pharmacyA))[0]).toMatchObject({ estado: 'CONFIRMADA', filas: 4, importadas: 2, excluidas: 2,
      duplicadas: 1, pendientes: 1, conErrores: 0, agregados: 2, actualizados: 0 });
    const detail = await imports.status(secretA, pharmacyA, item.importacionId);
    expect(detail.excluidas).toEqual([{ fila: 3, motivo: 'FILA_DUPLICADA' }, { fila: 5, motivo: 'REFERENCIA_NO_CONCILIADA' }]);
    expect(detail.cambios).toHaveLength(2);
    expect(await imports.history(secretB, pharmacyB)).toEqual([]);
    await expect(imports.status(secretB, pharmacyB, item.importacionId)).rejects.toThrow();
    // Reintento idempotente: no duplica movimientos.
    await imports.confirm(secretA, pharmacyA, item.importacionId, { duplicadas: 1, pendientes: 1 });
    expect((await snapshot()).movimientos).toBe(before.movimientos + 2);
  });

  it('las filas excluidas se importan después subiendo de nuevo el archivo cuando ya están en el catálogo', async () => {
    const csv = uno('1.00', '4') + uno('2.00', '9') + dos + nuevo;
    await expect(preview(csv)).rejects.toThrow(/ya se confirmó/);
    await database.query(`INSERT INTO f02.medicamento(nombre,concentracion,presentacion,clasificacion)
      VALUES('producto nuevo','1 mg','gotas','venta libre')`);
    const again = await preview(csv);
    await imports.confirm(secretA, pharmacyA, again.importacionId, { duplicadas: 1, pendientes: 0 });
    expect((await manual.list(secretA, pharmacyA)).map(row => row.nombre)).toEqual(['producto dos', 'producto nuevo', 'producto uno']);
    expect((await imports.history(secretA, pharmacyA))[0]).toMatchObject({ importadas: 3, excluidas: 1, agregados: 1, actualizados: 0 });
  });

  it('si una fila lista entra en conflicto no se guarda ninguna', async () => {
    await database.query(`UPDATE f02.inventario SET cantidad_comprometida=1 WHERE farmacia_id=$1
      AND medicamento_id=(SELECT id FROM f02.medicamento WHERE nombre='producto dos')`, [pharmacyA]);
    const item = await preview(uno('7.00', '8') + uno('2.00', '9') + 'producto dos,5 mg,jarabe,venta libre,3.00,0\n');
    const before = (await manual.list(secretA, pharmacyA));
    const counts = await snapshot();
    await expect(imports.confirm(secretA, pharmacyA, item.importacionId, { duplicadas: 1, pendientes: 0 })).rejects.toBeInstanceOf(ImportConflictError);
    expect(await manual.list(secretA, pharmacyA)).toEqual(before);
    expect(await snapshot()).toEqual(counts);
    expect(await state(item.importacionId)).toBe('RECHAZADA');
  });

  it('sin decisión explícita, un archivo con duplicadas sigue sin confirmarse', async () => {
    const item = await preview(uno('5.00', '5') + uno('6.00', '6'));
    const counts = await snapshot();
    await expect(imports.confirm(secretA, pharmacyA, item.importacionId)).rejects.toBeInstanceOf(ImportConflictError);
    expect(await snapshot()).toEqual(counts);
  });

});
