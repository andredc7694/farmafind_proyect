import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client, Pool } from 'pg';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { migrateTestDatabase } from '../../src/modules/usuarios/infrastructure/db/migrate.js';
import { PgIdentityUnitOfWork } from '../../src/modules/usuarios/infrastructure/db/tenant-transaction.js';
import { SessionRestrictedError } from '../../src/modules/usuarios/application/ports.js';

const baseUrl = process.env.F01_TEST_DATABASE_URL;
const group = baseUrl ? describe : describe.skip;
const connect = async (url: string): Promise<Client> => { const c = new Client({ connectionString: url }); await c.connect(); return c; };

group('F01.1 sesión restringida en la transacción de identidad', () => {
  let admin: Client; let database: Client; let pool: Pool; let testName = ''; let loginRole = '';
  const secrets = { libre: randomBytes(32).toString('hex'), cambio: randomBytes(32).toString('hex'), mfa: randomBytes(32).toString('hex') };
  const users: Record<string, string> = {};

  beforeAll(async () => {
    const base = new URL(baseUrl!);
    if (!/^\/farmafind_f01_test_[a-f0-9]{12}$/.test(base.pathname)) throw new Error('F01.1: solo fixture TEST marcado');
    admin = await connect(baseUrl!);
    const suffix = randomBytes(6).toString('hex'); testName = `farmafind_f01_test_${suffix}`; loginRole = `f011_rs_${suffix}`;
    await admin.query(`CREATE DATABASE "${testName}"`);
    base.pathname = `/${testName}`; database = await connect(base.toString());
    await migrateTestDatabase(base.toString(), connect);
    for (const [name, restriction] of [['libre', null], ['cambio', 'CAMBIO_CLAVE'], ['mfa', 'MFA_PENDIENTE']] as const) {
      users[name] = randomUUID();
      await database.query('INSERT INTO f01.usuario(id,email_canonico,password_hash) VALUES($1,$2,$3)', [users[name], `${name}@example.test`, '$argon2id$fixture-only']);
      await database.query(`INSERT INTO f01.sesion(usuario_id,token_fingerprint,idle_expires_at,absolute_expires_at,restringida_motivo)
        VALUES($1,$2,now()+interval '1 hour',now()+interval '4 hours',$3)`,
      [users[name], createHash('sha256').update(Buffer.from(secrets[name], 'hex')).digest(), restriction]);
    }
    const password = randomBytes(32).toString('hex');
    await admin.query(`CREATE ROLE "${loginRole}" LOGIN NOSUPERUSER NOBYPASSRLS PASSWORD '${password}'`);
    await admin.query(`GRANT f01_runtime TO "${loginRole}"`);
    const url = new URL(base); url.username = loginRole; url.password = password;
    pool = new Pool({ connectionString: url.toString(), max: 1 });
  });

  afterAll(async () => {
    if (pool) await pool.end();
    if (database) await database.end();
    if (admin) { if (testName) await admin.query(`DROP DATABASE "${testName}"`); if (loginRole) await admin.query(`DROP ROLE "${loginRole}"`); await admin.end(); }
  });

  it('una sesión sin restricción ejecuta operaciones con su actor', async () => {
    const uow = new PgIdentityUnitOfWork(pool);
    expect(await uow.run(secrets.libre, async (_transaction, actor) => actor)).toBe(users.libre);
  });

  it.each([['cambio', 'CAMBIO_CLAVE'], ['mfa', 'MFA_PENDIENTE']] as const)(
    'una sesión con %s pendiente no puede ejecutar ninguna operación de negocio', async (name, restriction) => {
      const uow = new PgIdentityUnitOfWork(pool);
      let executed = false;
      await expect(uow.run(secrets[name], async () => { executed = true; })).rejects.toThrow(SessionRestrictedError);
      await expect(uow.run(secrets[name], async () => { executed = true; })).rejects.toMatchObject({ restriction });
      expect(executed).toBe(false);
    });

  it('tras el rechazo la conexión del pool queda limpia y reutilizable', async () => {
    const uow = new PgIdentityUnitOfWork(pool);
    await expect(uow.run(secrets.cambio, async () => undefined)).rejects.toThrow(SessionRestrictedError);
    expect(await uow.run(secrets.libre, async (_transaction, actor) => actor)).toBe(users.libre);
  });

  it('al liberar la restricción la misma sesión vuelve a operar', async () => {
    await database.query(`UPDATE f01.sesion SET restringida_motivo=NULL WHERE usuario_id=$1`, [users.cambio]);
    const uow = new PgIdentityUnitOfWork(pool);
    expect(await uow.run(secrets.cambio, async (_transaction, actor) => actor)).toBe(users.cambio);
  });
});
