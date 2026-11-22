import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { Client } from 'pg';

const sql = readFileSync(new URL('../../migrations/f07/002_location_rls.sql',import.meta.url),'utf8');

describe('F07 RLS: controles estáticos previos a PostgreSQL real', () => {
  it('fuerza RLS en propuestas y auditoría y no concede BYPASSRLS', () => {
    expect(sql).toContain('ALTER TABLE f07.ubicacion_propuesta FORCE ROW LEVEL SECURITY');
    expect(sql).toContain('ALTER TABLE f07.ubicacion_auditoria FORCE ROW LEVEL SECURITY');
    expect(sql).not.toContain('BYPASSRLS;');
  });
  it('exige tenant, sesión, membresía activa y capacidad explícita', () => {
    for (const term of ['app.farmacia_id','app.actor_user_id','app.session_fingerprint',
      "s.estado='VIGENTE'","m.estado='ACTIVA'","d.estado='ACTIVA'",
      'GEO_LOCATION_PROPOSE','GEO_LOCATION_REVIEW']) expect(sql).toContain(term);
  });
  it('impide que el proponente revise su propia ubicación', () => {
    expect(sql).toContain('propuesta_por<>revisada_por');
    expect(sql).toContain("estado='PENDIENTE'");
  });
});

const group = process.env.F07_TEST_DATABASE_URL && process.env.F07_RUNTIME_DATABASE_URL ? describe : describe.skip;
group('F07 RLS PostgreSQL real — base TEST efímera', () => {
  let admin: Client; let runtime: Client; let proposalId = '';
  let state: {
    kind:string; database:string; role:string; pharmacyIds:Record<string,string>;
    identities:Record<string,{userId:string;membershipId:string}>; sessions:Record<string,string>;
  };
  beforeAll(async () => {
    state=JSON.parse(readFileSync(new URL('../../../.cache/f07-fixture/state.local.json',import.meta.url),'utf8'));
    if (state.kind !== 'F07_TEST_ONLY' || new URL(process.env.F07_TEST_DATABASE_URL!).pathname !== `/${state.database}`)
      throw new Error('F07: fixture TEST incorrecto');
    admin=new Client({connectionString:process.env.F07_TEST_DATABASE_URL}); await admin.connect();
    runtime=new Client({connectionString:process.env.F07_RUNTIME_DATABASE_URL}); await runtime.connect();
    proposalId=(await admin.query(`INSERT INTO f07.ubicacion_propuesta
      (farmacia_id,direccion_publicable,ciudad,latitud,longitud,fuente,propuesta_por)
      VALUES($1,'Dirección ficticia Alfa','lima',-12.04,-77.03,'Fixture F07 TEST',$2) RETURNING id`,
      [state.pharmacyIds['alfa-centro'],state.identities['alfa-proposer'].userId])).rows[0].id;
  });
  afterAll(async () => {
    if (admin) { if (proposalId) await admin.query('DELETE FROM f07.ubicacion_propuesta WHERE id=$1',[proposalId]); await admin.end(); }
    if (runtime) await runtime.end();
  });
  async function withScope(actor: string, pharmacy: string, query: () => Promise<void>) {
    await runtime.query('BEGIN');
    try {
      await runtime.query("SELECT set_config('app.actor_user_id',$1,true)",[state.identities[actor].userId]);
      await runtime.query("SELECT set_config('app.farmacia_id',$1,true)",[state.pharmacyIds[pharmacy]]);
      await runtime.query("SELECT set_config('app.session_fingerprint',$1,true)",[state.sessions[actor]]);
      await query();
    } finally { await runtime.query('ROLLBACK'); }
  }
  it('rol runtime carece de SUPERUSER/BYPASSRLS y ambas tablas usan FORCE RLS', async () => {
    expect((await admin.query('SELECT rolsuper,rolbypassrls FROM pg_roles WHERE rolname=$1',[state.role])).rows[0])
      .toEqual({rolsuper:false,rolbypassrls:false});
    const rows=(await admin.query(`SELECT relrowsecurity,relforcerowsecurity FROM pg_class
      WHERE oid IN ('f07.ubicacion_propuesta'::regclass,'f07.ubicacion_auditoria'::regclass)`)).rows;
    expect(rows).toHaveLength(2); expect(rows.every(row=>row.relrowsecurity && row.relforcerowsecurity)).toBe(true);
  });
  it('Alfa ve solo Alfa y Beta solo Beta, incluso con identificador ajeno', async () => {
    await withScope('alfa-proposer','alfa-centro',async () => {
      expect((await runtime.query('SELECT id FROM f07.ubicacion_propuesta')).rows.map(row=>row.id)).toEqual([proposalId]);
      expect((await runtime.query('SELECT f07.can_location_action($1,$2) AS allowed',
        [state.pharmacyIds['beta-centro'],'GEO_LOCATION_PROPOSE'])).rows[0].allowed).toBe(false);
    });
    await withScope('beta-proposer','beta-centro',async () => {
      expect((await runtime.query('SELECT id FROM f07.ubicacion_propuesta')).rows).toEqual([]);
      expect((await runtime.query('SELECT f07.can_location_action($1,$2) AS allowed',
        [state.pharmacyIds['beta-centro'],'GEO_LOCATION_PROPOSE'])).rows[0].allowed).toBe(true);
    });
  });
  it('el contexto local de una transacción no se filtra al reutilizar la conexión', async () => {
    await withScope('alfa-reviewer','alfa-centro',async () => {
      expect((await runtime.query('SELECT id FROM f07.ubicacion_propuesta')).rows).toHaveLength(1);
    });
    expect((await runtime.query('SELECT id FROM f07.ubicacion_propuesta')).rows).toEqual([]);
    expect((await runtime.query('SELECT f07.can_location_action($1,$2) AS allowed',
      [state.pharmacyIds['alfa-centro'],'GEO_LOCATION_REVIEW'])).rows[0].allowed).toBe(false);
  });
  it('RLS impide autoaprobación y modificación de la farmacia ajena en el rol runtime',async()=>{
    await withScope('alfa-proposer','alfa-centro',async()=>{
      const result=await runtime.query(`UPDATE f07.ubicacion_propuesta
        SET estado='PUBLICADA_VERIFICADA',revisada_por=$2,revisada_at=now(),version=version+1
        WHERE id=$1 RETURNING id`,[proposalId,state.identities['alfa-proposer'].userId]);
      expect(result.rows).toEqual([]);
    });
    await withScope('beta-reviewer','beta-centro',async()=>{
      const result=await runtime.query(`UPDATE f07.ubicacion_propuesta
        SET estado='RECHAZADA',revisada_por=$2,revisada_at=now(),version=version+1
        WHERE id=$1 RETURNING id`,[proposalId,state.identities['beta-reviewer'].userId]);
      expect(result.rows).toEqual([]);
      expect((await runtime.query('SELECT id FROM f07.ubicacion_propuesta WHERE id=$1',[proposalId])).rows).toEqual([]);
    });
    expect((await admin.query('SELECT estado FROM f07.ubicacion_propuesta WHERE id=$1',[proposalId])).rows[0].estado)
      .toBe('PENDIENTE');
  });
  it('sesión o membresía revocada deniega la capacidad aun con contexto de tenant',async()=>{
    const actor='alfa-proposer';const pharmacy='alfa-centro';
    await admin.query("UPDATE f01.sesion SET estado='REVOCADA' WHERE token_fingerprint=decode($1,'hex')",
      [state.sessions[actor]]);
    try {
      await withScope(actor,pharmacy,async()=>{
        expect((await runtime.query('SELECT f07.can_location_action($1,$2) AS allowed',
          [state.pharmacyIds[pharmacy],'GEO_LOCATION_PROPOSE'])).rows[0].allowed).toBe(false);
      });
    } finally {
      await admin.query("UPDATE f01.sesion SET estado='VIGENTE' WHERE token_fingerprint=decode($1,'hex')",
        [state.sessions[actor]]);
    }
    await admin.query("UPDATE f01.usuario_farmacia SET estado='REVOCADA' WHERE id=$1",
      [state.identities[actor].membershipId]);
    try {
      await withScope(actor,pharmacy,async()=>{
        expect((await runtime.query('SELECT f07.can_location_action($1,$2) AS allowed',
          [state.pharmacyIds[pharmacy],'GEO_LOCATION_PROPOSE'])).rows[0].allowed).toBe(false);
      });
    } finally {
      await admin.query("UPDATE f01.usuario_farmacia SET estado='ACTIVA' WHERE id=$1",
        [state.identities[actor].membershipId]);
    }
  });
  it('la proyección pública usa solo posiciones verificadas y no expone tablas privadas', async () => {
    const city=(await runtime.query("SELECT * FROM f07.list_public_pharmacies('lima')")).rows;
    expect(city).toHaveLength(4);
    expect(city.every(row=>row.ubicacion_verificada && row.farmacia_latitud !== null && row.farmacia_longitud !== null)).toBe(true);
    const offers=(await runtime.query("SELECT * FROM f03.search_public_offers('producto',NULL,NULL,200)")).rows;
    expect(offers).toHaveLength(3);
    expect(offers.every(row=>row.farmacia_latitud !== null && row.farmacia_longitud !== null)).toBe(true);
    expect((await runtime.query('SELECT farmacia_id FROM f03.farmacia_publica')).rows).toEqual([]);
  });
});
