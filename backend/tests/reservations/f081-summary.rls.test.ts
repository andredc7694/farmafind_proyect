import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client, Pool } from 'pg';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { migrateTestDatabase } from '../../src/modules/usuarios/infrastructure/db/migrate.js';
import { migrateF02TestDatabase } from '../../src/modules/inventario/infrastructure/migrate.js';
import { migrateF04TestDatabase } from '../../src/modules/reservas/infrastructure/migrate.js';
import { PgIdentityUnitOfWork } from '../../src/modules/usuarios/infrastructure/db/tenant-transaction.js';
import { PgReservationUnitOfWork } from '../../src/modules/reservas/infrastructure/reservation-unit-of-work.js';
import { PgInventoryTenantRunner } from '../../src/modules/inventario/infrastructure/tenant-unit-of-work.js';
import { CreateReservation } from '../../src/modules/reservas/application/create-reservation.js';
import { ConfirmReservation } from '../../src/modules/reservas/application/confirm-reservation.js';
import { AttentionCenter } from '../../src/modules/reservas/application/attention-center.js';
import { ManualInventory } from '../../src/modules/inventario/application/manual-review.js';

const baseText = process.env.F01_TEST_DATABASE_URL;
const group = baseText ? describe : describe.skip;
const hex = (size: number) => randomBytes(size).toString('hex');
const fingerprintOf = (secret: string) => createHash('sha256').update(Buffer.from(secret, 'hex')).digest();

/** F08.1: los dos resúmenes de la farmacia (reservas e inventario) con PostgreSQL real y RLS Alfa/Beta. */
group('F08.1 PostgreSQL RLS: resúmenes de reservas e inventario', () => {
  let base: Client; let db: Client; let single: Pool; let databaseName = ''; let roleName = '';
  const ids: Record<string, string> = {}; const secrets: Record<string, string> = {};
  const connect = async (url: string) => { const client = new Client({ connectionString: url }); await client.connect(); return client; };
  let reservations: AttentionCenter; let inventory: ManualInventory; let key = 0;
  const nextKey = () => `sum-${++key}-${hex(4)}`;

  beforeAll(async () => {
    const url = new URL(baseText!);
    if (url.hostname !== '127.0.0.1' || url.port !== '55431' || !/^\/farmafind_f01_test_[a-f0-9]{12}$/.test(url.pathname)) throw new Error('F08.1 RLS solo base TEST efimera local');
    base = await connect(baseText!);
    const source = await base.query(`SELECT current_setting('cluster_name') AS cluster,
      (SELECT description FROM pg_shdescription WHERE objoid=(SELECT oid FROM pg_database WHERE datname=current_database())) AS marker`);
    if (source.rows[0]?.cluster !== 'farmafind-f025-test' || source.rows[0]?.marker !== 'FarmaFind F07 TEST efimera') throw new Error('F08.1 RLS requiere el cluster TEST F02.5 identificado');
    const suffix = hex(6); databaseName = `farmafind_f01_test_${suffix}`; roleName = `f081_test_${suffix}`;
    await base.query(`CREATE DATABASE "${databaseName}"`); url.pathname = `/${databaseName}`;
    db = await connect(url.toString());
    await migrateTestDatabase(url.toString(), connect); await migrateF02TestDatabase(url.toString(), connect); await migrateF04TestDatabase(url.toString(), connect);
    for (const label of ['customer', 'ownerA', 'ownerA2', 'ownerB', 'workerA']) {
      ids[label] = randomUUID(); secrets[label] = hex(32);
      await db.query('INSERT INTO f01.usuario(id,email_canonico,password_hash) VALUES($1,$2,$3)', [ids[label], `${label.toLowerCase()}-f081@example.invalid`, '$argon2id$fixture']);
      await db.query("INSERT INTO f01.sesion(usuario_id,token_fingerprint,idle_expires_at,absolute_expires_at) VALUES($1,$2,now()+interval '1 hour',now()+interval '4 hour')", [ids[label], fingerprintOf(secrets[label])]);
    }
    ids.pharmacyA = randomUUID(); ids.pharmacyB = randomUUID();
    await db.query("INSERT INTO f01.farmacia_referencia(id,nombre_publico) VALUES($1,'Alfa F081'),($2,'Beta F081')", [ids.pharmacyA, ids.pharmacyB]);
    const grant = async (user: string, pharmacy: string, role: string, capabilities: string[]) => {
      const member = (await db.query('INSERT INTO f01.usuario_farmacia(usuario_id,farmacia_id,rol) VALUES($1,$2,$3) RETURNING id', [ids[user], pharmacy, role])).rows[0].id;
      for (const capability of capabilities) await db.query('INSERT INTO f01.delegacion(membresia_id,farmacia_id,capacidad,granted_by_usuario_id) VALUES($1,$2,$3,$4)', [member, pharmacy, capability, ids[user]]);
    };
    await grant('ownerA', ids.pharmacyA, 'DUENO', ['reservation.read', 'reservation.accept', 'reservation.deliver', 'reservation.settings', 'inventory.read']);
    await grant('ownerA2', ids.pharmacyA, 'ADMINISTRADOR', ['reservation.read']); // sin inventory.read
    await grant('ownerB', ids.pharmacyB, 'DUENO', ['reservation.read', 'reservation.accept', 'reservation.deliver', 'reservation.settings', 'inventory.read']);
    await grant('workerA', ids.pharmacyA, 'TRABAJADOR', ['reservation.read', 'inventory.read']);
    const meds = [randomUUID(), randomUUID(), randomUUID()];
    for (const [index, id] of meds.entries()) await db.query("INSERT INTO f02.medicamento(id,nombre,concentracion,presentacion,clasificacion) VALUES($1,$2,'10 mg','tableta','venta libre')", [id, `ficticio ${index}`]);
    ids.m0 = meds[0]; ids.m1 = meds[1]; ids.m2 = meds[2];
    // Alfa: 3 productos, uno sin stock disponible (físico = comprometido) y otro con stock. Beta: 1 producto.
    await db.query('INSERT INTO f02.inventario(farmacia_id,medicamento_id,precio_centavos,cantidad_fisica,ultima_revision_at) VALUES($1,$2,1000,10,now()),($1,$3,1000,1,now()),($1,$4,1000,5,now()),($5,$2,1000,40,now())',
      [ids.pharmacyA, meds[0], meds[1], meds[2], ids.pharmacyB]);
    const password = hex(32);
    await base.query(`CREATE ROLE "${roleName}" LOGIN NOSUPERUSER NOBYPASSRLS PASSWORD '${password}'`); await base.query(`GRANT f01_runtime TO "${roleName}"`);
    url.username = roleName; url.password = password;
    single = new Pool({ connectionString: url.toString(), max: 1 }); // una sola conexión: el contexto no debe filtrarse entre peticiones
    const identity = new PgIdentityUnitOfWork(single);
    const reservationUow = new PgReservationUnitOfWork(identity);
    reservations = new AttentionCenter(reservationUow, { now: () => new Date() });
    inventory = new ManualInventory(new PgInventoryTenantRunner(identity));
    const create = new CreateReservation(reservationUow, { now: () => new Date() }, 20); const confirm = new ConfirmReservation(reservationUow, { now: () => new Date() });
    const book = async (pharmacy: string, med: string, quantity: number) => create.execute(secrets.customer, { pharmacyId: pharmacy, medicationId: med, quantity, idempotencyKey: nextKey() });
    await book(ids.pharmacyA, meds[0], 1); await book(ids.pharmacyA, meds[0], 1);   // 2 pendientes en Alfa
    await book(ids.pharmacyA, meds[1], 1);                                          // comprometen la única unidad de meds[1] → sin stock
    const soon = await book(ids.pharmacyA, meds[2], 1); const later = await book(ids.pharmacyA, meds[2], 1);
    await confirm.execute(secrets.ownerA, ids.pharmacyA, soon.reservation.id, nextKey()); await confirm.execute(secrets.ownerA, ids.pharmacyA, later.reservation.id, nextKey());
    await db.query("UPDATE f04.reserva SET recogida_expira_en=now()+interval '30 minutes' WHERE id=$1", [soon.reservation.id]);
    await db.query("UPDATE f04.reserva SET recogida_expira_en=now()+interval '3 hours' WHERE id=$1", [later.reservation.id]);
    await book(ids.pharmacyB, meds[0], 1); // 1 pendiente en Beta
  }, 120000);

  afterAll(async () => {
    if (single) await single.end(); if (db) await db.end();
    if (base) {
      if (databaseName) await base.query(`DROP DATABASE IF EXISTS "${databaseName}"`);
      if (roleName) await base.query(`DROP ROLE IF EXISTS "${roleName}"`);
      await base.end();
    }
  });

  it('el resumen de reservas coincide con SQL directo y es solo de la farmacia propia (conexión única Alfa/Beta)', async () => {
    const direct = async (pharmacy: string) => (await db.query(`SELECT (count(*) FILTER (WHERE estado='PENDIENTE'))::int p, (count(*) FILTER (WHERE estado='CONFIRMADA'))::int c,
      (count(*) FILTER (WHERE estado='CONFIRMADA' AND recogida_expira_en>now() AND recogida_expira_en<=now()+interval '60 minutes'))::int v FROM f04.reserva WHERE farmacia_id=$1`, [pharmacy])).rows[0];
    for (let round = 0; round < 3; round++) {
      const a = await reservations.summary(secrets.ownerA, ids.pharmacyA); const b = await reservations.summary(secrets.ownerB, ids.pharmacyB);
      expect(a).toMatchObject({ pending: 3, confirmed: 2, expiringSoon: 1 }); expect(b).toMatchObject({ pending: 1, confirmed: 0, expiringSoon: 0 });
      const da = await direct(ids.pharmacyA); expect([a.pending, a.confirmed, a.expiringSoon]).toEqual([da.p, da.c, da.v]);
      expect(typeof a.generatedAt).toBe('string');
    }
  }, 30000);

  it('el resumen de inventario coincide con SQL directo, cuenta los productos sin stock y no cruza farmacias', async () => {
    for (let round = 0; round < 3; round++) {
      const a = await inventory.summary(secrets.ownerA, ids.pharmacyA); const b = await inventory.summary(secrets.ownerB, ids.pharmacyB);
      expect(a).toMatchObject({ products: 3, withoutStock: 1 }); expect(b).toMatchObject({ products: 1, withoutStock: 0 });
    }
    const direct = (await db.query('SELECT count(*)::int p, (count(*) FILTER (WHERE cantidad_fisica-cantidad_comprometida<=0))::int s FROM f02.inventario WHERE farmacia_id=$1', [ids.pharmacyA])).rows[0];
    expect(direct).toEqual({ p: 3, s: 1 });
  }, 30000);

  it('cada resumen exige la capacidad de su módulo: reservation.read no abre el inventario ni al revés', async () => {
    await expect(reservations.summary(secrets.ownerA2, ids.pharmacyA)).resolves.toMatchObject({ pending: 3 });
    await expect(inventory.summary(secrets.ownerA2, ids.pharmacyA)).rejects.toBeTruthy(); // ownerA2 no tiene inventory.read
    await expect(inventory.summary(secrets.ownerA, ids.pharmacyA)).resolves.toMatchObject({ products: 3 });
  });

  it('otra farmacia y un cliente son denegados; nadie lee la farmacia ajena', async () => {
    for (const [secret, pharmacy] of [[secrets.ownerB, ids.pharmacyA], [secrets.ownerA, ids.pharmacyB], [secrets.customer, ids.pharmacyA], [secrets.customer, ids.pharmacyB]]) {
      await expect(reservations.summary(secret, pharmacy)).rejects.toBeTruthy();
      await expect(inventory.summary(secret, pharmacy)).rejects.toBeTruthy();
    }
    // F01.2: el trabajador con reservation.read delegada SÍ lee el resumen de su farmacia (ver f012-worker-delegation.rls.test.ts)
    await expect(reservations.summary(secrets.workerA, ids.pharmacyA)).resolves.toMatchObject({ pending: 3 });
  });

  it('leer los resúmenes no cambia ninguna reserva ni inventario', async () => {
    const state = async () => JSON.stringify([(await db.query('SELECT id,estado,version FROM f04.reserva ORDER BY id')).rows, (await db.query('SELECT farmacia_id,medicamento_id,cantidad_fisica,cantidad_comprometida,version FROM f02.inventario ORDER BY farmacia_id,medicamento_id')).rows]);
    const before = await state();
    for (let i = 0; i < 4; i++) { await reservations.summary(secrets.ownerA, ids.pharmacyA); await inventory.summary(secrets.ownerA, ids.pharmacyA); }
    expect(await state()).toBe(before);
  });
});
