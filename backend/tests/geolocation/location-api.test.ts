import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { Client, Pool } from 'pg';
import { PgIdentityUnitOfWork } from '../../src/modules/usuarios/infrastructure/db/tenant-transaction.js';
import { PgLocationUnitOfWork } from '../../src/modules/farmacias/infrastructure/location-unit-of-work.js';
import { ManagePharmacyLocation } from '../../src/modules/farmacias/application/manage-pharmacy-location.js';

const group=process.env.F07_TEST_DATABASE_URL && process.env.F07_RUNTIME_DATABASE_URL ? describe : describe.skip;
group('F07 revisión real en PostgreSQL TEST efímera',()=>{
  let admin:Client; let pool:Pool; let manage:ManagePharmacyLocation;
  const invalidate=vi.fn().mockResolvedValue(undefined);
  let state:{kind:string;database:string;pharmacyIds:Record<string,string>;sessionSecrets:Record<string,string>};
  const proposal={direccionPublicable:'Avenida Ficticia 401',ciudad:'Lima',latitud:-12.043,longitud:-77.035,
    precisionMetros:15,fuente:'Verificación ficticia F07',evidenciaReferencia:'TEST-F07-401'};
  const created:string[]=[];
  let oldPublic:Record<string,unknown>;
  beforeAll(async()=>{
    state=JSON.parse(readFileSync(new URL('../../../.cache/f07-fixture/state.local.json',import.meta.url),'utf8'));
    if(state.kind!=='F07_TEST_ONLY'||new URL(process.env.F07_TEST_DATABASE_URL!).pathname!==`/${state.database}`)
      throw new Error('F07: base TEST requerida');
    admin=new Client({connectionString:process.env.F07_TEST_DATABASE_URL}); await admin.connect();
    pool=new Pool({connectionString:process.env.F07_RUNTIME_DATABASE_URL,max:1});
    manage=new ManagePharmacyLocation(new PgLocationUnitOfWork(new PgIdentityUnitOfWork(pool)),{invalidate});
    const stale=(await admin.query(`SELECT id FROM f07.ubicacion_propuesta
      WHERE evidencia_referencia='TEST-F07-401' AND farmacia_id=$1`,[state.pharmacyIds['alfa-centro']])).rows;
    for(const item of stale){
      await admin.query('DELETE FROM f07.ubicacion_auditoria WHERE propuesta_id=$1',[item.id]);
      await admin.query('DELETE FROM f07.ubicacion_propuesta WHERE id=$1',[item.id]);
    }
    oldPublic=(await admin.query('SELECT * FROM f03.farmacia_publica WHERE farmacia_id=$1',
      [state.pharmacyIds['alfa-centro']])).rows[0];
  });
  afterAll(async()=>{
    if(admin){
      await admin.query(`UPDATE f03.farmacia_publica SET direccion_texto=$2,ciudad=$3,latitud=$4,longitud=$5,
        precision_m=$6,fuente=$7,estado_ubicacion=$8,propuesta_por=$9,revisada_por=$10,
        fecha_verificacion=$11,updated_at=$12,public_version=$13 WHERE farmacia_id=$1`,
        [state.pharmacyIds['alfa-centro'],oldPublic.direccion_texto,oldPublic.ciudad,oldPublic.latitud,
          oldPublic.longitud,oldPublic.precision_m,oldPublic.fuente,oldPublic.estado_ubicacion,
          oldPublic.propuesta_por,oldPublic.revisada_por,oldPublic.fecha_verificacion,
          oldPublic.updated_at,oldPublic.public_version]);
      for(const id of created) {
        await admin.query('DELETE FROM f07.ubicacion_auditoria WHERE propuesta_id=$1',[id]);
        await admin.query('DELETE FROM f07.ubicacion_propuesta WHERE id=$1',[id]);
      }
      await admin.end();
    }
    if(pool)await pool.end();
  });
  it('proponente crea pendiente; revisor distinto publica y audita; repetir es idempotente',async()=>{
    const pharmacy=state.pharmacyIds['alfa-centro'];
    const pending=await manage.propose(state.sessionSecrets['alfa-proposer'],pharmacy,proposal);
    created.push(pending.id);
    expect(pending.estado).toBe('PENDIENTE');
    await expect(manage.review(state.sessionSecrets['alfa-proposer'],pharmacy,pending.id,
      {decision:'APROBAR',evidenciaConfirmada:true})).rejects.toThrow();
    const before=(await admin.query('SELECT direccion_texto FROM f03.farmacia_publica WHERE farmacia_id=$1',[pharmacy])).rows[0];
    expect(before.direccion_texto).not.toBe(proposal.direccionPublicable);
    const approved=await manage.review(state.sessionSecrets['alfa-reviewer'],pharmacy,pending.id,
      {decision:'APROBAR',evidenciaConfirmada:true});
    expect(approved.estado).toBe('PUBLICADA_VERIFICADA');
    expect(await manage.review(state.sessionSecrets['alfa-reviewer'],pharmacy,pending.id,
      {decision:'APROBAR',evidenciaConfirmada:true})).toEqual(approved);
    expect((await admin.query('SELECT direccion_texto FROM f03.farmacia_publica WHERE farmacia_id=$1',[pharmacy])).rows[0]
      .direccion_texto).toBe(proposal.direccionPublicable);
    expect((await admin.query('SELECT accion FROM f07.ubicacion_auditoria WHERE propuesta_id=$1',[pending.id]))
      .rows.map(row=>row.accion)).toEqual(['PROPUESTA','APROBACION']);
    expect(invalidate).toHaveBeenCalledTimes(1);
  });
  it('deniega tenant cruzado, capacidad incorrecta y entrada inválida',async()=>{
    const alfa=state.pharmacyIds['alfa-centro']; const beta=state.pharmacyIds['beta-centro'];
    await expect(manage.propose(state.sessionSecrets['alfa-proposer'],beta,proposal)).rejects.toThrow();
    await expect(manage.propose(state.sessionSecrets['alfa-reviewer'],alfa,proposal)).rejects.toThrow();
    await expect(manage.propose(state.sessionSecrets['alfa-proposer'],alfa,
      {...proposal,ciudad:'x'})).rejects.toThrow();
  });
  it('controla propuestas concurrentes y rechazo idempotente sin publicar versión obsoleta',async()=>{
    const pharmacy=state.pharmacyIds['alfa-centro'];
    const first=await manage.propose(state.sessionSecrets['alfa-proposer'],pharmacy,
      {...proposal,evidenciaReferencia:'TEST-F07-401'});
    const stale=await manage.propose(state.sessionSecrets['alfa-proposer'],pharmacy,
      {...proposal,direccionPublicable:'Avenida Ficticia 402',evidenciaReferencia:'TEST-F07-401'});
    created.push(first.id,stale.id);
    await manage.review(state.sessionSecrets['alfa-reviewer'],pharmacy,first.id,
      {decision:'APROBAR',evidenciaConfirmada:true});
    await expect(manage.review(state.sessionSecrets['alfa-reviewer'],pharmacy,stale.id,
      {decision:'APROBAR',evidenciaConfirmada:true})).rejects.toThrow();
    const row=(await admin.query('SELECT estado FROM f07.ubicacion_propuesta WHERE id=$1',[stale.id])).rows[0];
    expect(row.estado).toBe('PENDIENTE');
    const rejected=await manage.review(state.sessionSecrets['alfa-reviewer'],pharmacy,stale.id,
      {decision:'RECHAZAR',evidenciaConfirmada:false,motivo:'Propuesta obsoleta TEST'});
    expect(rejected.estado).toBe('RECHAZADA');
    expect(await manage.review(state.sessionSecrets['alfa-reviewer'],pharmacy,stale.id,
      {decision:'RECHAZAR',evidenciaConfirmada:false,motivo:'Propuesta obsoleta TEST'})).toEqual(rejected);
    expect(invalidate).toHaveBeenCalledTimes(2);
  });
});
