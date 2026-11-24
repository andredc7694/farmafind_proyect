import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client, Pool } from 'pg';
import type { PoolClient } from 'pg';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { migrateTestDatabase } from '../../src/modules/usuarios/infrastructure/db/migrate.js';

const baseUrl = process.env.F01_TEST_DATABASE_URL;
const group = baseUrl ? describe : describe.skip;
const hash = '$argon2id$fixture-only';
const connect = async (url: string): Promise<Client> => { const c = new Client({ connectionString: url }); await c.connect(); return c; };

type Role = 'f01_runtime' | 'f01_auth';

group('F01.1 aislamiento RLS Alfa/Beta de las tablas nuevas', () => {
  let admin: Client; let database: Client; let pool: Pool; let testName = ''; let loginRole = '';
  let ownerA: string; let ownerB: string; let workerA: string; let outsider: string;
  let pharmacyA: string; let pharmacyB: string;
  const fingerprints: Record<string, Buffer> = {};

  async function inTx<T>(role: Role, settings: Record<string, string>, work: (c: PoolClient) => Promise<T>): Promise<T> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`SET LOCAL ROLE ${role}`);
      for (const [key, value] of Object.entries(settings)) await client.query('SELECT set_config($1,$2,true)', [key, value]);
      const result = await work(client);
      await client.query('ROLLBACK');
      return result;
    } catch (error) { await client.query('ROLLBACK').catch(() => undefined); throw error; }
    finally { client.release(); }
  }
  const ownerContext = (actor: string, pharmacy: string) => ({
    'app.actor_user_id': actor, 'app.farmacia_id': pharmacy, 'app.session_fingerprint': fingerprints[actor].toString('hex') });
  const denied = (promise: Promise<unknown>) => expect(promise).rejects.toThrow(/permission denied|row-level security/);

  beforeAll(async () => {
    const base = new URL(baseUrl!);
    if (base.hostname !== '127.0.0.1' || base.port !== '55431' || !/^\/farmafind_f01_test_[a-f0-9]{12}$/.test(base.pathname)) {
      throw new Error('F01.1: solo fixture TEST marcado, nunca farmafind_f01_test');
    }
    admin = await connect(baseUrl!);
    const suffix = randomBytes(6).toString('hex');
    testName = `farmafind_f01_test_${suffix}`; loginRole = `f011_test_${suffix}`;
    await admin.query(`CREATE DATABASE "${testName}"`);
    base.pathname = `/${testName}`;
    database = await connect(base.toString());
    await migrateTestDatabase(base.toString(), connect);

    ownerA = randomUUID(); ownerB = randomUUID(); workerA = randomUUID(); outsider = randomUUID();
    pharmacyA = randomUUID(); pharmacyB = randomUUID();
    for (const [id, email] of [[ownerA, 'dueno-a'], [ownerB, 'dueno-b'], [outsider, 'externo']]) {
      await database.query('INSERT INTO f01.usuario(id,email_canonico,password_hash) VALUES($1,$2,$3)', [id, `${email}@example.test`, hash]);
    }
    await database.query('INSERT INTO f01.usuario(id,alias_canonico,password_hash) VALUES($1,$2,$3)', [workerA, 'alfa.caja1', hash]);
    await database.query('INSERT INTO f01.farmacia_referencia(id,nombre_publico) VALUES($1,$2),($3,$4)',
      [pharmacyA, 'Farmacia ficticia Alfa', pharmacyB, 'Farmacia ficticia Beta']);
    for (const [user, pharmacy, role] of [[ownerA, pharmacyA, 'DUENO'], [ownerB, pharmacyB, 'DUENO'], [workerA, pharmacyA, 'TRABAJADOR']]) {
      const membership = (await database.query('INSERT INTO f01.usuario_farmacia(usuario_id,farmacia_id,rol) VALUES($1,$2,$3) RETURNING id', [user, pharmacy, role])).rows[0];
      if (role === 'DUENO') {
        await database.query(`INSERT INTO f01.delegacion(membresia_id,farmacia_id,capacidad,granted_by_usuario_id) VALUES($1,$2,'membership.manage',$3)`, [membership.id, pharmacy, user]);
      }
    }
    for (const user of [ownerA, ownerB, workerA, outsider]) {
      fingerprints[user] = createHash('sha256').update(randomBytes(32)).digest();
      await database.query(`INSERT INTO f01.sesion(usuario_id,token_fingerprint,idle_expires_at,absolute_expires_at)
        VALUES($1,$2,now()+interval '1 hour',now()+interval '4 hours')`, [user, fingerprints[user]]);
    }
    const password = randomBytes(32).toString('hex');
    await admin.query(`CREATE ROLE "${loginRole}" LOGIN NOSUPERUSER NOBYPASSRLS PASSWORD '${password}'`);
    await admin.query(`GRANT f01_runtime TO "${loginRole}"`);
    await admin.query(`GRANT f01_auth TO "${loginRole}"`);
    const url = new URL(base); url.username = loginRole; url.password = password;
    pool = new Pool({ connectionString: url.toString(), max: 1 });
  });

  afterAll(async () => {
    if (pool) await pool.end();
    if (database) await database.end();
    if (admin) {
      if (testName) await admin.query(`DROP DATABASE "${testName}"`);
      if (loginRole) await admin.query(`DROP ROLE "${loginRole}"`);
      await admin.end();
    }
  });

  it('invitaciones: el propietario solo ve y crea las de su farmacia', async () => {
    await database.query(`INSERT INTO f01.invitacion_personal(farmacia_id,usuario_destino_id,invitado_por_usuario_id,expira_at)
      VALUES($1,$2,$3,now()+interval '7 days'),($4,$2,$5,now()+interval '7 days')`, [pharmacyA, outsider, ownerA, pharmacyB, ownerB]);
    const seenByA = await inTx('f01_runtime', ownerContext(ownerA, pharmacyA), c => c.query('SELECT farmacia_id FROM f01.invitacion_personal'));
    expect(seenByA.rows.map(row => row.farmacia_id)).toEqual([pharmacyA]);
    // Alfa fija el contexto de Beta sin tener membresía allí: no ve nada.
    const forged = await inTx('f01_runtime', { ...ownerContext(ownerA, pharmacyB) }, c => c.query('SELECT farmacia_id FROM f01.invitacion_personal'));
    expect(forged.rows).toEqual([]);
    await denied(inTx('f01_runtime', ownerContext(ownerA, pharmacyB), c => c.query(
      `INSERT INTO f01.invitacion_personal(farmacia_id,usuario_destino_id,invitado_por_usuario_id,expira_at)
       VALUES($1,$2,$3,now()+interval '1 day')`, [pharmacyB, workerA, ownerA])));
  });

  it('invitaciones: el trabajador no puede invitar ni ver las de la farmacia', async () => {
    await denied(inTx('f01_runtime', ownerContext(workerA, pharmacyA), c => c.query(
      `INSERT INTO f01.invitacion_personal(farmacia_id,usuario_destino_id,invitado_por_usuario_id,expira_at)
       VALUES($1,$2,$3,now()+interval '1 day')`, [pharmacyA, outsider, workerA])));
    const seen = await inTx('f01_runtime', ownerContext(workerA, pharmacyA), c => c.query('SELECT id FROM f01.invitacion_personal'));
    expect(seen.rows).toEqual([]);
  });

  it('invitaciones: solo el destinatario responde y no puede elegir otro estado', async () => {
    const own = await inTx('f01_runtime', { 'app.actor_user_id': outsider }, c => c.query('SELECT id,farmacia_id FROM f01.invitacion_personal ORDER BY farmacia_id'));
    expect(own.rows).toHaveLength(2);
    const updated = await inTx('f01_runtime', { 'app.actor_user_id': outsider }, c => c.query(
      `UPDATE f01.invitacion_personal SET estado='ACEPTADA',resuelta_at=now() WHERE farmacia_id=$1 RETURNING id`, [pharmacyA]));
    expect(updated.rowCount).toBe(1);
    await denied(inTx('f01_runtime', { 'app.actor_user_id': outsider }, c => c.query(
      `UPDATE f01.invitacion_personal SET estado='REVOCADA' WHERE farmacia_id=$1`, [pharmacyA])));
    const other = await inTx('f01_runtime', { 'app.actor_user_id': workerA }, c => c.query(
      `UPDATE f01.invitacion_personal SET estado='ACEPTADA',resuelta_at=now() RETURNING id`));
    expect(other.rowCount).toBe(0);
  });

  it('credencial temporal: el runtime no la lee ni la escribe; auth solo la propia', async () => {
    await database.query(`INSERT INTO f01.credencial_temporal(usuario_id,clave_hash,farmacia_id,emitida_por_usuario_id,motivo,expira_at)
      VALUES($1,$3,$2,$4,'ALTA',now()+interval '24 hours')`, [workerA, pharmacyA, hash, ownerA]);
    await denied(inTx('f01_runtime', ownerContext(ownerA, pharmacyA), c => c.query('SELECT clave_hash FROM f01.credencial_temporal')));
    const own = await inTx('f01_auth', { 'app.auth_user_id': workerA }, c => c.query('SELECT usuario_id FROM f01.credencial_temporal'));
    expect(own.rows.map(row => row.usuario_id)).toEqual([workerA]);
    const other = await inTx('f01_auth', { 'app.auth_user_id': ownerB }, c => c.query('SELECT usuario_id FROM f01.credencial_temporal'));
    expect(other.rows).toEqual([]);
    const consumed = await inTx('f01_auth', { 'app.auth_user_id': ownerB }, c => c.query('UPDATE f01.credencial_temporal SET consumida_at=now()'));
    expect(consumed.rowCount).toBe(0);
    await denied(inTx('f01_auth', { 'app.auth_user_id': workerA }, c => c.query(
      `INSERT INTO f01.credencial_temporal(usuario_id,clave_hash,farmacia_id,emitida_por_usuario_id,motivo,expira_at)
       VALUES($1,$3,$2,$1,'ALTA',now()+interval '1 hour')`, [ownerB, pharmacyB, hash])));
  });

  it('auditoría: solo inserción, con actor y farmacia verificados; lectura por farmacia', async () => {
    const insert = (actor: string, pharmacy: string | null, context: Record<string, string>) => inTx('f01_runtime', context, c => c.query(
      `INSERT INTO f01.auditoria_identidad(actor_usuario_id,farmacia_id,accion,resultado,correlation_id) VALUES($1,$2,'STAFF_CREATE','PERMITIDO',$3)`,
      [actor, pharmacy, randomUUID()]));
    expect((await insert(ownerA, pharmacyA, ownerContext(ownerA, pharmacyA))).rowCount).toBe(1);
    await denied(insert(ownerB, pharmacyA, ownerContext(ownerA, pharmacyA)));   // actor suplantado
    await denied(insert(ownerA, pharmacyB, ownerContext(ownerA, pharmacyA)));   // farmacia ajena
    await denied(inTx('f01_runtime', ownerContext(ownerA, pharmacyA), c => c.query('UPDATE f01.auditoria_identidad SET resultado=\'DENEGADO\'')));
    await denied(inTx('f01_runtime', ownerContext(ownerA, pharmacyA), c => c.query('DELETE FROM f01.auditoria_identidad')));
    await database.query(`INSERT INTO f01.auditoria_identidad(actor_usuario_id,farmacia_id,accion,resultado,correlation_id)
      VALUES($1,$2,'STAFF_CREATE','PERMITIDO',$3),($4,NULL,'PASSWORD_CHANGE','PERMITIDO',$5)`, [ownerA, pharmacyA, randomUUID(), ownerB, randomUUID()]);
    await database.query(`INSERT INTO f01.auditoria_identidad(actor_usuario_id,farmacia_id,accion,resultado,correlation_id) VALUES($1,$2,'STAFF_CREATE','PERMITIDO',$3)`, [ownerB, pharmacyB, randomUUID()]);
    const seenByA = await inTx('f01_runtime', ownerContext(ownerA, pharmacyA), c => c.query('SELECT farmacia_id,actor_usuario_id FROM f01.auditoria_identidad'));
    expect(seenByA.rows.every(row => row.farmacia_id === pharmacyA)).toBe(true);
    const seenByB = await inTx('f01_runtime', ownerContext(ownerB, pharmacyB), c => c.query('SELECT farmacia_id FROM f01.auditoria_identidad'));
    expect(seenByB.rows.every(row => row.farmacia_id === pharmacyB || row.farmacia_id === null)).toBe(true);
    // El rol de autenticación solo puede insertar eventos globales del catálogo permitido.
    await denied(inTx('f01_auth', { 'app.auth_user_id': ownerA }, c => c.query(
      `INSERT INTO f01.auditoria_identidad(actor_usuario_id,farmacia_id,accion,resultado,correlation_id) VALUES($1,$2,'STAFF_CREATE','PERMITIDO',$3)`, [ownerA, pharmacyA, randomUUID()])));
    await denied(inTx('f01_auth', { 'app.auth_user_id': ownerA }, c => c.query('SELECT id FROM f01.auditoria_identidad')));
  });

  it('perfil, segundo factor y tokens: cada usuario solo alcanza lo propio', async () => {
    await database.query('INSERT INTO f01.perfil_usuario(usuario_id,nombre) VALUES($1,$2),($3,$4)', [ownerA, 'Dueño Alfa', ownerB, 'Dueño Beta']);
    const profile = await inTx('f01_runtime', { 'app.actor_user_id': ownerA }, c => c.query('SELECT nombre FROM f01.perfil_usuario'));
    expect(profile.rows).toEqual([{ nombre: 'Dueño Alfa' }]);
    expect((await inTx('f01_runtime', { 'app.actor_user_id': ownerA }, c => c.query(
      `UPDATE f01.perfil_usuario SET nombre='Otro' WHERE usuario_id=$1`, [ownerB]))).rowCount).toBe(0);
    await database.query(`INSERT INTO f01.mfa_totp(usuario_id,secreto_cifrado,nonce) VALUES($1,$2,$3)`, [ownerA, randomBytes(32), randomBytes(12)]);
    expect((await inTx('f01_auth', { 'app.auth_user_id': ownerA }, c => c.query('SELECT usuario_id FROM f01.mfa_totp'))).rows).toHaveLength(1);
    expect((await inTx('f01_auth', { 'app.auth_user_id': ownerB }, c => c.query('SELECT usuario_id FROM f01.mfa_totp'))).rows).toEqual([]);
    await denied(inTx('f01_runtime', { 'app.actor_user_id': ownerA }, c => c.query('SELECT usuario_id FROM f01.mfa_totp')));
    const token = randomBytes(32);
    await database.query(`INSERT INTO f01.token_cuenta(usuario_id,proposito,token_hash,expira_at) VALUES($1,'RESTABLECER_CLAVE',$2,now()+interval '30 minutes')`, [ownerA, createHash('sha256').update(token).digest()]);
    expect((await inTx('f01_auth', { 'app.auth_user_id': ownerB }, c => c.query('SELECT id FROM f01.token_cuenta'))).rows).toEqual([]);
    expect((await inTx('f01_auth', { 'app.auth_token_hash': createHash('sha256').update(token).digest('hex') }, c => c.query('SELECT id FROM f01.token_cuenta'))).rows).toHaveLength(1);
    await denied(inTx('f01_runtime', { 'app.actor_user_id': ownerA }, c => c.query('SELECT id FROM f01.token_cuenta')));
  });

  it('una conexión reutilizada no conserva el contexto de la transacción anterior', async () => {
    await inTx('f01_runtime', ownerContext(ownerA, pharmacyA), c => c.query('SELECT 1'));
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SET LOCAL ROLE f01_runtime');
      expect((await client.query('SELECT id FROM f01.invitacion_personal')).rows).toEqual([]);
      expect((await client.query('SELECT usuario_id FROM f01.perfil_usuario')).rows).toEqual([]);
      expect((await client.query(`SELECT current_setting('app.actor_user_id',true) AS actor`)).rows[0].actor ?? '').toBe('');
      await client.query('ROLLBACK');
    } finally { client.release(); }
  });
});
