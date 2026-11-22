import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client, Pool } from 'pg';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { migrateTestDatabase } from '../../src/modules/usuarios/infrastructure/db/migrate.js';
import { PgIdentityUnitOfWork } from '../../src/modules/usuarios/infrastructure/db/tenant-transaction.js';
import { ActivePharmacyService } from '../../src/modules/usuarios/application/active-pharmacy.js';

const baseUrl = process.env.F01_TEST_DATABASE_URL;
const testGroup = baseUrl ? describe : describe.skip;

testGroup('lectura de membresías propias y selección A/B con RLS real', () => {
  let admin: Client;
  let database: Client;
  let pool: Pool;
  let testName: string;
  let roleName: string;
  let roleCreated = false;
  let service: ActivePharmacyService;
  const users = { multi: randomUUID(), onlyA: randomUUID(), none: randomUUID(), grantor: randomUUID() };
  const pharmacies = { A: randomUUID(), B: randomUUID() };
  const secrets = { multi: randomBytes(32).toString('hex'), onlyA: randomBytes(32).toString('hex'), none: randomBytes(32).toString('hex') };

  beforeAll(async () => {
    const base = new URL(baseUrl!);
    if (base.hostname !== '127.0.0.1' || base.port !== '55431' || base.pathname !== '/farmafind_f01_test') {
      throw new Error('Pruebas F01: solo instancia local aislada y base farmafind_f01_test');
    }
    admin = new Client({ connectionString: baseUrl });
    await admin.connect();
    const suffix = randomBytes(6).toString('hex');
    testName = `farmafind_f01_test_${suffix}`;
    roleName = `f01_test_members_${suffix}`;
    await admin.query(`CREATE DATABASE "${testName}"`);
    const url = new URL(base);
    url.pathname = `/${testName}`;
    database = new Client({ connectionString: url.toString() });
    await database.connect();
    await migrateTestDatabase(url.toString(), async connectionString => {
      const client = new Client({ connectionString });
      await client.connect();
      return client;
    });

    for (const [key, id] of Object.entries(users)) {
      await database.query('INSERT INTO f01.usuario(id,email_canonico,password_hash) VALUES($1,$2,$3)',
        [id, `${key.toLowerCase()}@example.invalid`, '$argon2id$fixture-only']);
    }
    for (const [key, id] of Object.entries(pharmacies)) {
      await database.query('INSERT INTO f01.farmacia_referencia(id,nombre_publico) VALUES($1,$2)',
        [id, `Farmacia ficticia ${key}`]);
    }
    const memberships = new Map<string, string>();
    for (const [key, userId, pharmacyId] of [
      ['multiA', users.multi, pharmacies.A], ['multiB', users.multi, pharmacies.B], ['onlyA', users.onlyA, pharmacies.A],
    ]) {
      const inserted = await database.query<{ id: string }>(
        'INSERT INTO f01.usuario_farmacia(usuario_id,farmacia_id,rol) VALUES($1,$2,$3) RETURNING id',
        [userId, pharmacyId, 'TRABAJADOR']);
      memberships.set(key, inserted.rows[0].id);
    }
    for (const [key, pharmacyId, capability] of [
      ['multiA', pharmacies.A, 'FICTICIA_A'], ['multiB', pharmacies.B, 'FICTICIA_B'],
    ]) {
      await database.query(`
        INSERT INTO f01.delegacion(membresia_id,farmacia_id,capacidad,granted_by_usuario_id)
        VALUES($1,$2,$3,$4)
      `, [memberships.get(key), pharmacyId, capability, users.grantor]);
    }
    for (const key of ['multi', 'onlyA', 'none'] as const) {
      const fingerprint = createHash('sha256').update(Buffer.from(secrets[key], 'hex')).digest();
      await database.query(`
        INSERT INTO f01.sesion(usuario_id,token_fingerprint,idle_expires_at,absolute_expires_at)
        VALUES($1,$2,now()+interval '30 minutes',now()+interval '8 hours')
      `, [users[key], fingerprint]);
    }

    const password = randomBytes(32).toString('hex');
    await admin.query(`CREATE ROLE "${roleName}" LOGIN NOSUPERUSER NOBYPASSRLS PASSWORD '${password}'`);
    roleCreated = true;
    await admin.query(`GRANT f01_runtime TO "${roleName}"`);
    url.username = roleName;
    url.password = password;
    pool = new Pool({ connectionString: url.toString(), max: 2 });
    service = new ActivePharmacyService(new PgIdentityUnitOfWork(pool));
  });

  afterAll(async () => {
    if (pool) await pool.end();
    if (database) await database.end();
    if (admin) {
      if (testName) await admin.query(`DROP DATABASE "${testName}"`);
      if (roleCreated) await admin.query(`DROP ROLE "${roleName}"`);
      await admin.end();
    }
  });

  it('cero/una/varias membresías muestran solo filas propias activas', async () => {
    expect(await service.listAvailable(secrets.none)).toEqual([]);
    expect((await service.listAvailable(secrets.onlyA)).map(item => item.pharmacyId)).toEqual([pharmacies.A]);
    const multi = await service.listAvailable(secrets.multi);
    expect(multi.map(item => item.pharmacyId).sort()).toEqual([pharmacies.A, pharmacies.B].sort());
    expect(multi.find(item => item.pharmacyId === pharmacies.A)?.delegationCodes).toEqual(['FICTICIA_A']);
    expect(multi.find(item => item.pharmacyId === pharmacies.B)?.delegationCodes).toEqual(['FICTICIA_B']);
  });

  it('conocer B no autoriza a la persona que solo pertenece a A', async () => {
    await expect(service.select(secrets.onlyA, pharmacies.B)).rejects.toThrow('No autorizado');
    const selected = await service.select(secrets.multi, pharmacies.B);
    expect(selected).toEqual({ pharmacyId: pharmacies.B, roleCode: 'TRABAJADOR', delegationCodes: ['FICTICIA_B'] });
  });

  it('dos selecciones concurrentes del mismo usuario conservan delegaciones de A y B separadas', async () => {
    const [selectedA, selectedB] = await Promise.all([
      service.select(secrets.multi, pharmacies.A),
      service.select(secrets.multi, pharmacies.B),
    ]);
    expect(selectedA).toEqual({ pharmacyId: pharmacies.A, roleCode: 'TRABAJADOR', delegationCodes: ['FICTICIA_A'] });
    expect(selectedB).toEqual({ pharmacyId: pharmacies.B, roleCode: 'TRABAJADOR', delegationCodes: ['FICTICIA_B'] });
  });

  it('farmacia inactiva y membresía revocada fallan en la siguiente operación', async () => {
    await database.query("UPDATE f01.farmacia_referencia SET estado='INACTIVA' WHERE id=$1", [pharmacies.B]);
    expect((await service.listAvailable(secrets.multi)).map(item => item.pharmacyId)).toEqual([pharmacies.A]);
    await expect(service.select(secrets.multi, pharmacies.B)).rejects.toThrow('No autorizado');
    await database.query("UPDATE f01.farmacia_referencia SET estado='ACTIVA' WHERE id=$1", [pharmacies.B]);
    await database.query("UPDATE f01.usuario_farmacia SET estado='REVOCADA' WHERE usuario_id=$1 AND farmacia_id=$2", [users.multi, pharmacies.B]);
    expect((await service.listAvailable(secrets.multi)).map(item => item.pharmacyId)).toEqual([pharmacies.A]);
    await expect(service.select(secrets.multi, pharmacies.B)).rejects.toThrow('No autorizado');
  });

  it('SQL directo del rol app no ve filas ajenas ni delegaciones sin actor', async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SET LOCAL ROLE f01_runtime');
      expect((await client.query('SELECT id FROM f01.usuario_farmacia')).rows).toEqual([]);
      expect((await client.query('SELECT id FROM f01.delegacion')).rows).toEqual([]);
      await client.query("SELECT set_config('app.actor_user_id',$1,true)", [users.onlyA]);
      const own = await client.query('SELECT farmacia_id FROM f01.usuario_farmacia');
      expect(own.rows.map(row => row.farmacia_id)).toEqual([pharmacies.A]);
      expect((await client.query('SELECT id FROM f01.delegacion')).rows).toEqual([]);
      await client.query('ROLLBACK');
    } finally { client.release(); }
  });
});
