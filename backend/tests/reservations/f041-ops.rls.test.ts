import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client, Pool } from 'pg';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { migrateTestDatabase } from '../../src/modules/usuarios/infrastructure/db/migrate.js';
import { migrateF02TestDatabase } from '../../src/modules/inventario/infrastructure/migrate.js';
import { migrateF04TestDatabase } from '../../src/modules/reservas/infrastructure/migrate.js';
import { PgIdentityUnitOfWork } from '../../src/modules/usuarios/infrastructure/db/tenant-transaction.js';
import { PgReservationUnitOfWork } from '../../src/modules/reservas/infrastructure/reservation-unit-of-work.js';
import { CreateReservation } from '../../src/modules/reservas/application/create-reservation.js';
import { ConfirmReservation } from '../../src/modules/reservas/application/confirm-reservation.js';
import { CancelReservation } from '../../src/modules/reservas/application/cancel-reservation.js';
import { ManagePickupWindow } from '../../src/modules/reservas/application/manage-pickup-window.js';
import { AttentionCenter } from '../../src/modules/reservas/application/attention-center.js';
import { PickupPreferenceError } from '../../src/modules/reservas/domain/pickup-preference.js';

const baseText = process.env.F01_TEST_DATABASE_URL;
const group = baseText ? describe : describe.skip;
const hex = (size: number) => randomBytes(size).toString('hex');
const fingerprintOf = (secret: string) => createHash('sha256').update(Buffer.from(secret, 'hex')).digest();

/** F04.1: preferencia de recogida (US3), centro de atención, historial y exportación (US1–US2) con PostgreSQL real. */
group('F04.1 PostgreSQL RLS: preferencia, centro de atención, historial y exportación', () => {
  let base: Client; let db: Client; let pool: Pool; let single: Pool; let databaseName = ''; let roleName = ''; let runtimeUrl = '';
  const ids: Record<string, string> = {}; const secrets: Record<string, string> = {};
  let medication = ''; let medicationLoad = '';
  const connect = async (url: string) => { const client = new Client({ connectionString: url }); await client.connect(); return client; };
  const uowOf = (target: Pool) => new PgReservationUnitOfWork(new PgIdentityUnitOfWork(target));
  const fixed = (iso: string) => ({ now: () => new Date(iso) });
  let key = 0; const nextKey = (label: string) => `${label}-${++key}-${hex(4)}`;

  beforeAll(async () => {
    const url = new URL(baseText!);
    if (url.hostname !== '127.0.0.1' || url.port !== '55431' || !/^\/farmafind_f01_test_[a-f0-9]{12}$/.test(url.pathname)) throw new Error('F04.1 RLS solo base TEST efimera local');
    base = await connect(baseText!);
    const source = await base.query(`SELECT current_setting('cluster_name') AS cluster,
      (SELECT description FROM pg_shdescription WHERE objoid=(SELECT oid FROM pg_database WHERE datname=current_database())) AS marker`);
    if (source.rows[0]?.cluster !== 'farmafind-f025-test' || source.rows[0]?.marker !== 'FarmaFind F07 TEST efimera') throw new Error('F04.1 RLS requiere el cluster TEST F02.5 identificado');
    const suffix = hex(6); databaseName = `farmafind_f01_test_${suffix}`; roleName = `f041_test_${suffix}`;
    await base.query(`CREATE DATABASE "${databaseName}"`); url.pathname = `/${databaseName}`;
    db = await connect(url.toString());
    await migrateTestDatabase(url.toString(), connect); await migrateF02TestDatabase(url.toString(), connect);
    expect((await migrateF04TestDatabase(url.toString(), connect)).length).toBeGreaterThan(0);
    expect(await migrateF04TestDatabase(url.toString(), connect)).toEqual([]); // la migración 008 es idempotente
    for (const label of ['customer1', 'customer2', 'ownerA', 'ownerB']) {
      ids[label] = randomUUID(); secrets[label] = hex(32);
      await db.query('INSERT INTO f01.usuario(id,email_canonico,password_hash) VALUES($1,$2,$3)', [ids[label], `${label.toLowerCase()}-f041@example.invalid`, '$argon2id$fixture']);
      await db.query("INSERT INTO f01.sesion(usuario_id,token_fingerprint,idle_expires_at,absolute_expires_at) VALUES($1,$2,now()+interval '1 hour',now()+interval '4 hour')", [ids[label], fingerprintOf(secrets[label])]);
    }
    ids.pharmacyA = randomUUID(); ids.pharmacyB = randomUUID();
    await db.query("INSERT INTO f01.farmacia_referencia(id,nombre_publico) VALUES($1,'Alfa F041'),($2,'Beta F041')", [ids.pharmacyA, ids.pharmacyB]);
    for (const [owner, pharmacy] of [['ownerA', ids.pharmacyA], ['ownerB', ids.pharmacyB]]) {
      const member = (await db.query("INSERT INTO f01.usuario_farmacia(usuario_id,farmacia_id,rol) VALUES($1,$2,'DUENO') RETURNING id", [ids[owner], pharmacy])).rows[0].id;
      for (const capability of ['reservation.read', 'reservation.accept', 'reservation.deliver', 'reservation.settings']) {
        await db.query('INSERT INTO f01.delegacion(membresia_id,farmacia_id,capacidad,granted_by_usuario_id) VALUES($1,$2,$3,$4)', [member, pharmacy, capability, ids[owner]]);
      }
    }
    medication = randomUUID(); medicationLoad = randomUUID();
    await db.query("INSERT INTO f02.medicamento(id,nombre,concentracion,presentacion,clasificacion) VALUES($1,'ficticio uno','10 mg','tableta','venta libre'),($2,'ficticio dos','20 mg','capsula','venta libre')", [medication, medicationLoad]);
    await db.query('INSERT INTO f02.inventario(farmacia_id,medicamento_id,precio_centavos,cantidad_fisica,ultima_revision_at) VALUES($1,$3,1000,50,now()),($2,$3,1000,50,now()),($1,$4,1000,10,now())', [ids.pharmacyA, ids.pharmacyB, medication, medicationLoad]);
    const password = hex(32);
    await base.query(`CREATE ROLE "${roleName}" LOGIN NOSUPERUSER NOBYPASSRLS PASSWORD '${password}'`); await base.query(`GRANT f01_runtime TO "${roleName}"`);
    url.username = roleName; url.password = password; runtimeUrl = url.toString();
    pool = new Pool({ connectionString: runtimeUrl, max: 20 }); single = new Pool({ connectionString: runtimeUrl, max: 1 });
  }, 120000);

  afterAll(async () => {
    if (pool) await pool.end(); if (single) await single.end(); if (db) await db.end();
    if (base) {
      if (databaseName) await base.query(`DROP DATABASE IF EXISTS "${databaseName}"`);
      if (roleName) await base.query(`DROP ROLE IF EXISTS "${roleName}"`);
      await base.end();
    }
  });

  async function reserve(customer: 'customer1' | 'customer2', pharmacy: string, quantity = 1, preference?: unknown, clock = fixed('2026-11-24T15:00:00Z'), medicationId = medication) {
    return new CreateReservation(uowOf(pool), clock, 20).execute(secrets[customer], { pharmacyId: pharmacy, medicationId, quantity, idempotencyKey: nextKey('create'),
      ...(preference === undefined ? {} : { pickupPreference: preference }) });
  }
  async function asActor(user: string, pharmacy: string | null, work: (client: import('pg').PoolClient) => Promise<unknown>) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query("SELECT set_config('app.actor_user_id',$1,true),set_config('app.session_fingerprint',$2,true),set_config('app.farmacia_id',$3,true)",
        [ids[user], fingerprintOf(secrets[user]).toString('hex'), pharmacy ?? '']);
      return await work(client);
    } finally { await client.query('ROLLBACK'); client.release(); }
  }
  const stock = async (pharmacy: string, med = medication) => (await db.query('SELECT cantidad_fisica,cantidad_comprometida FROM f02.inventario WHERE farmacia_id=$1 AND medicamento_id=$2', [pharmacy, med])).rows[0];

  it('la migración 008 crea la tabla con RLS forzada y sin permisos de modificación para el rol de aplicación', async () => {
    const info = await db.query(`SELECT relrowsecurity,relforcerowsecurity FROM pg_class WHERE oid='f04.preferencia_recogida'::regclass`);
    expect(info.rows[0]).toEqual({ relrowsecurity: true, relforcerowsecurity: true });
    const privileges = await db.query(`SELECT has_table_privilege($1,'f04.preferencia_recogida','SELECT') AS lee, has_table_privilege($1,'f04.preferencia_recogida','INSERT') AS inserta,
      has_table_privilege($1,'f04.preferencia_recogida','UPDATE') AS cambia, has_table_privilege($1,'f04.preferencia_recogida','DELETE') AS borra,
      has_table_privilege('f04_expiration_worker','f04.preferencia_recogida','SELECT') AS worker`, [roleName]);
    expect(privileges.rows[0]).toEqual({ lee: true, inserta: true, cambia: false, borra: false, worker: false });
  });

  it('RLS de la preferencia: la ven su dueño y la farmacia con reservation.read; no otro cliente ni otra farmacia; nadie la modifica', async () => {
    const made = await reserve('customer1', ids.pharmacyA, 1, { type: 'MINUTES', minutes: 60 });
    const reservationId = made.reservation.id;
    expect(made.reservation.pickupPreference).toEqual({ type: 'MINUTES', minutes: 60 });
    const count = (user: string, pharmacy: string | null) => asActor(user, pharmacy, async client => (await client.query('SELECT count(*)::int AS n FROM f04.preferencia_recogida WHERE reserva_id=$1', [reservationId])).rows[0].n);
    expect(await count('customer1', null)).toBe(1);
    expect(await count('ownerA', ids.pharmacyA)).toBe(1);
    expect(await count('customer2', null)).toBe(0);
    expect(await count('ownerB', ids.pharmacyB)).toBe(0);
    expect(await count('ownerB', ids.pharmacyA)).toBe(0);
    for (const sql of ["UPDATE f04.preferencia_recogida SET minutos=30", 'DELETE FROM f04.preferencia_recogida']) {
      await expect(asActor('customer1', null, client => client.query(sql))).rejects.toMatchObject({ code: '42501' });
      await expect(asActor('ownerA', ids.pharmacyA, client => client.query(sql))).rejects.toMatchObject({ code: '42501' });
    }
    // Inserción ajena: otro cliente no puede adjuntar una preferencia a la reserva de customer1, ni el dueño de la farmacia.
    const without = await reserve('customer1', ids.pharmacyA, 1);
    for (const [user, pharmacy] of [['customer2', ids.pharmacyA], ['ownerA', ids.pharmacyA]] as const) {
      await expect(asActor(user, pharmacy, client => client.query("INSERT INTO f04.preferencia_recogida(reserva_id,farmacia_id,usuario_id,tipo,minutos) VALUES($1,$2,$3,'MINUTOS',30)",
        [without.reservation.id, ids.pharmacyA, ids[user]]))).rejects.toMatchObject({ code: '42501' });
    }
    // Ni siquiera el dueño puede adjuntarla a una farmacia distinta de la reserva.
    await expect(asActor('customer1', ids.pharmacyB, client => client.query("INSERT INTO f04.preferencia_recogida(reserva_id,farmacia_id,usuario_id,tipo,minutos) VALUES($1,$2,$3,'MINUTOS',30)",
      [without.reservation.id, ids.pharmacyB, ids.customer1]))).rejects.toMatchObject({ code: '42501' });
    expect((await db.query('SELECT count(*)::int AS n FROM f04.preferencia_recogida WHERE reserva_id=$1', [without.reservation.id])).rows[0].n).toBe(0);
  }, 30000);

  it('la preferencia no cambia el stock comprometido ni el vencimiento; este sigue siendo confirmación + plazo', async () => {
    const before = await stock(ids.pharmacyA);
    const plain = await reserve('customer1', ids.pharmacyA, 2);
    const withMinutes = await reserve('customer1', ids.pharmacyA, 2, { type: 'MINUTES', minutes: 120 });
    const withWindow = await reserve('customer2', ids.pharmacyA, 2, { type: 'WINDOW', start: '2026-11-24T15:30:00.000Z', end: '2026-11-24T16:30:00.000Z' });
    const after = await stock(ids.pharmacyA);
    expect(Number(after.cantidad_comprometida) - Number(before.cantidad_comprometida)).toBe(6); // 3 reservas × 2, iguales con o sin preferencia
    expect(after.cantidad_fisica).toBe(before.cantidad_fisica);
    const confirm = new ConfirmReservation(uowOf(pool), fixed('2026-11-24T15:10:00Z'));
    const pickups: string[] = [];
    for (const item of [plain, withMinutes, withWindow]) pickups.push((await confirm.execute(secrets.ownerA, ids.pharmacyA, item.reservation.id, nextKey('confirm'))).pickupExpiresAt!);
    expect(new Set(pickups)).toEqual(new Set(['2026-11-24T19:10:00.000Z'])); // 15:10 + 4 h por defecto, idéntico con o sin preferencia
    // Cambiar la configuración después, o consultar la reserva, no recalcula nada.
    await new ManagePickupWindow(uowOf(pool)).save(secrets.ownerA, ids.pharmacyA, 8);
    const stored = (await db.query('SELECT recogida_expira_en FROM f04.reserva WHERE id=ANY($1::uuid[])', [[plain, withMinutes, withWindow].map(item => item.reservation.id)])).rows;
    expect(new Set(stored.map(row => (row.recogida_expira_en as Date).toISOString()))).toEqual(new Set(['2026-11-24T19:10:00.000Z']));
    const late = await reserve('customer1', ids.pharmacyA, 1, { type: 'MINUTES', minutes: 120 });
    const lateConfirmed = await confirm.execute(secrets.ownerA, ids.pharmacyA, late.reservation.id, nextKey('confirm'));
    expect(lateConfirmed.pickupExpiresAt).toBe('2026-11-24T23:10:00.000Z'); // 8 h solo para confirmaciones nuevas
    await new ManagePickupWindow(uowOf(pool)).save(secrets.ownerA, ids.pharmacyA, 4);
  }, 40000);

  it('una preferencia inválida o fuera del plazo no crea reserva ni compromete stock; un fallo al guardarla revierte todo', async () => {
    const before = await stock(ids.pharmacyA); const reservations = async () => (await db.query('SELECT count(*)::int AS n FROM f04.reserva')).rows[0].n;
    const count = await reservations();
    await new ManagePickupWindow(uowOf(pool)).save(secrets.ownerA, ids.pharmacyA, 1);
    await expect(reserve('customer1', ids.pharmacyA, 1, { type: 'MINUTES', minutes: 120 })).rejects.toBeInstanceOf(PickupPreferenceError);
    await expect(reserve('customer1', ids.pharmacyA, 1, { type: 'WINDOW', start: '2026-11-24T15:30:00.000Z', end: '2026-11-24T16:30:00.000Z' })).rejects.toBeInstanceOf(PickupPreferenceError);
    await new ManagePickupWindow(uowOf(pool)).save(secrets.ownerA, ids.pharmacyA, 4);
    // Fallo en la base (violación de CHECK al insertar): se revierte la creación completa, incluido el compromiso de stock.
    await expect(uowOf(pool).run(secrets.customer1, ids.pharmacyA, null, (ports, actor) => ports.reservations.create({ actorUserId: actor, pharmacyId: ids.pharmacyA,
      medicationId: medication, quantity: 1, responseExpiresAt: new Date('2026-11-24T15:20:00Z'), idempotencyKey: nextKey('forced'),
      preference: { type: 'MINUTES', minutes: 45 } as never }))).rejects.toMatchObject({ code: '23514' });
    expect(await reservations()).toBe(count);
    expect(await stock(ids.pharmacyA)).toEqual(before);
    expect((await db.query("SELECT count(*)::int AS n FROM f04.outbox_evento WHERE tipo='RESERVA_CREADA' AND creado_en>now()-interval '1 minute'")).rows[0].n).toBeGreaterThanOrEqual(0);
  }, 30000);

  it('el reintento idempotente devuelve la misma reserva con su preferencia; otra preferencia con la misma clave es conflicto', async () => {
    const create = new CreateReservation(uowOf(pool), fixed('2026-11-24T15:00:00Z'), 20);
    const input = { pharmacyId: ids.pharmacyA, medicationId: medication, quantity: 1, idempotencyKey: nextKey('idem'), pickupPreference: { type: 'MINUTES', minutes: 30 } };
    const first = await create.execute(secrets.customer1, input); const again = await create.execute(secrets.customer1, input);
    expect(again.replay).toBe(true); expect(again.reservation.id).toBe(first.reservation.id);
    expect(again.reservation.pickupPreference).toEqual({ type: 'MINUTES', minutes: 30 });
    await expect(create.execute(secrets.customer1, { ...input, pickupPreference: { type: 'MINUTES', minutes: 60 } })).rejects.toThrow(/Idempotencia/);
    await expect(create.execute(secrets.customer1, { ...input, pickupPreference: undefined })).rejects.toThrow(/Idempotencia/);
    expect((await db.query('SELECT count(*)::int AS n FROM f04.preferencia_recogida WHERE reserva_id=$1', [first.reservation.id])).rows[0].n).toBe(1);
  }, 30000);

  it('AC05 con preferencia: 100 solicitudes concurrentes sobre 10 unidades conceden exactamente 10', async () => {
    const create = new CreateReservation(uowOf(pool), fixed('2026-11-24T15:00:00Z'), 20);
    const results = await Promise.allSettled(Array.from({ length: 100 }, (_, index) => create.execute(index % 2 === 0 ? secrets.customer1 : secrets.customer2,
      { pharmacyId: ids.pharmacyA, medicationId: medicationLoad, quantity: 1, idempotencyKey: nextKey('load'),
        pickupPreference: index % 3 === 0 ? { type: 'MINUTES', minutes: 60 } : index % 3 === 1 ? { type: 'WINDOW', start: '2026-11-24T15:10:00.000Z', end: '2026-11-24T15:40:00.000Z' } : undefined })));
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(10);
    expect(await stock(ids.pharmacyA, medicationLoad)).toMatchObject({ cantidad_fisica: 10, cantidad_comprometida: 10 });
    expect((await db.query("SELECT count(*)::int AS n FROM f04.reserva WHERE medicamento_id=$1 AND estado='PENDIENTE'", [medicationLoad])).rows[0].n).toBe(10);
    expect((await db.query('SELECT count(*)::int AS n FROM f04.preferencia_recogida p JOIN f04.reserva r ON r.id=p.reserva_id WHERE r.medicamento_id=$1', [medicationLoad])).rows[0].n)
      .toBeLessThanOrEqual(10);
  }, 120000);

  it('el centro de atención muestra solo la farmacia propia (conexión única reutilizada), con filtros y sin cambiar nada', async () => {
    const b1 = await reserve('customer1', ids.pharmacyB, 1, { type: 'MINUTES', minutes: 30 });
    const snapshotState = async () => JSON.stringify([(await db.query('SELECT id,estado,version FROM f04.reserva ORDER BY id')).rows, (await db.query('SELECT farmacia_id,cantidad_fisica,cantidad_comprometida FROM f02.inventario ORDER BY farmacia_id,medicamento_id')).rows]);
    const stateBefore = await snapshotState();
    const centerA = new AttentionCenter(uowOf(single), fixed('2026-11-24T15:30:00Z'));
    for (let round = 0; round < 3; round++) {
      const a = await centerA.snapshot(secrets.ownerA, ids.pharmacyA, {}); const b = await centerA.snapshot(secrets.ownerB, ids.pharmacyB, {});
      expect(a.items.length).toBeGreaterThan(5); expect(b.items.map(item => item.id)).toEqual([b1.reservation.id]);
      expect(a.items.map(item => item.id)).not.toContain(b1.reservation.id);
      expect(new Set(a.items.map(item => item.id)).size).toBe(a.items.length); // cero duplicados
      expect(b.items[0]).toMatchObject({ state: 'PENDIENTE', quantity: 1, medication: 'ficticio uno 10 mg tableta', pickupPreference: { type: 'MINUTES', minutes: 30 } });
      await expect(centerA.snapshot(secrets.ownerA, ids.pharmacyB, {})).rejects.toBeTruthy(); // dueño Alfa sobre Beta
      await expect(centerA.snapshot(secrets.ownerB, ids.pharmacyA, {})).rejects.toBeTruthy();
      await expect(centerA.snapshot(secrets.customer1, ids.pharmacyA, {})).rejects.toBeTruthy(); // un cliente no tiene reservation.read
    }
    const confirmed = await centerA.snapshot(secrets.ownerA, ids.pharmacyA, { state: 'CONFIRMADA' });
    expect(confirmed.items.length).toBeGreaterThan(0); expect(confirmed.items.every(item => item.state === 'CONFIRMADA')).toBe(true);
    const future = await centerA.snapshot(secrets.ownerA, ids.pharmacyA, { from: new Date('2030-01-01T00:00:00Z') });
    expect(future.items).toEqual([]);
    expect(await snapshotState()).toBe(stateBefore); // leer no muta nada
  }, 40000);

  it('historial paginado sin duplicados ni huecos y exportación CSV solo de la farmacia propia y sin datos del cliente', async () => {
    const cancel = new CancelReservation(uowOf(pool), fixed('2026-11-24T16:00:00Z'));
    const closedA: string[] = [];
    for (let i = 0; i < 5; i++) {
      const made = await reserve('customer1', ids.pharmacyA, 1, i % 2 === 0 ? { type: 'MINUTES', minutes: 30 } : undefined);
      await cancel.execute(secrets.customer1, made.reservation.id, nextKey('cancel')); closedA.push(made.reservation.id);
    }
    const closedB = await reserve('customer2', ids.pharmacyB, 1); await cancel.execute(secrets.customer2, closedB.reservation.id, nextKey('cancel'));
    const center = new AttentionCenter(uowOf(single), fixed('2026-11-24T16:00:00Z'));
    const seen: string[] = []; let cursor: string | undefined; let pages = 0;
    do {
      const page = await center.history(secrets.ownerA, ids.pharmacyA, { state: 'CANCELADA', limit: 2, ...(cursor ? { cursor } : {}) });
      expect(page.items.length).toBeLessThanOrEqual(2); seen.push(...page.items.map(item => item.id)); cursor = page.nextCursor ?? undefined; pages++;
    } while (cursor && pages < 20);
    expect(new Set(seen).size).toBe(seen.length); // sin duplicados
    const allCancelledA = (await db.query("SELECT id FROM f04.reserva WHERE farmacia_id=$1 AND estado='CANCELADA'", [ids.pharmacyA])).rows.map(row => row.id).sort();
    expect([...seen].sort()).toEqual(allCancelledA); // sin huecos
    expect(seen).not.toContain(closedB.reservation.id);
    expect(closedA.every(id => seen.includes(id))).toBe(true);
    const exportedA = await center.exportCsv(secrets.ownerA, ids.pharmacyA, {}); const exportedB = await center.exportCsv(secrets.ownerB, ids.pharmacyB, {});
    expect(exportedA.rows).toBeGreaterThanOrEqual(5); expect(exportedA.truncated).toBe(false);
    expect(exportedA.csv).toContain('Preferencia estimada'); expect(exportedA.csv).toContain('no es una cita');
    expect(exportedA.csv).not.toContain(closedB.reservation.id.slice(0, 8));
    expect(exportedB.csv).toContain(closedB.reservation.id.slice(0, 8)); expect(exportedB.rows).toBe(1);
    for (const sensitive of [ids.customer1, ids.customer2, 'customer1-f041', 'customer2-f041', '@example.invalid']) {
      expect(exportedA.csv + exportedB.csv).not.toContain(sensitive);
    }
    await expect(center.exportCsv(secrets.ownerA, ids.pharmacyB, {})).rejects.toBeTruthy();
    await expect(center.history(secrets.customer1, ids.pharmacyA, {})).rejects.toBeTruthy();
    const entregadas = await center.history(secrets.ownerA, ids.pharmacyA, { state: 'ENTREGADA' });
    expect(entregadas.items.every(item => item.state === 'ENTREGADA')).toBe(true);
  }, 60000);
});
