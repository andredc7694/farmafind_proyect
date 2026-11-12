import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client, Pool } from 'pg';
import { randomBytes, randomUUID } from 'node:crypto';
import { migrateTestDatabase } from '../../src/modules/usuarios/infrastructure/db/migrate.js';

const baseUrl = process.env.F01_TEST_DATABASE_URL;
const testGroup = baseUrl ? describe : describe.skip;

testGroup('RLS F01 directo con login no privilegiado', () => {
  let admin: Client;
  let database: Client;
  let pool: Pool;
  let testName: string;
  let roleName: string;
  let actorA: string;
  let actorB: string;
  let pharmacyA: string;
  let pharmacyB: string;

  beforeAll(async () => {
    const base = new URL(baseUrl!);
    if (base.hostname !== '127.0.0.1' || base.port !== '55431' || base.pathname !== '/farmafind_f01_test') {
      throw new Error('Pruebas F01: solo instancia local aislada y base farmafind_f01_test');
    }
    admin = new Client({ connectionString: baseUrl });
    await admin.connect();
    const suffix = randomBytes(6).toString('hex');
    testName = `farmafind_f01_test_${suffix}`;
    roleName = `f01_test_direct_${suffix}`;
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

    actorA = randomUUID(); actorB = randomUUID();
    pharmacyA = randomUUID(); pharmacyB = randomUUID();
    await database.query('INSERT INTO f01.usuario(id,email_canonico,password_hash) VALUES($1,$2,$3),($4,$5,$6)',
      [actorA, 'rls-a@example.invalid', '$argon2id$fixture-only', actorB, 'rls-b@example.invalid', '$argon2id$fixture-only']);
    await database.query('INSERT INTO f01.farmacia_referencia(id,nombre_publico) VALUES($1,$2),($3,$4)',
      [pharmacyA, 'Farmacia ficticia A', pharmacyB, 'Farmacia ficticia B']);
    await database.query('INSERT INTO f01.usuario_farmacia(usuario_id,farmacia_id,rol) VALUES($1,$2,$3),($4,$5,$6)',
      [actorA, pharmacyA, 'TRABAJADOR', actorB, pharmacyB, 'TRABAJADOR']);

    const password = randomBytes(32).toString('hex');
    await admin.query(`CREATE ROLE "${roleName}" LOGIN NOSUPERUSER NOBYPASSRLS PASSWORD '${password}'`);
    await admin.query(`GRANT f01_runtime TO "${roleName}"`);
    url.username = roleName;
    url.password = password;
    pool = new Pool({ connectionString: url.toString(), max: 1 });
  });

  afterAll(async () => {
    if (pool) await pool.end();
    if (database) await database.end();
    if (admin) {
      if (testName) await admin.query(`DROP DATABASE "${testName}"`);
      if (roleName) await admin.query(`DROP ROLE "${roleName}"`);
      await admin.end();
    }
  });

  it('sin actor no ve ninguna membresía ni sesión aunque presente farmacia_id', async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SET LOCAL ROLE f01_runtime');
      await client.query("SELECT set_config('app.farmacia_id',$1,true)", [pharmacyB]);
      expect((await client.query('SELECT id FROM f01.usuario_farmacia')).rows).toEqual([]);
      expect((await client.query('SELECT usuario_id FROM f01.sesion')).rows).toEqual([]);
      await client.query('ROLLBACK');
    } finally { client.release(); }
  });

  it('actor A solo lee A, aun cuando se fije el identificador de B', async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SET LOCAL ROLE f01_runtime');
      await client.query("SELECT set_config('app.actor_user_id',$1,true)", [actorA]);
      await client.query("SELECT set_config('app.farmacia_id',$1,true)", [pharmacyB]);
      const visible = await client.query('SELECT farmacia_id FROM f01.usuario_farmacia');
      expect(visible.rows.map(row => row.farmacia_id)).toEqual([pharmacyA]);
      await client.query('ROLLBACK');
    } finally { client.release(); }
  });

  for (const operation of ['INSERT', 'UPDATE', 'DELETE'] as const) {
    for (const target of ['propia', 'ajena'] as const) {
    it(`${operation} de membresía ${target} queda denegado hasta EXC-01/ROL-01`, async () => {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query('SET LOCAL ROLE f01_runtime');
        await client.query("SELECT set_config('app.actor_user_id',$1,true)", [actorA]);
        await client.query("SELECT set_config('app.farmacia_id',$1,true)", [pharmacyA]);
        const sql = operation === 'INSERT'
          ? 'INSERT INTO f01.usuario_farmacia(usuario_id,farmacia_id,rol) VALUES($1,$2,$3)'
          : operation === 'UPDATE'
            ? 'UPDATE f01.usuario_farmacia SET farmacia_id=$2 WHERE usuario_id=$1'
            : 'DELETE FROM f01.usuario_farmacia WHERE usuario_id=$1';
        const targetActor = target === 'propia' ? actorA : actorB;
        const targetPharmacy = target === 'propia' ? pharmacyA : pharmacyB;
        const values = operation === 'INSERT' ? [targetActor, targetPharmacy, 'TRABAJADOR']
          : operation === 'UPDATE' ? [targetActor, pharmacyB] : [targetActor];
        await expect(client.query(sql, values)).rejects.toMatchObject({ code: '42501' });
        await client.query('ROLLBACK');
      } finally { client.release(); }
    });
    }
  }
});
