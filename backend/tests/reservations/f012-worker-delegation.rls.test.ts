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

/** F01.2: matriz del trabajador (rol TRABAJADOR) con PostgreSQL real, RLS y una sola conexión Alfa/Beta. */
group('F01.2 PostgreSQL RLS: trabajadores con delegación explícita', () => {
  let base: Client; let db: Client; let single: Pool; let databaseName = ''; let roleName = '';
  const ids: Record<string, string> = {}; const secrets: Record<string, string> = {}; const members: Record<string, string> = {};
  const connect = async (url: string) => { const client = new Client({ connectionString: url }); await client.connect(); return client; };
  let center: AttentionCenter; let inventory: ManualInventory; let confirm: ConfirmReservation; let create: CreateReservation; let key = 0;
  const nextKey = () => `w-${++key}-${hex(4)}`;

  beforeAll(async () => {
    const url = new URL(baseText!);
    if (url.hostname !== '127.0.0.1' || url.port !== '55431' || !/^\/farmafind_f01_test_[a-f0-9]{12}$/.test(url.pathname)) throw new Error('F01.2 RLS solo base TEST efimera local');
    base = await connect(baseText!);
    const source = await base.query(`SELECT current_setting('cluster_name') AS cluster,
      (SELECT description FROM pg_shdescription WHERE objoid=(SELECT oid FROM pg_database WHERE datname=current_database())) AS marker`);
    if (source.rows[0]?.cluster !== 'farmafind-f025-test' || source.rows[0]?.marker !== 'FarmaFind F07 TEST efimera') throw new Error('F01.2 RLS requiere el cluster TEST F02.5 identificado');
    const suffix = hex(6); databaseName = `farmafind_f01_test_${suffix}`; roleName = `f012_test_${suffix}`;
    await base.query(`CREATE DATABASE "${databaseName}"`); url.pathname = `/${databaseName}`;
    db = await connect(url.toString());
    await migrateTestDatabase(url.toString(), connect); await migrateF02TestDatabase(url.toString(), connect); await migrateF04TestDatabase(url.toString(), connect);
    const labels = ['customer', 'ownerA', 'workerOk', 'workerReadOnly', 'workerNone', 'workerRevoked', 'workerSuspended', 'workerClosed', 'workerInactivePharmacy', 'workerB', 'workerForged', 'ownerB'];
    for (const label of labels) {
      ids[label] = randomUUID(); secrets[label] = hex(32);
      await db.query('INSERT INTO f01.usuario(id,email_canonico,password_hash) VALUES($1,$2,$3)', [ids[label], `${label.toLowerCase()}-f012@example.invalid`, '$argon2id$fixture']);
      await db.query("INSERT INTO f01.sesion(usuario_id,token_fingerprint,idle_expires_at,absolute_expires_at) VALUES($1,$2,now()+interval '1 hour',now()+interval '4 hour')", [ids[label], fingerprintOf(secrets[label])]);
    }
    ids.pharmacyA = randomUUID(); ids.pharmacyB = randomUUID(); ids.pharmacyC = randomUUID();
    await db.query("INSERT INTO f01.farmacia_referencia(id,nombre_publico) VALUES($1,'Alfa F012'),($2,'Beta F012'),($3,'Gamma F012')", [ids.pharmacyA, ids.pharmacyB, ids.pharmacyC]);
    const grant = async (user: string, pharmacy: string, role: string, capabilities: string[]) => {
      members[user] = (await db.query('INSERT INTO f01.usuario_farmacia(usuario_id,farmacia_id,rol) VALUES($1,$2,$3) RETURNING id', [ids[user], pharmacy, role])).rows[0].id;
      for (const capability of capabilities) await db.query('INSERT INTO f01.delegacion(membresia_id,farmacia_id,capacidad,granted_by_usuario_id) VALUES($1,$2,$3,$4)', [members[user], pharmacy, capability, ids[user]]);
    };
    const all = ['reservation.read', 'reservation.accept', 'reservation.deliver', 'inventory.read', 'inventory.write'];
    await grant('ownerA', ids.pharmacyA, 'DUENO', [...all, 'membership.manage']);
    await grant('workerOk', ids.pharmacyA, 'TRABAJADOR', all);
    await grant('workerReadOnly', ids.pharmacyA, 'TRABAJADOR', ['reservation.read', 'inventory.read']);
    await grant('workerNone', ids.pharmacyA, 'TRABAJADOR', []);
    await grant('workerRevoked', ids.pharmacyA, 'TRABAJADOR', all);
    await grant('workerSuspended', ids.pharmacyA, 'TRABAJADOR', all);
    await grant('workerClosed', ids.pharmacyA, 'TRABAJADOR', all);
    await grant('workerInactivePharmacy', ids.pharmacyC, 'TRABAJADOR', all);
    await grant('workerB', ids.pharmacyB, 'TRABAJADOR', all);
    await grant('workerForged', ids.pharmacyA, 'TRABAJADOR', ['membership.manage', 'platform.admin', 'reservation.read']);
    await grant('ownerB', ids.pharmacyB, 'DUENO', all);
    await db.query("UPDATE f01.delegacion SET estado='REVOCADA',revoked_at=now() WHERE membresia_id=$1", [members.workerRevoked]);
    await db.query("UPDATE f01.usuario_farmacia SET estado='SUSPENDIDA' WHERE id=$1", [members.workerSuspended]);
    await db.query("UPDATE f01.sesion SET estado='REVOCADA' WHERE usuario_id=$1", [ids.workerClosed]);
    await db.query("UPDATE f01.farmacia_referencia SET estado='INACTIVA' WHERE id=$1", [ids.pharmacyC]);
    ids.med = randomUUID();
    await db.query("INSERT INTO f02.medicamento(id,nombre,concentracion,presentacion,clasificacion) VALUES($1,'ficticio f012','10 mg','tableta','venta libre')", [ids.med]);
    await db.query('INSERT INTO f02.inventario(farmacia_id,medicamento_id,precio_centavos,cantidad_fisica,ultima_revision_at) VALUES($1,$2,1000,10,now()),($3,$2,1000,40,now())', [ids.pharmacyA, ids.med, ids.pharmacyB]);
    const password = hex(32);
    await base.query(`CREATE ROLE "${roleName}" LOGIN NOSUPERUSER NOBYPASSRLS PASSWORD '${password}'`); await base.query(`GRANT f01_runtime TO "${roleName}"`);
    url.username = roleName; url.password = password;
    single = new Pool({ connectionString: url.toString(), max: 1 });
    const identity = new PgIdentityUnitOfWork(single); const uow = new PgReservationUnitOfWork(identity);
    center = new AttentionCenter(uow, { now: () => new Date() }); inventory = new ManualInventory(new PgInventoryTenantRunner(identity));
    create = new CreateReservation(uow, { now: () => new Date() }, 20); confirm = new ConfirmReservation(uow, { now: () => new Date() });
  }, 120000);

  afterAll(async () => {
    if (single) await single.end(); if (db) await db.end();
    if (base) { if (databaseName) await base.query(`DROP DATABASE IF EXISTS "${databaseName}"`); if (roleName) await base.query(`DROP ROLE IF EXISTS "${roleName}"`); await base.end(); }
  });
  const book = () => create.execute(secrets.customer, { pharmacyId: ids.pharmacyA, medicationId: ids.med, quantity: 1, idempotencyKey: nextKey() });

  it('el trabajador con la capacidad delegada lee los resúmenes de SU farmacia y nada más', async () => {
    await book();
    await expect(center.summary(secrets.workerOk, ids.pharmacyA)).resolves.toMatchObject({ pending: 1 });
    await expect(inventory.summary(secrets.workerOk, ids.pharmacyA)).resolves.toMatchObject({ products: 1 });
    await expect(center.summary(secrets.workerReadOnly, ids.pharmacyA)).resolves.toMatchObject({ pending: 1 });
    await expect(inventory.summary(secrets.workerOk, ids.pharmacyB)).rejects.toBeTruthy();
    await expect(center.summary(secrets.workerOk, ids.pharmacyB)).rejects.toBeTruthy();
    await expect(inventory.summary(secrets.workerOk, ids.pharmacyA)).resolves.toMatchObject({ products: 1 });
  });

  it('acepta una reserva solo con reservation.accept; con solo lectura se deniega', async () => {
    const pending = await book();
    await expect(confirm.execute(secrets.workerReadOnly, ids.pharmacyA, pending.reservation.id, nextKey())).rejects.toBeTruthy();
    await expect(confirm.execute(secrets.workerOk, ids.pharmacyA, pending.reservation.id, nextKey())).resolves.toBeTruthy();
    const state = await db.query('SELECT estado FROM f04.reserva WHERE id=$1', [pending.reservation.id]);
    expect(state.rows[0].estado).toBe('CONFIRMADA');
  });

  it('sin delegación, revocada, membresía suspendida, sesión cerrada o farmacia inactiva: todo denegado', async () => {
    for (const who of ['workerNone', 'workerRevoked', 'workerSuspended', 'workerClosed']) {
      await expect(center.summary(secrets[who], ids.pharmacyA)).rejects.toBeTruthy();
      await expect(inventory.summary(secrets[who], ids.pharmacyA)).rejects.toBeTruthy();
    }
    await expect(center.summary(secrets.workerInactivePharmacy, ids.pharmacyC)).rejects.toBeTruthy();
    await expect(inventory.summary(secrets.workerInactivePharmacy, ids.pharmacyC)).rejects.toBeTruthy();
  });

  it('revocar la delegación corta el acceso en la petición siguiente', async () => {
    await expect(inventory.summary(secrets.workerReadOnly, ids.pharmacyA)).resolves.toBeTruthy();
    await db.query("UPDATE f01.delegacion SET estado='REVOCADA',revoked_at=now() WHERE membresia_id=$1 AND capacidad='inventory.read'", [members.workerReadOnly]);
    await expect(inventory.summary(secrets.workerReadOnly, ids.pharmacyA)).rejects.toBeTruthy();
    await expect(center.summary(secrets.workerReadOnly, ids.pharmacyA)).resolves.toBeTruthy();
  });

  it('no hay escalada: el trabajador no gestiona personal ni capacidades de plataforma aunque exista la fila de delegación', async () => {
    const client = await single.connect();
    try {
      for (const [user, expected] of [['workerForged', false], ['ownerA', true]] as const) {
        await client.query('BEGIN');
        await client.query("SELECT set_config('app.actor_user_id',$1,true),set_config('app.farmacia_id',$2,true),set_config('app.session_fingerprint',$3,true)",
          [ids[user], ids.pharmacyA, fingerprintOf(secrets[user]).toString('hex')]);
        const manage = (await client.query('SELECT f01.can_manage_local_worker($1,NULL) AS ok', [ids.pharmacyA])).rows[0].ok;
        const invMembership = (await client.query("SELECT f02.can_inventory_action($1,'membership.manage') AS ok", [ids.pharmacyA])).rows[0].ok;
        const invPlatform = (await client.query("SELECT f02.can_inventory_action($1,'platform.admin') AS ok", [ids.pharmacyA])).rows[0].ok;
        const resMembership = (await client.query("SELECT f04.can_reservation_action($1,'membership.manage') AS ok", [ids.pharmacyA])).rows[0].ok;
        await client.query('ROLLBACK');
        expect(manage).toBe(expected); expect([invMembership, invPlatform, resMembership]).toEqual([false, false, false]);
      }
    } finally { client.release(); }
  });

  it('delegar no cambia el rol y otras farmacias siguen cerradas', async () => {
    const role = (await db.query('SELECT rol FROM f01.usuario_farmacia WHERE id=$1', [members.workerOk])).rows[0].rol;
    expect(role).toBe('TRABAJADOR');
    await expect(center.summary(secrets.workerB, ids.pharmacyA)).rejects.toBeTruthy();
    await expect(inventory.summary(secrets.ownerB, ids.pharmacyA)).rejects.toBeTruthy();
  });
});
