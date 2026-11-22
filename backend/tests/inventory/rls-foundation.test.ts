import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client, Pool } from 'pg';
import { createHash, createHmac, randomBytes, randomUUID } from 'node:crypto';
import { migrateTestDatabase } from '../../src/modules/usuarios/infrastructure/db/migrate.js';
import { migrateF02TestDatabase } from '../../src/modules/inventario/infrastructure/migrate.js';
import { PgIdentityUnitOfWork } from '../../src/modules/usuarios/infrastructure/db/tenant-transaction.js';
import express from 'express';
import request from 'supertest';
import { ListCatalog } from '../../src/modules/medicamentos/application/list-catalog.js';
import { createCatalogRouter } from '../../src/modules/medicamentos/presentation/catalog-router.js';
import { AuthorizedCatalogReader } from '../../src/modules/medicamentos/infrastructure/authorized-catalog.js';
import { ManualInventory } from '../../src/modules/inventario/application/manual-review.js';
import { PgInventoryTenantRunner } from '../../src/modules/inventario/infrastructure/tenant-unit-of-work.js';
import { createInventoryRouter } from '../../src/modules/inventario/presentation/inventory-router.js';
import { PreviewImport } from '../../src/modules/inventario/application/preview-import.js';
import { createImportRouter } from '../../src/modules/inventario/presentation/import-router.js';
import { ConfirmImport, ImportConflictError } from '../../src/modules/inventario/application/confirm-import.js';

const baseText = process.env.F01_TEST_DATABASE_URL;
const group = baseText ? describe : describe.skip;
const hex = (size: number) => randomBytes(size).toString('hex');

group('fundamento PostgreSQL RLS F02', () => {
  let base: Client;
  let database: Client;
  let pool: Pool;
  let databaseName = '';
  let roleName = '';
  let ownerA: string;
  let ownerB: string;
  let workerA: string;
  let pharmacyA: string;
  let pharmacyB: string;
  let medication: string;
  let secretA: string;
  let secretB: string;
  let workerSecret: string;
  let runtimeConnection: string;

  async function connect(url: string): Promise<Client> {
    const client = new Client({ connectionString: url });
    await client.connect();
    return client;
  }

  beforeAll(async () => {
    const baseUrl = new URL(baseText!);
    if (baseUrl.hostname !== '127.0.0.1' || baseUrl.port !== '55431' ||
        baseUrl.pathname !== '/farmafind_f01_test') throw new Error('F02 RLS: solo base local TEST');
    base = await connect(baseText!);
    const suffix = hex(6);
    databaseName = `farmafind_f01_test_${suffix}`;
    roleName = `f02_test_runtime_${suffix}`;
    await base.query(`CREATE DATABASE "${databaseName}"`);
    baseUrl.pathname = `/${databaseName}`;
    database = await connect(baseUrl.toString());
    await migrateTestDatabase(baseUrl.toString(), connect);
    await migrateF02TestDatabase(baseUrl.toString(), connect);
    ownerA = randomUUID(); ownerB = randomUUID(); workerA = randomUUID();
    pharmacyA = randomUUID(); pharmacyB = randomUUID();
    secretA = hex(32); secretB = hex(32); workerSecret = hex(32);
    await database.query(`INSERT INTO f01.usuario(id,email_canonico,password_hash)
      VALUES($1,$2,$3),($4,$5,$6),($7,$8,$9)`,
      [ownerA,'f02-a@example.invalid','$argon2id$fixture-only',ownerB,'f02-b@example.invalid','$argon2id$fixture-only',
        workerA,'f02-worker@example.invalid','$argon2id$fixture-only']);
    await database.query('INSERT INTO f01.farmacia_referencia(id,nombre_publico) VALUES($1,$2),($3,$4)',
      [pharmacyA,'Farmacia Alfa ficticia',pharmacyB,'Farmacia Beta ficticia']);
    const membershipA = (await database.query(`INSERT INTO f01.usuario_farmacia(usuario_id,farmacia_id,rol)
      VALUES($1,$2,'DUENO') RETURNING id`, [ownerA, pharmacyA])).rows[0].id;
    const membershipB = (await database.query(`INSERT INTO f01.usuario_farmacia(usuario_id,farmacia_id,rol)
      VALUES($1,$2,'DUENO') RETURNING id`, [ownerB, pharmacyB])).rows[0].id;
    await database.query(`INSERT INTO f01.usuario_farmacia(usuario_id,farmacia_id,rol)
      VALUES($1,$2,'TRABAJADOR')`, [workerA, pharmacyA]);
    for (const [member, pharmacy, user] of [[membershipA,pharmacyA,ownerA],[membershipB,pharmacyB,ownerB]]) {
      for (const capability of ['inventory.read','inventory.write','inventory.history',
        'inventory.import.preview','inventory.import.confirm']) {
        await database.query(`INSERT INTO f01.delegacion(membresia_id,farmacia_id,capacidad,granted_by_usuario_id)
          VALUES($1,$2,$3,$4)`, [member, pharmacy, capability, user]);
      }
    }
    for (const [user, secret] of [[ownerA,secretA],[ownerB,secretB],[workerA,workerSecret]]) {
      await database.query(`INSERT INTO f01.sesion(usuario_id,token_fingerprint,idle_expires_at,absolute_expires_at)
        VALUES($1,$2,now()+interval '1 hour',now()+interval '4 hours')`,
      [user, createHash('sha256').update(Buffer.from(secret, 'hex')).digest()]);
    }
    medication = (await database.query(`INSERT INTO f02.medicamento(nombre,concentracion,presentacion,clasificacion)
      VALUES('producto ficticio','10 mg','tabletas','venta libre') RETURNING id`)).rows[0].id;
    await database.query(`INSERT INTO f02.inventario(farmacia_id,medicamento_id,precio_centavos,cantidad_fisica,ultima_revision_at)
      VALUES($1,$3,1500,10,now()),($2,$3,2000,20,now())`, [pharmacyA, pharmacyB, medication]);
    const password = hex(32);
    await base.query(`CREATE ROLE "${roleName}" LOGIN NOSUPERUSER NOBYPASSRLS PASSWORD '${password}'`);
    await base.query(`GRANT f01_runtime TO "${roleName}"`);
    baseUrl.username = roleName; baseUrl.password = password;
    runtimeConnection = baseUrl.toString();
    pool = new Pool({ connectionString: runtimeConnection, max: 1 });
  });

  afterAll(async () => {
    if (pool) await pool.end();
    if (database) await database.end();
    if (base) {
      if (databaseName) await base.query(`DROP DATABASE "${databaseName}"`);
      if (roleName && (await base.query('SELECT 1 FROM pg_roles WHERE rolname=$1', [roleName])).rows.length) {
        await base.query(`DROP ROLE "${roleName}"`);
      }
      await base.end();
    }
  });

  it('usa un login sin superusuario ni BYPASSRLS y tablas FORCE RLS', async () => {
    const role = (await base.query('SELECT rolsuper,rolbypassrls FROM pg_roles WHERE rolname=$1', [roleName])).rows[0];
    expect(role).toMatchObject({ rolsuper: false, rolbypassrls: false });
    const tables = await database.query(`SELECT relname,relrowsecurity,relforcerowsecurity FROM pg_class
      WHERE oid IN ('f02.inventario'::regclass,'f02.movimiento'::regclass)`);
    expect(tables.rows).toHaveLength(2);
    expect(tables.rows.every(row => row.relrowsecurity && row.relforcerowsecurity)).toBe(true);
  });

  it('sin sesión válida ni contexto no revela inventario, incluso con farmacia conocida', async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN'); await client.query('SET LOCAL ROLE f01_runtime');
      await client.query("SELECT set_config('app.farmacia_id',$1,true)", [pharmacyA]);
      expect((await client.query('SELECT id FROM f02.inventario')).rows).toEqual([]);
      await client.query("SELECT set_config('app.actor_user_id',$1,true)", [ownerA]);
      await client.query("SELECT set_config('app.session_fingerprint',$1,true)", ['f'.repeat(64)]);
      expect((await client.query('SELECT id FROM f02.inventario')).rows).toEqual([]);
      await client.query('ROLLBACK');
    } finally { client.release(); }
  });

  it('A solo ve A y no puede escribir B, aun con identificador conocido', async () => {
    const uow = new PgIdentityUnitOfWork(pool);
    const visible = await uow.runWithClient(secretA, async (identity, client, actor) => {
      await identity.useAuthorizedPharmacy(actor, pharmacyA);
      const rows = await client.query('SELECT farmacia_id FROM f02.inventario');
      await expect(client.query(`UPDATE f02.inventario SET cantidad_fisica=99
        WHERE farmacia_id=$1 AND medicamento_id=$2`, [pharmacyB, medication])).resolves.toMatchObject({ rows: [] });
      return rows.rows;
    });
    expect(visible.map(row => row.farmacia_id)).toEqual([pharmacyA]);
    await expect(uow.runWithClient(secretA, async (identity) => {
      await identity.useAuthorizedPharmacy(ownerA, pharmacyB);
    })).rejects.toThrow();
  });

  it('HTTP catálogo exige sesión y permiso, distingue presentaciones y no expone mutación global', async () => {
    await database.query(`INSERT INTO f02.medicamento(nombre,concentracion,presentacion,clasificacion)
      VALUES('producto ficticio','10 mg','jarabe','venta libre')`);
    const app = express();
    app.use('/api/v1', createCatalogRouter(new ListCatalog(new AuthorizedCatalogReader(new PgIdentityUnitOfWork(pool))),
      { allowedOrigin: 'http://127.0.0.1:5173', csrfKey: Buffer.alloc(32), cookieSecure: false }));
    expect((await request(app).get('/api/v1/catalogo/medicamentos')).status).toBe(401);
    const allowed = await request(app).get('/api/v1/catalogo/medicamentos?q=producto&page=1')
      .set('Cookie', `ff-session-local=${secretA}`);
    expect(allowed.status).toBe(200);
    expect(allowed.body).toHaveLength(2);
    expect(new Set(allowed.body.map((item: { presentacion: string }) => item.presentacion)).size).toBe(2);
    expect((await request(app).get('/api/v1/catalogo/medicamentos')
      .set('Cookie', `ff-session-local=${workerSecret}`)).status).toBe(404);
    expect((await request(app).post('/api/v1/catalogo/medicamentos')
      .set('Cookie', `ff-session-local=${secretA}`)).status).toBe(404);
  });

  it('revisión manual confirma inventario y movimiento juntos; deniega Beta y trabajador', async () => {
    const service = new ManualInventory(new PgInventoryTenantRunner(new PgIdentityUnitOfWork(pool)));
    const before = await service.list(secretA, pharmacyA);
    expect(before).toHaveLength(1);
    const revised = await service.review(secretA, pharmacyA, medication,
      { physicalQuantity: 12, priceCents: 1700, reason: 'Conteo ficticio' });
    expect(revised.cantidadFisica).toBe(12);
    expect(revised.precioReferencial).toBe(17);
    expect((await service.movements(secretA, pharmacyA))).toHaveLength(1);
    expect((await service.list(secretA, pharmacyA))[0].ultimaRevision).toBe(revised.ultimaRevision);
    await expect(service.review(secretA, pharmacyB, medication,
      { physicalQuantity: 99, priceCents: 100, reason: 'Ataque' })).rejects.toThrow();
    await expect(service.review(workerSecret, pharmacyA, medication,
      { physicalQuantity: 99, priceCents: 100, reason: 'Ataque' })).rejects.toThrow();
    expect((await service.list(secretB, pharmacyB))[0].cantidadFisica).toBe(20);
    await database.query('UPDATE f02.inventario SET cantidad_comprometida=11 WHERE farmacia_id=$1', [pharmacyA]);
    await expect(service.review(secretA, pharmacyA, medication,
      { physicalQuantity: 10, priceCents: 2000, reason: 'Conteo imposible' })).rejects.toThrow();
    expect((await service.movements(secretA, pharmacyA))).toHaveLength(1);
    expect((await service.list(secretA, pharmacyA))[0].cantidadFisica).toBe(12);
  });

  it('API manual exige cookie/CSRF y minimiza los errores ajenos', async () => {
    const key = Buffer.alloc(32, 7);
    const nonce = hex(32);
    const token = createHmac('sha256', key).update('f01-csrf\0').update(nonce).update('\0')
      .update(secretA).digest('hex');
    const cookie = `ff-session-local=${secretA}; ff-csrf-local=${nonce}`;
    const app = express();
    app.use('/api/v1', createInventoryRouter(new ManualInventory(
      new PgInventoryTenantRunner(new PgIdentityUnitOfWork(pool))),
    { allowedOrigin: 'http://127.0.0.1:5173', csrfKey: key, cookieSecure: false }));
    const path = `/api/v1/farmacias/${pharmacyA}/inventario/${medication}`;
    expect((await request(app).get(`/api/v1/farmacias/${pharmacyA}/inventario`)).status).toBe(401);
    expect((await request(app).put(path).set('Cookie', cookie)
      .send({ precioReferencial: 18, cantidadFisica: 13, motivo: 'Conteo ficticio' })).status).toBe(403);
    const reviewed = await request(app).put(path).set('Cookie', cookie)
      .set('Origin', 'http://127.0.0.1:5173').set('X-CSRF-Token', token)
      .send({ precioReferencial: 18, cantidadFisica: 13, motivo: 'Conteo ficticio' });
    expect(reviewed.status).toBe(200);
    expect(reviewed.body.cantidadFisica).toBe(13);
    const ownHistory = await request(app).get(`/api/v1/farmacias/${pharmacyA}/inventario/movimientos`)
      .set('Cookie', cookie);
    expect(ownHistory.status).toBe(200);
    expect(ownHistory.body).toHaveLength(2);
    expect((await request(app).get(`/api/v1/farmacias/${pharmacyB}/inventario`)
      .set('Cookie', cookie)).status).toBe(404);
    expect((await request(app).put(`/api/v1/farmacias/${pharmacyB}/inventario/${medication}`)
      .set('Cookie', cookie).set('Origin', 'http://127.0.0.1:5173')
      .set('X-CSRF-Token', token)
      .send({ precioReferencial: 1, cantidadFisica: 99, motivo: 'Ataque' })).status).toBe(404);
  });

  it('vista previa HTTP guarda solo filas normalizadas y no cambia stock', async () => {
    const key = Buffer.alloc(32, 9);
    const nonce = hex(32);
    const token = createHmac('sha256', key).update('f01-csrf\0').update(nonce).update('\0')
      .update(secretA).digest('hex');
    const cookie = `ff-session-local=${secretA}; ff-csrf-local=${nonce}`;
    const app = express();
    const runner = new PgInventoryTenantRunner(new PgIdentityUnitOfWork(pool));
    app.use('/api/v1', createImportRouter(new PreviewImport(runner), new ConfirmImport(runner),
    { allowedOrigin: 'http://127.0.0.1:5173', csrfKey: key, cookieSecure: false }));
    const csv = Buffer.from('nombre,concentracion,presentacion,clasificacion,precio,cantidad\n' +
      'producto ficticio,10 mg,tabletas,venta libre,19.50,14\n');
    const mapping = { nombre: 'nombre', concentracion: 'concentracion', presentacion: 'presentacion',
      clasificacion: 'clasificacion', precioReferencial: 'precio', cantidadFisica: 'cantidad' };
    const path = `/api/v1/farmacias/${pharmacyA}/importaciones/vista-previa`;
    expect((await request(app).post(path).set('Cookie', cookie).attach('archivo', csv, 'stock.csv')
      .field('mapeo', JSON.stringify(mapping))).status).toBe(403);
    const created = await request(app).post(path).set('Cookie', cookie)
      .set('Origin', 'http://127.0.0.1:5173').set('X-CSRF-Token', token)
      .attach('archivo', csv, 'stock.csv').field('mapeo', JSON.stringify(mapping));
    expect(created.status, JSON.stringify(created.body)).toBe(200);
    expect(created.body.estado).toBe('VISTA_PREVIA');
    expect(created.body.filas[0]).toMatchObject({ medicationId: medication, physicalQuantity: 14, errorCode: null });
    expect((await database.query('SELECT count(*)::int AS count FROM f02.importacion')).rows[0].count).toBe(1);
    expect((await database.query('SELECT cantidad_fisica FROM f02.inventario WHERE farmacia_id=$1',
      [pharmacyA])).rows[0].cantidad_fisica).toBe(13);
    const duplicate = await request(app).post(path).set('Cookie', cookie)
      .set('Origin', 'http://127.0.0.1:5173').set('X-CSRF-Token', token)
      .attach('archivo', csv, 'stock.csv').field('mapeo', JSON.stringify(mapping));
    expect(duplicate.status).toBe(409);
    expect((await request(app).post(`/api/v1/farmacias/${pharmacyB}/importaciones/vista-previa`)
      .set('Cookie', cookie).set('Origin', 'http://127.0.0.1:5173').set('X-CSRF-Token', token)
      .attach('archivo', csv, 'stock.csv').field('mapeo', JSON.stringify(mapping))).status).toBe(404);
  });

  it('confirmación aplica una vez o revierte todo el archivo ante conflicto', async () => {
    const runner = new PgInventoryTenantRunner(new PgIdentityUnitOfWork(pool));
    const preview = new PreviewImport(runner);
    const confirm = new ConfirmImport(runner);
    const mapping = { nombre: 'nombre', concentracion: 'concentracion', presentacion: 'presentacion',
      clasificacion: 'clasificacion', precioReferencial: 'precio', cantidadFisica: 'cantidad' };
    const header = 'nombre,concentracion,presentacion,clasificacion,precio,cantidad\n';
    const valid = await preview.run(secretA, pharmacyA,
      Buffer.from(`${header}producto ficticio,10 mg,tabletas,venta libre,21.00,14\n`),
      'valido.csv', mapping);
    expect(valid.errores).toEqual([]);
    const key = Buffer.alloc(32, 4);
    const nonce = hex(32);
    const token = createHmac('sha256', key).update('f01-csrf\0').update(nonce).update('\0')
      .update(secretA).digest('hex');
    const app = express();
    app.use('/api/v1', createImportRouter(preview, confirm,
      { allowedOrigin: 'http://127.0.0.1:5173', csrfKey: key, cookieSecure: false }));
    const path = `/api/v1/farmacias/${pharmacyA}/importaciones/${valid.importacionId}/confirmar`;
    const submit = () => request(app).post(path)
      .set('Cookie', `ff-session-local=${secretA}; ff-csrf-local=${nonce}`)
      .set('Origin', 'http://127.0.0.1:5173').set('X-CSRF-Token', token);
    const first = await submit();
    expect(first.status, JSON.stringify(first.body)).toBe(200);
    expect(first.body.estado).toBe('CONFIRMADA');
    expect((await submit()).status).toBe(200);
    const afterValid = await database.query('SELECT count(*)::int AS count FROM f02.movimiento WHERE farmacia_id=$1', [pharmacyA]);
    expect(afterValid.rows[0].count).toBe(3);
    expect((await database.query('SELECT cantidad_fisica FROM f02.inventario WHERE farmacia_id=$1 AND medicamento_id=$2',
      [pharmacyA, medication])).rows[0].cantidad_fisica).toBe(14);
    const invalid = await preview.run(secretA, pharmacyA, Buffer.from(`${header}` +
      'producto ficticio,10 mg,tabletas,venta libre,20.00,10\n' +
      'producto ficticio,10 mg,jarabe,venta libre,18.00,5\n'), 'conflicto.csv', mapping);
    expect(invalid.errores).toEqual([]);
    const failed = await request(app).post(`/api/v1/farmacias/${pharmacyA}/importaciones/${invalid.importacionId}/confirmar`)
      .set('Cookie', `ff-session-local=${secretA}; ff-csrf-local=${nonce}`)
      .set('Origin', 'http://127.0.0.1:5173').set('X-CSRF-Token', token);
    expect(failed.status).toBe(409);
    expect((await confirm.status(secretA, pharmacyA, invalid.importacionId)).estado).toBe('RECHAZADA');
    expect((await database.query('SELECT count(*)::int AS count FROM f02.movimiento WHERE farmacia_id=$1',
      [pharmacyA])).rows[0].count).toBe(3);
    expect((await database.query('SELECT count(*)::int AS count FROM f02.inventario WHERE farmacia_id=$1',
      [pharmacyA])).rows[0].count).toBe(1);
    expect((await request(app).post(`/api/v1/farmacias/${pharmacyB}/importaciones/${valid.importacionId}/confirmar`)
      .set('Cookie', `ff-session-local=${secretA}; ff-csrf-local=${nonce}`)
      .set('Origin', 'http://127.0.0.1:5173').set('X-CSRF-Token', token)).status).toBe(404);
  });

  it('vista previa inválida y vencida no aplican ninguna fila', async () => {
    const runner = new PgInventoryTenantRunner(new PgIdentityUnitOfWork(pool));
    const preview = new PreviewImport(runner);
    const confirm = new ConfirmImport(runner);
    const mapping = { nombre: 'nombre', concentracion: 'concentracion', presentacion: 'presentacion',
      clasificacion: 'clasificacion', precioReferencial: 'precio', cantidadFisica: 'cantidad' };
    const header = 'nombre,concentracion,presentacion,clasificacion,precio,cantidad\n';
    const bad = await preview.run(secretA, pharmacyA,
      Buffer.from(`${header}producto ficticio,10 mg,jarabe,venta libre,-1,5\n`), 'invalido.csv', mapping);
    expect(bad.errores).toHaveLength(1);
    await expect(confirm.confirm(secretA, pharmacyA, bad.importacionId)).rejects.toBeInstanceOf(ImportConflictError);
    expect((await confirm.status(secretA, pharmacyA, bad.importacionId)).estado).toBe('RECHAZADA');
    const old = await preview.run(secretA, pharmacyA,
      Buffer.from(`${header}producto ficticio,10 mg,jarabe,venta libre,19.00,6\n`), 'viejo.csv', mapping);
    await database.query(`UPDATE f02.importacion SET created_at=now()-interval '1 hour',
      expires_at=now()-interval '30 minutes' WHERE id=$1`, [old.importacionId]);
    await expect(confirm.confirm(secretA, pharmacyA, old.importacionId)).rejects.toBeInstanceOf(ImportConflictError);
    expect((await confirm.status(secretA, pharmacyA, old.importacionId)).estado).toBe('EXPIRADA');
    expect((await database.query('SELECT count(*)::int AS count FROM f02.inventario WHERE farmacia_id=$1',
      [pharmacyA])).rows[0].count).toBe(1);
  });

  it('revocar la capacidad de confirmar después de vista previa bloquea la escritura', async () => {
    const runner = new PgInventoryTenantRunner(new PgIdentityUnitOfWork(pool));
    const preview = new PreviewImport(runner);
    const confirm = new ConfirmImport(runner);
    const item = await preview.run(secretA, pharmacyA, Buffer.from(
      'nombre,concentracion,presentacion,clasificacion,precio,cantidad\n' +
      'producto ficticio,10 mg,jarabe,venta libre,22.00,7\n'), 'revocado.csv',
    { nombre: 'nombre', concentracion: 'concentracion', presentacion: 'presentacion',
      clasificacion: 'clasificacion', precioReferencial: 'precio', cantidadFisica: 'cantidad' });
    await database.query(`UPDATE f01.delegacion SET estado='REVOCADA',revoked_at=now()
      WHERE farmacia_id=$1 AND capacidad='inventory.import.confirm'`, [pharmacyA]);
    await expect(confirm.confirm(secretA, pharmacyA, item.importacionId)).rejects.toThrow();
    expect((await database.query('SELECT estado FROM f02.importacion WHERE id=$1',
      [item.importacionId])).rows[0].estado).toBe('VISTA_PREVIA');
    expect((await database.query('SELECT count(*)::int AS count FROM f02.inventario WHERE farmacia_id=$1',
      [pharmacyA])).rows[0].count).toBe(1);
    await database.query(`UPDATE f01.delegacion SET estado='ACTIVA',revoked_at=NULL
      WHERE farmacia_id=$1 AND capacidad='inventory.import.confirm'`, [pharmacyA]);
  });

  it('dos confirmaciones concurrentes dejan un solo movimiento', async () => {
    const runner = new PgInventoryTenantRunner(new PgIdentityUnitOfWork(pool));
    const preview = new PreviewImport(runner);
    const item = await preview.run(secretA, pharmacyA, Buffer.from(
      'nombre,concentracion,presentacion,clasificacion,precio,cantidad\n' +
      'producto ficticio,10 mg,jarabe,venta libre,23.00,8\n'), 'concurrente.csv',
    { nombre: 'nombre', concentracion: 'concentracion', presentacion: 'presentacion',
      clasificacion: 'clasificacion', precioReferencial: 'precio', cantidadFisica: 'cantidad' });
    const before = Number((await database.query('SELECT count(*)::int AS count FROM f02.movimiento WHERE farmacia_id=$1',
      [pharmacyA])).rows[0].count);
    const concurrentPool = new Pool({ connectionString: runtimeConnection, max: 2 });
    try {
      const concurrent = new ConfirmImport(new PgInventoryTenantRunner(new PgIdentityUnitOfWork(concurrentPool)));
      const results = await Promise.all([
        concurrent.confirm(secretA, pharmacyA, item.importacionId),
        concurrent.confirm(secretA, pharmacyA, item.importacionId),
      ]);
      expect(results.map(result => result.estado)).toEqual(['CONFIRMADA','CONFIRMADA']);
    } finally { await concurrentPool.end(); }
    expect(Number((await database.query('SELECT count(*)::int AS count FROM f02.movimiento WHERE farmacia_id=$1',
      [pharmacyA])).rows[0].count)).toBe(before + 1);
  });

  it('TRABAJADOR carece de permiso y una delegación revocada deja de conceder lectura', async () => {
    const uow = new PgIdentityUnitOfWork(pool);
    const workerRows = await uow.runWithClient(workerSecret, async (identity, client, actor) => {
      await identity.useAuthorizedPharmacy(actor, pharmacyA);
      return (await client.query('SELECT id FROM f02.inventario')).rows;
    });
    expect(workerRows).toEqual([]);
    await database.query(`UPDATE f01.delegacion SET estado='REVOCADA',revoked_at=now()
      WHERE farmacia_id=$1 AND capacidad='inventory.read'`, [pharmacyA]);
    // A still has inventory.write; revoking read alone cannot suppress that separate capability.
    const ownerRows = await uow.runWithClient(secretA, async (identity, client, actor) => {
      await identity.useAuthorizedPharmacy(actor, pharmacyA);
      return (await client.query('SELECT id FROM f02.inventario')).rows;
    });
    expect(ownerRows.length).toBeGreaterThan(0);
    await database.query(`UPDATE f01.delegacion SET estado='REVOCADA',revoked_at=now()
      WHERE farmacia_id=$1 AND capacidad IN ('inventory.write','inventory.history','inventory.import.confirm')`, [pharmacyA]);
    const revokedRows = await uow.runWithClient(secretA, async (identity, client, actor) => {
      await identity.useAuthorizedPharmacy(actor, pharmacyA);
      return (await client.query('SELECT id FROM f02.inventario')).rows;
    });
    expect(revokedRows).toEqual([]);
  });

  it('el rol runtime no puede concederse una capacidad de inventario', async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN'); await client.query('SET LOCAL ROLE f01_runtime');
      await client.query("SELECT set_config('app.actor_user_id',$1,true)", [workerA]);
      await client.query("SELECT set_config('app.farmacia_id',$1,true)", [pharmacyA]);
      const membership = (await database.query(`SELECT id FROM f01.usuario_farmacia
        WHERE usuario_id=$1 AND farmacia_id=$2`, [workerA, pharmacyA])).rows[0].id;
      await expect(client.query(`INSERT INTO f01.delegacion
        (membresia_id,farmacia_id,capacidad,granted_by_usuario_id) VALUES($1,$2,$3,$4)`,
      [membership, pharmacyA, 'inventory.write', workerA])).rejects.toMatchObject({ code: '42501' });
      await client.query('ROLLBACK');
    } finally { client.release(); }
  });

  it('el pool reutilizado no conserva el actor ni la farmacia A', async () => {
    const uow = new PgIdentityUnitOfWork(pool);
    const rows = await uow.runWithClient(secretB, async (identity, client, actor) => {
      await identity.useAuthorizedPharmacy(actor, pharmacyB);
      return (await client.query('SELECT farmacia_id FROM f02.inventario')).rows;
    });
    expect(rows.map(row => row.farmacia_id)).toEqual([pharmacyB]);
    const client = await pool.connect();
    try {
      const row = (await client.query(`SELECT current_setting('app.actor_user_id',true) AS actor,
        current_setting('app.farmacia_id',true) AS pharmacy`)).rows[0];
      expect(row.actor).toBeFalsy(); expect(row.pharmacy).toBeFalsy();
    } finally { client.release(); }
  });
});
