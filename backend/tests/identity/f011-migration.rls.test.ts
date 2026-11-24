import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client } from 'pg';
import { randomBytes, randomUUID } from 'node:crypto';
import { migrateTestDatabase } from '../../src/modules/usuarios/infrastructure/db/migrate.js';

const baseUrl = process.env.F01_TEST_DATABASE_URL;
const group = baseUrl ? describe : describe.skip;
const connect = async (url: string): Promise<Client> => { const c = new Client({ connectionString: url }); await c.connect(); return c; };

const newTables = ['credencial_temporal', 'invitacion_personal', 'token_cuenta', 'mfa_totp', 'perfil_usuario', 'auditoria_identidad'];

group('F01.1 migración 011 (identidad y personal)', () => {
  let admin: Client; let database: Client; let testName: string; let testUrl: string;

  beforeAll(async () => {
    const base = new URL(baseUrl!);
    if (base.hostname !== '127.0.0.1' || base.port !== '55431' || !/^\/farmafind_f01_test_[a-f0-9]{12}$/.test(base.pathname)) {
      throw new Error('F01.1: solo fixture TEST marcado, nunca farmafind_f01_test');
    }
    admin = await connect(baseUrl!);
    testName = `farmafind_f01_test_${randomBytes(6).toString('hex')}`;
    await admin.query(`CREATE DATABASE "${testName}"`);
    base.pathname = `/${testName}`;
    testUrl = base.toString();
    database = await connect(testUrl);
  });

  afterAll(async () => {
    if (database) await database.end();
    if (admin) { if (testName) await admin.query(`DROP DATABASE "${testName}"`); await admin.end(); }
  });

  it('se aplica una sola vez, es idempotente y deja registrada 011', async () => {
    const first = await migrateTestDatabase(testUrl, connect);
    expect(first.applied.slice(-4)).toEqual(['011_staff_identity.sql', '012_staff_functions.sql', '013_staff_invitations.sql', '014_account_recovery.sql']);
    const second = await migrateTestDatabase(testUrl, connect);
    expect(second.applied).toEqual([]);
    expect(second.skipped).toEqual(expect.arrayContaining(['011_staff_identity.sql', '012_staff_functions.sql', '013_staff_invitations.sql', '014_account_recovery.sql']));
  });

  it('exige al menos un identificador y valida el formato del alias', async () => {
    const hash = '$argon2id$fixture-only';
    await expect(database.query('INSERT INTO f01.usuario(password_hash) VALUES($1)', [hash])).rejects.toThrow(/usuario_identificador/);
    for (const bad of ['ab', 'Alfa.Caja1', '-alfa', 'alfa caja', 'a'.repeat(41)]) {
      await expect(database.query('INSERT INTO f01.usuario(alias_canonico,password_hash) VALUES($1,$2)', [bad, hash])).rejects.toThrow();
    }
    await database.query('INSERT INTO f01.usuario(alias_canonico,password_hash) VALUES($1,$2)', ['alfa.caja1', hash]);
    await expect(database.query('INSERT INTO f01.usuario(alias_canonico,password_hash) VALUES($1,$2)', ['alfa.caja1', hash])).rejects.toThrow(/usuario_alias_unico/);
  });

  it('conserva el registro por correo de F01 sin cambios', async () => {
    await database.query('INSERT INTO f01.usuario(email_canonico,password_hash) VALUES($1,$2)', ['regresion@example.test', '$argon2id$fixture-only']);
    await expect(database.query('INSERT INTO f01.usuario(email_canonico,password_hash) VALUES($1,$2)', ['regresion@example.test', '$argon2id$fixture-only'])).rejects.toThrow();
    await expect(database.query('INSERT INTO f01.usuario(email_canonico,password_hash) VALUES($1,$2)', ['sin-arroba', '$argon2id$fixture-only'])).rejects.toThrow();
  });

  it('acepta los ámbitos nuevos de abuso y rechaza uno desconocido', async () => {
    for (const scope of ['TEMP_KEY_ACCOUNT', 'RESET_ACCOUNT', 'RESET_IP', 'TOTP_ACCOUNT', 'STAFF_CREATE_IP', 'LOGIN_ACCOUNT']) {
      await database.query('INSERT INTO f01.abuse_attempt(scope,key_digest,occurred_at) VALUES($1,$2,now())', [scope, randomBytes(32)]);
    }
    await expect(database.query('INSERT INTO f01.abuse_attempt(scope,key_digest,occurred_at) VALUES($1,$2,now())', ['DESCONOCIDO', randomBytes(32)])).rejects.toThrow();
  });

  it('las tablas nuevas tienen RLS activa y forzada', async () => {
    const result = await database.query(
      `SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity FROM pg_class c
       JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='f01' AND c.relname = ANY($1) ORDER BY c.relname`, [newTables]);
    expect(result.rows.map(row => row.relname)).toEqual([...newTables].sort());
    expect(result.rows.every(row => row.relrowsecurity && row.relforcerowsecurity)).toBe(true);
  });

  it('los roles de aplicación siguen sin BYPASSRLS, sin superusuario y sin login', async () => {
    const roles = await database.query(`SELECT rolname,rolsuper,rolbypassrls,rolcanlogin FROM pg_roles WHERE rolname IN ('f01_runtime','f01_auth')`);
    expect(roles.rows).toHaveLength(2);
    expect(roles.rows.every(row => !row.rolsuper && !row.rolbypassrls && !row.rolcanlogin)).toBe(true);
  });

  it('valida la vigencia de la clave temporal (máximo 24 h) y de la invitación (máximo 7 días)', async () => {
    const owner = randomUUID(); const worker = randomUUID(); const pharmacy = randomUUID();
    await database.query('INSERT INTO f01.usuario(id,email_canonico,password_hash) VALUES($1,$2,$3)', [owner, 'dueno-m@example.test', '$argon2id$fixture-only']);
    await database.query('INSERT INTO f01.usuario(id,alias_canonico,password_hash) VALUES($1,$2,$3)', [worker, 'alfa.m1', '$argon2id$fixture-only']);
    await database.query('INSERT INTO f01.farmacia_referencia(id,nombre_publico) VALUES($1,$2)', [pharmacy, 'Farmacia ficticia M']);
    const insertKey = (hours: number) => database.query(
      `INSERT INTO f01.credencial_temporal(usuario_id,clave_hash,farmacia_id,emitida_por_usuario_id,motivo,expira_at)
       VALUES($1,'$argon2id$fixture-only',$2,$3,'ALTA',now()+make_interval(hours=>$4))
       ON CONFLICT (usuario_id) DO UPDATE SET expira_at=EXCLUDED.expira_at`, [worker, pharmacy, owner, hours]);
    await expect(insertKey(25)).rejects.toThrow(/credencial_temporal_vigencia/);
    await insertKey(24);
    const invite = (days: number, target = worker) => database.query(
      `INSERT INTO f01.invitacion_personal(farmacia_id,usuario_destino_id,invitado_por_usuario_id,expira_at)
       VALUES($1,$2,$3,now()+make_interval(days=>$4))`, [pharmacy, target, owner, days]);
    await expect(invite(8)).rejects.toThrow(/invitacion_vigencia/);
    await expect(invite(1, owner)).rejects.toThrow(/invitacion_no_autoinvitacion/);
    await invite(7);
    await expect(invite(7)).rejects.toThrow(/invitacion_pendiente_unica/);
  });
});
