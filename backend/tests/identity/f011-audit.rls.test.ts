import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client, Pool } from 'pg';
import type { PoolClient } from 'pg';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { migrateTestDatabase } from '../../src/modules/usuarios/infrastructure/db/migrate.js';
import { PgIdentityAuditRepository, identityAuditActions } from '../../src/modules/usuarios/infrastructure/identity-audit-repository.js';
import { PgAbuseRepository } from '../../src/modules/usuarios/infrastructure/abuse-repository.js';

const baseUrl = process.env.F01_TEST_DATABASE_URL;
const group = baseUrl ? describe : describe.skip;
const connect = async (url: string): Promise<Client> => { const c = new Client({ connectionString: url }); await c.connect(); return c; };

group('F01.1 auditoría de identidad y presupuestos de abuso', () => {
  let admin: Client; let database: Client; let pool: Pool; let testName = ''; let loginRole = '';
  let owner: string; let pharmacy: string;
  const fingerprint = createHash('sha256').update(randomBytes(32)).digest();

  async function withClient<T>(role: 'f01_runtime' | 'f01_auth', settings: Record<string, string>,
    work: (c: PoolClient) => Promise<T>, commit = false): Promise<T> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN'); await client.query(`SET LOCAL ROLE ${role}`);
      for (const [key, value] of Object.entries(settings)) await client.query('SELECT set_config($1,$2,true)', [key, value]);
      const result = await work(client);
      await client.query(commit ? 'COMMIT' : 'ROLLBACK');
      return result;
    } catch (error) { await client.query('ROLLBACK').catch(() => undefined); throw error; }
    finally { client.release(); }
  }

  beforeAll(async () => {
    const base = new URL(baseUrl!);
    if (!/^\/farmafind_f01_test_[a-f0-9]{12}$/.test(base.pathname)) throw new Error('F01.1: solo fixture TEST marcado');
    admin = await connect(baseUrl!);
    const suffix = randomBytes(6).toString('hex'); testName = `farmafind_f01_test_${suffix}`; loginRole = `f011_aud_${suffix}`;
    await admin.query(`CREATE DATABASE "${testName}"`);
    base.pathname = `/${testName}`; database = await connect(base.toString());
    await migrateTestDatabase(base.toString(), connect);
    owner = randomUUID(); pharmacy = randomUUID();
    await database.query('INSERT INTO f01.usuario(id,email_canonico,password_hash) VALUES($1,$2,$3)', [owner, 'dueno@example.test', '$argon2id$fixture-only']);
    await database.query('INSERT INTO f01.farmacia_referencia(id,nombre_publico) VALUES($1,$2)', [pharmacy, 'Farmacia ficticia']);
    const membership = (await database.query(`INSERT INTO f01.usuario_farmacia(usuario_id,farmacia_id,rol) VALUES($1,$2,'DUENO') RETURNING id`, [owner, pharmacy])).rows[0];
    await database.query(`INSERT INTO f01.delegacion(membresia_id,farmacia_id,capacidad,granted_by_usuario_id) VALUES($1,$2,'membership.manage',$3)`, [membership.id, pharmacy, owner]);
    await database.query(`INSERT INTO f01.sesion(usuario_id,token_fingerprint,idle_expires_at,absolute_expires_at) VALUES($1,$2,now()+interval '1 hour',now()+interval '4 hours')`, [owner, fingerprint]);
    const password = randomBytes(32).toString('hex');
    await admin.query(`CREATE ROLE "${loginRole}" LOGIN NOSUPERUSER NOBYPASSRLS PASSWORD '${password}'`);
    await admin.query(`GRANT f01_runtime TO "${loginRole}"`); await admin.query(`GRANT f01_auth TO "${loginRole}"`);
    const url = new URL(base); url.username = loginRole; url.password = password;
    pool = new Pool({ connectionString: url.toString(), max: 1 });
  });

  afterAll(async () => {
    if (pool) await pool.end();
    if (database) await database.end();
    if (admin) { if (testName) await admin.query(`DROP DATABASE "${testName}"`); if (loginRole) await admin.query(`DROP ROLE "${loginRole}"`); await admin.end(); }
  });

  const context = () => ({ 'app.actor_user_id': owner, 'app.farmacia_id': pharmacy, 'app.session_fingerprint': fingerprint.toString('hex') });

  it('registra cada acción del catálogo desde el contexto autorizado', async () => {
    const written = await withClient('f01_runtime', context(), async client => {
      const audit = new PgIdentityAuditRepository(client);
      for (const action of identityAuditActions) {
        await audit.record({ actorUserId: owner, pharmacyId: pharmacy, action, result: 'PERMITIDO', correlationId: randomUUID() });
      }
      return (await client.query('SELECT count(*)::int AS n FROM f01.auditoria_identidad')).rows[0].n;
    });
    expect(written).toBe(identityAuditActions.length);
  });

  it('rechaza acciones fuera del catálogo y campos libres (posibles secretos) antes de tocar la base', async () => {
    await withClient('f01_runtime', context(), async client => {
      const audit = new PgIdentityAuditRepository(client);
      const base = { actorUserId: owner, pharmacyId: pharmacy, result: 'PERMITIDO' as const, correlationId: randomUUID() };
      await expect(audit.record({ ...base, action: 'OTRA_COSA' as never })).rejects.toThrow('fuera del catálogo');
      await expect(audit.record({ ...base, action: 'PASSWORD_CHANGE', password: 'no-debe-guardarse' } as never)).rejects.toThrow('campo no permitido');
      await expect(audit.record({ ...base, action: 'PASSWORD_CHANGE', result: 'TAL VEZ' as never })).rejects.toThrow('resultado inválido');
    });
  });

  it('la base rechaza un actor distinto del autenticado', async () => {
    await expect(withClient('f01_runtime', context(), client => new PgIdentityAuditRepository(client).record({
      actorUserId: randomUUID(), pharmacyId: pharmacy, action: 'STAFF_CREATE', result: 'PERMITIDO', correlationId: randomUUID() }))).rejects.toThrow();
  });

  it('el presupuesto bloquea al quinto fallo por ámbito y no mezcla ámbitos ni identificadores', async () => {
    const key = randomBytes(32); const now = new Date('2026-11-23T10:00:00.000Z');
    await withClient('f01_auth', {}, async client => {
      const abuse = new PgAbuseRepository(client, key);
      for (let attempt = 0; attempt < 4; attempt++) await abuse.recordBudget('TEMP_KEY_ACCOUNT', 'alfa.caja1', now);
      expect(await abuse.assessBudget('TEMP_KEY_ACCOUNT', 'alfa.caja1', now)).toEqual({ allowed: true });
      await abuse.recordBudget('TEMP_KEY_ACCOUNT', 'alfa.caja1', now);
      expect(await abuse.assessBudget('TEMP_KEY_ACCOUNT', 'alfa.caja1', now)).toEqual({ allowed: false, status: 429, retryAfterSeconds: 900 });
      expect(await abuse.assessBudget('TEMP_KEY_ACCOUNT', 'otro.alias', now)).toEqual({ allowed: true });
      expect(await abuse.assessBudget('RESET_ACCOUNT', 'alfa.caja1', now)).toEqual({ allowed: true });
      expect(await abuse.assessBudget('TEMP_KEY_ACCOUNT', 'alfa.caja1', new Date('2026-11-23T10:15:01.000Z'))).toEqual({ allowed: true });
    });
  });

  it('los intentos se guardan solo como resumen HMAC, sin el identificador en claro', async () => {
    const key = randomBytes(32); const identifier = 'alias-secreto.ficticio';
    await withClient('f01_auth', {}, async client => {
      await new PgAbuseRepository(client, key).recordBudget('RESET_ACCOUNT', identifier, new Date());
    }, true);
    const rows = await database.query(`SELECT scope,encode(key_digest,'hex') AS digest FROM f01.abuse_attempt WHERE scope='RESET_ACCOUNT'`);
    expect(rows.rows).toHaveLength(1);
    expect(JSON.stringify(rows.rows)).not.toContain(identifier);
    expect(rows.rows[0].digest).toHaveLength(64);
  });
});
