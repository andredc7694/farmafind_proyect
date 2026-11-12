import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client } from 'pg';
import { randomBytes } from 'node:crypto';
import { applyMigrationFiles, migrateTestDatabase } from '../../src/modules/usuarios/infrastructure/db/migrate.js';

async function connect(url: string): Promise<Client> {
  const client = new Client({ connectionString: url });
  await client.connect();
  return client;
}

const baseUrl = process.env.F01_TEST_DATABASE_URL;
const testGroup = baseUrl ? describe : describe.skip;

testGroup('migraciones F01 con PostgreSQL real y BD ficticia nueva', () => {
  let admin: Client;
  let database: Client;
  let testUrl: string;
  let testName: string;

  beforeAll(async () => {
    const base = new URL(baseUrl!);
    if (base.hostname !== '127.0.0.1' || base.port !== '55431' || base.pathname !== '/farmafind_f01_test') {
      throw new Error('Pruebas F01: solo instancia local aislada y base farmafind_f01_test');
    }
    admin = new Client({ connectionString: baseUrl });
    await admin.connect();
    testName = `farmafind_f01_test_${randomBytes(6).toString('hex')}`;
    await admin.query(`CREATE DATABASE "${testName}"`);
    base.pathname = `/${testName}`;
    testUrl = base.toString();
    database = new Client({ connectionString: testUrl });
    await database.connect();
  });

  afterAll(async () => {
    if (database) await database.end();
    if (admin) {
      if (testName) await admin.query(`DROP DATABASE "${testName}"`);
      await admin.end();
    }
  });

  it('aplica desde BD vacía, fija el orden y permite repetición sin duplicar', async () => {
    const before = await database.query<{ relation: string | null }>("SELECT to_regclass('f01.usuario')::text AS relation");
    expect(before.rows[0]?.relation).toBeNull();

    const first = await migrateTestDatabase(testUrl, connect);
    expect(first.applied).toEqual(['001_identity.sql', '002_memberships.sql', '003_rls_base.sql', '004_rls_private.sql', '005_auth_scope.sql', '006_abuse.sql', '007_auth_audit.sql', '008_access_audit.sql', '009_membership_mutations.sql']);
    const second = await migrateTestDatabase(testUrl, connect);
    expect(second.applied).toEqual([]);
    expect(second.skipped).toEqual(first.applied);

    const tracked = await database.query<{ filename: string }>('SELECT filename FROM f01.schema_migrations ORDER BY filename');
    expect(tracked.rows.map(row => row.filename)).toEqual(first.applied);
  });

  it('revierte una migración fallida completa y no marca su versión', async () => {
    await expect(applyMigrationFiles(database, [{
      filename: '004_rollback_probe.sql',
      sql: 'CREATE TABLE f01.rollback_probe(id integer); SELECT 1 / 0;',
    }])).rejects.toThrow();
    const relation = await database.query<{ relation: string | null }>("SELECT to_regclass('f01.rollback_probe')::text AS relation");
    expect(relation.rows[0]?.relation).toBeNull();
    const tracked = await database.query<{ count: string }>("SELECT count(*)::text AS count FROM f01.schema_migrations WHERE filename='004_rollback_probe.sql'");
    expect(tracked.rows[0]?.count).toBe('0');
  });

  it('rechaza el rol runtime antes de abrir una conexión de migración', async () => {
    const forbidden = new URL(testUrl);
    forbidden.username = 'f01_runtime';
    let connected = false;
    await expect(migrateTestDatabase(forbidden.toString(), async () => {
      connected = true;
      throw new Error('No debería conectarse');
    })).rejects.toThrow('rol runtime');
    expect(connected).toBe(false);
  });

  it('crea rol runtime sin bypass ni propiedad y deja grants mínimos', async () => {
    const roles = await database.query<{ rolsuper: boolean; rolbypassrls: boolean; rolcanlogin: boolean }>("SELECT rolsuper, rolbypassrls, rolcanlogin FROM pg_roles WHERE rolname='f01_runtime'");
    expect(roles.rows).toEqual([{ rolsuper: false, rolbypassrls: false, rolcanlogin: false }]);
    const privileges = await database.query<{ membershipRead: boolean; membershipWrite: boolean; auditRead: boolean; passwordRead: boolean; sessionWrite: boolean }>(`
      SELECT has_table_privilege('f01_runtime','f01.usuario_farmacia','SELECT') AS "membershipRead",
             has_table_privilege('f01_runtime','f01.usuario_farmacia','INSERT') AS "membershipWrite",
             has_table_privilege('f01_runtime','f01.auditoria_acceso','SELECT') AS "auditRead",
             has_column_privilege('f01_runtime','f01.usuario','password_hash','SELECT') AS "passwordRead",
             has_table_privilege('f01_runtime','f01.sesion','UPDATE') AS "sessionWrite"
    `);
    expect(privileges.rows[0]).toEqual({ membershipRead: true, membershipWrite: false, auditRead: false, passwordRead: false, sessionWrite: false });
    const tables = await database.query<{ relname: string; relrowsecurity: boolean; relforcerowsecurity: boolean; owned: boolean }>(`
      SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity,
             c.relowner = (SELECT oid FROM pg_roles WHERE rolname='f01_runtime') AS owned
      FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='f01' AND c.relname IN ('usuario_farmacia','delegacion','auditoria_acceso','sesion')
      ORDER BY c.relname
    `);
    expect(tables.rows).toHaveLength(4);
    for (const row of tables.rows) {
      expect(row.relrowsecurity).toBe(true);
      expect(row.relforcerowsecurity).toBe(true);
      expect(row.owned).toBe(false);
    }
  });
});
