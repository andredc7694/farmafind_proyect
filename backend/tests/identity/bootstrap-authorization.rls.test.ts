import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client, Pool } from 'pg';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { migrateTestDatabase } from '../../src/modules/usuarios/infrastructure/db/migrate.js';

const baseUrl = process.env.F01_TEST_DATABASE_URL;
const group = baseUrl ? describe : describe.skip;

group('GLO-01/BOOT-01 con PostgreSQL real aislado', () => {
  let admin: Client; let database: Client; let pool: Pool;
  let databaseName = ''; let loginRole = '';
  let databaseUrl = '';
  const users = [randomUUID(), randomUUID(), randomUUID()];
  const pharmacy = randomUUID();
  const secrets = users.map(() => randomBytes(32).toString('hex'));
  const fingerprints = secrets.map(value => createHash('sha256').update(Buffer.from(value,'hex')).digest('hex'));

  beforeAll(async () => {
    const base = new URL(baseUrl!);
    if (base.hostname !== '127.0.0.1' || base.port !== '55431' || !/^\/farmafind_f01_test_[a-f0-9]{12}$/.test(base.pathname))
      throw new Error('Solo PostgreSQL ficticio local F01');
    admin = new Client({ connectionString: baseUrl }); await admin.connect();
    const suffix = randomBytes(6).toString('hex');
    databaseName = `farmafind_f01_test_${suffix}`; loginRole = `f01_global_${suffix}`;
    await admin.query(`CREATE DATABASE "${databaseName}"`); base.pathname=`/${databaseName}`;
    await migrateTestDatabase(base.toString(), async url => { const client=new Client({connectionString:url});
      await client.connect(); return client; });
    databaseUrl=base.toString();
    database = new Client({ connectionString: databaseUrl }); await database.connect();
    for (let index=0; index<users.length; index++) {
      await database.query(`INSERT INTO f01.usuario(id,email_canonico,password_hash) VALUES($1,$2,'$argon2id$fixture-only')`,
        [users[index],`global-${index}@example.invalid`]);
      await database.query(`/* F01.1: sesión de administrador con segundo factor verificado */ INSERT INTO f01.sesion(usuario_id,token_fingerprint,idle_expires_at,absolute_expires_at,mfa_verificada_at)
        VALUES($1,decode($2,'hex'),now()+interval '1 hour',now()+interval '8 hours',now())`,[users[index],fingerprints[index]]);
    }
    await database.query('INSERT INTO f01.farmacia_referencia(id,nombre_publico) VALUES($1,$2)',
      [pharmacy,'Farmacia bootstrap ficticia']);
    const password=randomBytes(32).toString('hex');
    await admin.query(`CREATE ROLE "${loginRole}" LOGIN NOSUPERUSER NOBYPASSRLS PASSWORD '${password}'`);
    await admin.query(`GRANT f01_runtime TO "${loginRole}"`);
    base.username=loginRole; base.password=password; pool=new Pool({connectionString:base.toString(),max:1});
  });

  afterAll(async () => {
    if (pool) await pool.end(); if (database) await database.end();
    if (admin) { if (databaseName) await admin.query(`DROP DATABASE "${databaseName}"`);
      if (loginRole) await admin.query(`DROP ROLE "${loginRole}"`); await admin.end(); }
  });

  async function approval(operation: string, target: string, role='ADMINISTRADOR_PLATAFORMA', scope: string|null=null,
    expires="now()+interval '1 hour'") {
    const id=randomUUID();
    await database.query('BEGIN');
    try {
      await database.query('SET LOCAL ROLE f01_bootstrap_executor');
      await database.query(`SELECT f01.record_privileged_approval($1,$2,$3,$4,$5,$6,${expires},$7)`,
        [id,operation,target,scope,role,'Aprobacion humana ficticia',randomBytes(32).toString('hex')]);
      await database.query('COMMIT'); return id;
    } catch(error) { await database.query('ROLLBACK'); throw error; }
  }
  async function bootstrap(approvalId: string, key: string) {
    await database.query('BEGIN');
    try { await database.query('SET LOCAL ROLE f01_bootstrap_executor');
      await database.query('SELECT f01.execute_initial_bootstrap($1,$2,$3)',[approvalId,key,randomUUID()]);
      await database.query('COMMIT');
    } catch(error) { await database.query('ROLLBACK'); throw error; }
  }
  async function asActor<T>(index: number, work:(client: import('pg').PoolClient)=>Promise<T>) {
    const client=await pool.connect();
    try { await client.query('BEGIN'); await client.query('SET LOCAL ROLE f01_runtime');
      await client.query("SELECT set_config('app.actor_user_id',$1,true)",[users[index]]);
      await client.query("SELECT set_config('app.session_fingerprint',$1,true)",[fingerprints[index]]);
      const result=await work(client); await client.query('COMMIT'); return result;
    } catch(error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  }

  it('crea roles sin privilegios y no concede tablas globales al runtime', async () => {
    const roles=await database.query(`SELECT rolname,rolsuper,rolbypassrls,rolcanlogin FROM pg_roles
      WHERE rolname IN ('f01_runtime','f01_bootstrap_executor') ORDER BY rolname`);
    expect(roles.rows).toEqual([
      {rolname:'f01_bootstrap_executor',rolsuper:false,rolbypassrls:false,rolcanlogin:false},
      {rolname:'f01_runtime',rolsuper:false,rolbypassrls:false,rolcanlogin:false},
    ]);
    const direct=await database.query(`SELECT has_table_privilege('f01_runtime','f01.platform_role_assignment','SELECT') AS read,
      has_table_privilege('f01_runtime','f01.privileged_approval','INSERT') AS approve`);
    expect(direct.rows[0]).toEqual({read:false,approve:false});
  });

  it('ejecuta una sola alta inicial global, es idempotente por expediente y audita', async () => {
    const id=await approval('INITIAL_PLATFORM_ADMIN',users[0]);
    await bootstrap(id,'initial-platform-admin-fixture');
    await bootstrap(id,'initial-platform-admin-fixture');
    const assignment=await database.query('SELECT usuario_id,role_code,estado FROM f01.platform_role_assignment');
    expect(assignment.rows).toEqual([{usuario_id:users[0],role_code:'ADMINISTRADOR_PLATAFORMA',estado:'ACTIVA'}]);
    expect((await database.query('SELECT count(*)::int AS count FROM f01.global_audit')).rows[0].count).toBe(1);
    const second=await approval('INITIAL_PLATFORM_ADMIN',users[1]);
    await expect(bootstrap(second,'second-platform-admin-fixture')).rejects.toMatchObject({code:'23505'});
  });

  it('ejecuta el comando offline idempotente para un unico dueno inicial sin ruta publica', async () => {
    const request: Record<string,unknown>={ approvalId:randomUUID(), operation:'INITIAL_PHARMACY_OWNER',
      targetUserId:users[1], pharmacyId:pharmacy, role:'DUENO', reason:'Aprobacion humana ficticia',
      expiresAt:new Date(Date.now()+60_000).toISOString(), idempotencyKey:'initial-pharmacy-owner-fixture' };
    const canonical=JSON.stringify({approvalId:request.approvalId,operation:request.operation,
      targetUserId:request.targetUserId,pharmacyId:request.pharmacyId,role:request.role,reason:request.reason,
      expiresAt:request.expiresAt,idempotencyKey:request.idempotencyKey});
    request.integrityHash=createHash('sha256').update(canonical).digest('hex');
    const file=join(tmpdir(),`farmafind-boot-${randomBytes(6).toString('hex')}.local.json`);
    await writeFile(file,JSON.stringify(request),{encoding:'utf8',mode:0o600});
    try {
      const script=fileURLToPath(new URL('../../../scripts/f01/bootstrap.mjs',import.meta.url));
      for(let attempt=0;attempt<2;attempt++) {
        const result=spawnSync(process.execPath,[script,file],{cwd:fileURLToPath(new URL('../../../',import.meta.url)),
          env:{...process.env,F01_BOOTSTRAP_DATABASE_URL:databaseUrl},encoding:'utf8'});
        expect(result.status,result.stderr).toBe(0);
      }
    } finally { await rm(file,{force:true}); }
    const rows=await database.query(`SELECT usuario_id,farmacia_id,rol,estado FROM f01.usuario_farmacia
      WHERE farmacia_id=$1`,[pharmacy]);
    expect(rows.rows).toEqual([{usuario_id:users[1],farmacia_id:pharmacy,rol:'DUENO',estado:'ACTIVA'}]);
    const duplicate=await approval('INITIAL_PHARMACY_OWNER',users[2],'DUENO',pharmacy);
    await expect(bootstrap(duplicate,'second-pharmacy-owner-fixture')).rejects.toMatchObject({code:'23505'});
  });

  it('concede y revoca otro administrador con aprobaciones de un uso y revoca sus sesiones', async () => {
    const grant=await approval('GRANT_PLATFORM_ROLE',users[1]);
    const created=await asActor(0,client=>client.query('SELECT * FROM f01.grant_platform_role($1,$2,$3,$4)',
      [users[1],'ADMINISTRADOR_PLATAFORMA',grant,randomUUID()]));
    expect(created.rows[0]).toMatchObject({usuario_id:users[1],estado:'ACTIVA'});
    await expect(asActor(0,client=>client.query('SELECT * FROM f01.grant_platform_role($1,$2,$3,$4)',
      [users[2],'ADMINISTRADOR_PLATAFORMA',grant,randomUUID()]))).rejects.toMatchObject({code:'42501'});
    const revoke=await approval('REVOKE_PLATFORM_ROLE',users[1]);
    await asActor(0,client=>client.query('SELECT * FROM f01.revoke_platform_role($1,$2,$3)',
      [created.rows[0].id,revoke,randomUUID()]));
    expect((await database.query('SELECT estado FROM f01.sesion WHERE usuario_id=$1',[users[1]])).rows[0].estado)
      .toBe('REVOCADA');
  });

  it('consume una aprobacion una sola vez ante solicitudes concurrentes', async () => {
    const id=await approval('GRANT_PLATFORM_ROLE',users[2]);
    const attempts=await Promise.allSettled([0,1].map(() => asActor(0,client=>client.query(
      'SELECT * FROM f01.grant_platform_role($1,$2,$3,$4)',
      [users[2],'ADMINISTRADOR_PLATAFORMA',id,randomUUID()]))));
    expect(attempts.filter(result=>result.status==='fulfilled')).toHaveLength(1);
    expect(attempts.filter(result=>result.status==='rejected')).toHaveLength(1);
    expect((await database.query(`SELECT count(*)::int AS count FROM f01.platform_role_assignment
      WHERE usuario_id=$1 AND estado='ACTIVA'`,[users[2]])).rows[0].count).toBe(1);
  });

  it('deniega autoelevacion, aprobacion vencida y no hereda acceso tenant', async () => {
    const self=await approval('GRANT_PLATFORM_ROLE',users[0]);
    await expect(asActor(0,client=>client.query('SELECT * FROM f01.grant_platform_role($1,$2,$3,$4)',
      [users[0],'ADMINISTRADOR_PLATAFORMA',self,randomUUID()]))).rejects.toMatchObject({code:'42501'});
    const expired=await approval('GRANT_PLATFORM_ROLE',users[2],'ADMINISTRADOR_PLATAFORMA',null,"now()-interval '1 minute'");
    await expect(asActor(0,client=>client.query('SELECT * FROM f01.grant_platform_role($1,$2,$3,$4)',
      [users[2],'ADMINISTRADOR_PLATAFORMA',expired,randomUUID()]))).rejects.toMatchObject({code:'42501'});
    const visible=await asActor(0,client=>client.query('SELECT count(*)::int AS count FROM f01.usuario_farmacia'));
    expect(visible.rows[0].count).toBe(0);
  });

  it('rechaza ambito de bootstrap incoherente y revierte el expediente completo', async () => {
    const invalid=randomUUID();
    await database.query('BEGIN');
    await database.query('SET LOCAL ROLE f01_bootstrap_executor');
    await expect(database.query(`SELECT f01.record_privileged_approval($1,'INITIAL_PHARMACY_OWNER',$2,NULL,
      'DUENO','Aprobacion humana ficticia',now()+interval '1 hour',$3)`,
    [invalid,users[2],randomBytes(32).toString('hex')])).rejects.toMatchObject({code:'23514'});
    await database.query('ROLLBACK');
    expect((await database.query('SELECT count(*)::int AS count FROM f01.privileged_approval WHERE id=$1',[invalid]))
      .rows[0].count).toBe(0);
    expect((await database.query('SELECT count(*)::int AS count FROM f01.usuario_farmacia WHERE usuario_id=$1',
      [users[2]])).rows[0].count).toBe(0);
  });
});
