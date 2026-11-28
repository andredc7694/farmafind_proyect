import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { authHttpSecurity } from '../../src/modules/usuarios/contracts/http-security.js';
import { LocationConflictError, LocationForbiddenError, LocationValidationError, insidePeru,
  parseLocationProposal, parsePlatformLocationDecision } from '../../src/modules/farmacias/domain/pharmacy-location.js';
import { PlatformLocationReview } from '../../src/modules/farmacias/application/platform-location-review.js';
import type { PlatformLocationRepository } from '../../src/modules/farmacias/application/platform-location-review.js';
import type { LocationHistoryRow, LocationRepository, StoredLocationProposal } from '../../src/modules/farmacias/application/location-ports.js';
import { buildLocationStatus } from '../../src/modules/farmacias/application/location-status.js';
import { OpeningHoursValidationError, parseOpeningHours } from '../../src/modules/farmacias/domain/opening-hours.js';
import { ManageOpeningHours, OpeningHoursConflictError, ReadPublicOpeningHours } from '../../src/modules/farmacias/application/manage-opening-hours.js';
import { createPlatformLocationsRouter } from '../../src/modules/farmacias/presentation/platform-locations-router.js';
import { createOpeningHoursRouter } from '../../src/modules/farmacias/presentation/opening-hours-router.js';

const actor='00000000-0000-4000-8000-0000000000aa';
const other='00000000-0000-4000-8000-0000000000bb';
const pharmacy='00000000-0000-4000-8000-000000000001';
const proposalId='00000000-0000-4000-8000-000000000002';
const proposal=(over:Partial<StoredLocationProposal>={}):StoredLocationProposal=>({id:proposalId,pharmacyId:pharmacy,
  proposerId:other,reviewerId:null,status:'PENDIENTE',version:1,basePublicVersion:0,address:'Av. Ficticia 1',city:'lima',
  latitude:-12.05,longitude:-77.04,precisionMeters:null,source:'TEST',evidenceReference:null,...over});

describe('F07.1 · dominio de ubicación', () => {
  it('acepta coordenadas del Perú y rechaza las de fuera (FR-004)', () => {
    expect(insidePeru(-12.05,-77.04)).toBe(true);
    expect(insidePeru(-16.39,-71.53)).toBe(true);
    expect(insidePeru(40.4,-3.7)).toBe(false);
    const base={direccionPublicable:'Calle 1',ciudad:'Lima',fuente:'TEST'};
    expect(parseLocationProposal({...base,latitud:-12.05,longitud:-77.04}).latitude).toBe(-12.05);
    expect(()=>parseLocationProposal({...base,latitud:-34.6,longitud:-58.4})).toThrow(LocationValidationError);
  });
  it('la decisión de plataforma exige versión, evidencia al aprobar y motivo', () => {
    expect(parsePlatformLocationDecision({decision:'APROBAR',version:1,evidenciaConfirmada:true,motivo:'Coincide'}))
      .toMatchObject({decision:'APROBAR',version:1,reason:'Coincide'});
    for (const bad of [{decision:'APROBAR',version:1,evidenciaConfirmada:false,motivo:'x'},
      {decision:'APROBAR',evidenciaConfirmada:true,motivo:'x'},
      {decision:'RECHAZAR',version:1,evidenciaConfirmada:false},
      {decision:'APROBAR',version:1,evidenciaConfirmada:true,motivo:'x',extra:1}])
      expect(()=>parsePlatformLocationDecision(bad)).toThrow(LocationValidationError);
  });
});

function platformFixture(options:{reviewer?:boolean;found?:StoredLocationProposal|null;latest?:boolean;published?:boolean}={}) {
  const local={decide:vi.fn(async()=>({...proposal(),status:'PUBLICADA_VERIFICADA' as const,version:2,reviewerId:actor})),
    publish:vi.fn(async()=>options.published ?? true),audit:vi.fn(async()=>undefined)};
  const repository:PlatformLocationRepository={isReviewer:async()=>options.reviewer ?? true,
    listLatestPending:async()=>[],find:async()=>options.found===undefined?proposal():options.found,
    isLatestPending:async()=>options.latest ?? true,forPharmacy:()=>local as unknown as LocationRepository};
  const invalidator={invalidate:vi.fn(async()=>undefined)};
  const review=new PlatformLocationReview({run:(_secret,work)=>work(repository,actor)},invalidator);
  return {review,local,invalidator};
}
const approve={decision:'APROBAR',version:1,evidenciaConfirmada:true,motivo:'Dirección y punto coinciden'};

describe('F07.1 · revisión de plataforma (FR-005, D-04 A)', () => {
  it('aprueba la última pendiente: decide, publica, audita e invalida la búsqueda', async () => {
    const {review,local,invalidator}=platformFixture();
    await expect(review.decide('s',proposalId,approve)).resolves.toMatchObject({estado:'PUBLICADA_VERIFICADA'});
    expect(local.decide).toHaveBeenCalledWith(pharmacy,proposalId,actor,'PUBLICADA_VERIFICADA',1);
    expect(local.publish).toHaveBeenCalledOnce();
    expect(local.audit).toHaveBeenCalledWith(pharmacy,proposalId,actor,'APROBACION',true,'Dirección y punto coinciden');
    expect(invalidator.invalidate).toHaveBeenCalledOnce();
  });
  it('un rechazo no publica ni invalida', async () => {
    const {review,local,invalidator}=platformFixture();
    await review.decide('s',proposalId,{decision:'RECHAZAR',version:1,evidenciaConfirmada:false,motivo:'Punto en el mar'});
    expect(local.publish).not.toHaveBeenCalled();
    expect(local.audit).toHaveBeenCalledWith(pharmacy,proposalId,actor,'RECHAZO',false,'Punto en el mar');
    expect(invalidator.invalidate).not.toHaveBeenCalled();
  });
  it('sin concesión: 403 al listar y decidir', async () => {
    const {review}=platformFixture({reviewer:false});
    await expect(review.list('s')).rejects.toBeInstanceOf(LocationForbiddenError);
    await expect(review.decide('s',proposalId,approve)).rejects.toBeInstanceOf(LocationForbiddenError);
  });
  it('nunca aprueba lo propio; rechaza versiones obsoletas y propuestas reemplazadas', async () => {
    await expect(platformFixture({found:proposal({proposerId:actor})}).review.decide('s',proposalId,approve))
      .rejects.toBeInstanceOf(LocationForbiddenError);
    await expect(platformFixture({found:proposal({version:3})}).review.decide('s',proposalId,approve))
      .rejects.toBeInstanceOf(LocationConflictError);
    await expect(platformFixture({latest:false}).review.decide('s',proposalId,approve))
      .rejects.toBeInstanceOf(LocationConflictError);
    await expect(platformFixture({found:proposal({status:'RECHAZADA'})}).review.decide('s',proposalId,approve))
      .rejects.toBeInstanceOf(LocationConflictError);
    await expect(platformFixture({published:false}).review.decide('s',proposalId,approve))
      .rejects.toBeInstanceOf(LocationConflictError);
  });
});

describe('F07.1 · estado e historial (FR-006)', () => {
  const row=(over:Partial<StoredLocationProposal>,proposedAt:string,reviewedAt:string|null=null,reason:string|null=null):LocationHistoryRow=>
    ({proposal:proposal(over),proposedAt,reviewedAt,reason});
  it('sin propuestas ni publicación: SIN_UBICACION', () => {
    expect(buildLocationStatus([],null,actor)).toMatchObject({estado:'SIN_UBICACION',publicada:null,pendiente:null,historial:[]});
  });
  it('pendiente más reciente: EN_REVISION y la pendiente anterior aparece «Reemplazada»', () => {
    const view=buildLocationStatus([
      row({id:'b',proposerId:actor},'2026-11-26T12:00:00.000Z'),
      row({id:'a',proposerId:actor},'2026-11-26T10:00:00.000Z')],null,actor);
    expect(view.estado).toBe('EN_REVISION');
    expect(view.pendiente?.propuestaId).toBe('b');
    expect(view.historial.map(item=>`${item.accion}:${item.autor}`)).toEqual(['PROPUESTA:Tú','REEMPLAZADA:FarmaFind','PROPUESTA:Tú']);
  });
  it('aprobada: VERIFICADA con la revisión de FarmaFind, sin identificadores', () => {
    const view=buildLocationStatus([row({status:'PUBLICADA_VERIFICADA',reviewerId:other},'2026-11-26T10:00:00.000Z',
      '2026-11-26T11:00:00.000Z','Coincide')],{verified:true,address:'Av. Ficticia 1',city:'lima',latitude:-12.05,
      longitude:-77.04,verifiedAt:'2026-11-26T11:00:00.000Z'},actor);
    expect(view.estado).toBe('VERIFICADA');
    expect(view.historial[0]).toMatchObject({accion:'APROBACION',autor:'Revisión de FarmaFind',motivo:'Coincide'});
    expect(JSON.stringify(view)).not.toContain(other);
  });
  it('rechazada con una publicación anterior: RECHAZADA y lo publicado sigue', () => {
    const view=buildLocationStatus([row({status:'RECHAZADA'},'2026-11-26T10:00:00.000Z','2026-11-26T11:00:00.000Z','Punto en el mar')],
      {verified:true,address:'Calle antigua',city:'lima',latitude:-12,longitude:-77,verifiedAt:'2026-11-01T00:00:00.000Z'},actor);
    expect(view.estado).toBe('RECHAZADA');
    expect(view.publicada?.direccion).toBe('Calle antigua');
  });
});

const week=(over:Record<number,object>={})=>Array.from({length:7},(_,index)=>
  ({dia:index+1,cerrado:false,abre:'08:00',cierra:'20:00',...(over[index+1] ?? {})}));

describe('F07.1 · horario (FR-008, D-03 A)', () => {
  it('valida un tramo por día o «Cerrado»', () => {
    expect(parseOpeningHours({version:0,dias:week({7:{cerrado:true,abre:null,cierra:null}})}).dias[6])
      .toEqual({dia:7,cerrado:true,abre:null,cierra:null});
    for (const dias of [week({1:{abre:'20:00',cierra:'08:00'}}),week({2:{abre:'8:00'}}),week({3:{cerrado:true}}),
      week().slice(0,6),[...week().slice(0,6),{dia:1,cerrado:true}]])
      expect(()=>parseOpeningHours({version:0,dias})).toThrow(OpeningHoursValidationError);
  });
  it('guarda con versión y borra la caché; versión obsoleta → conflicto', async () => {
    const cache={get:vi.fn(),set:vi.fn(),forget:vi.fn(async()=>undefined)};
    const replace=vi.fn(async(_p:string,_a:string,expected:number)=>expected===0?{version:1,dias:[]}:null);
    const manage=new ManageOpeningHours({run:(_s,_p,_c,work)=>work({read:vi.fn(),replace},actor)},cache);
    await expect(manage.replace('s',pharmacy,{version:0,dias:week()})).resolves.toEqual({version:1,dias:[]});
    expect(cache.forget).toHaveBeenCalledWith(pharmacy);
    await expect(manage.replace('s',pharmacy,{version:5,dias:week()})).rejects.toBeInstanceOf(OpeningHoursConflictError);
  });
  it('lectura pública con cache-aside, ids válidos y máximo 50', async () => {
    const reader={read:vi.fn(async(ids:readonly string[])=>Object.fromEntries(ids.map(id=>[id,[]])))};
    const cache={get:vi.fn(async()=>({[pharmacy]:[]})),set:vi.fn(async()=>undefined),forget:vi.fn()};
    const publicHours=new ReadPublicOpeningHours(reader,cache);
    await publicHours.read(`${pharmacy},${proposalId}`);
    expect(reader.read).toHaveBeenCalledWith([proposalId]);
    await expect(publicHours.read('no-es-uuid')).rejects.toBeInstanceOf(RangeError);
    await expect(publicHours.read(Array.from({length:51},(_,i)=>`00000000-0000-4000-8000-${String(i).padStart(12,'0')}`).join(',')))
      .rejects.toBeInstanceOf(RangeError);
  });
});

const secret='a'.repeat(64), origin='http://127.0.0.1:5173';
const options={allowedOrigin:origin,csrfKey:Buffer.alloc(32,7),cookieSecure:false};
async function csrf(app:ReturnType<typeof createApp>) {
  const cookie=`ff-session-local=${secret}`;
  const result=await request(app).get('/csrf').set('Cookie',cookie).expect(200);
  const nonce=/ff-csrf-local=([a-f0-9]{64})/.exec(result.headers['set-cookie']?.join(';')??'')?.[1];
  return {token:result.body.csrfToken as string,cookie:`${cookie}; ff-csrf-local=${nonce}`};
}

describe('F07.1 · contrato HTTP', () => {
  it('plataforma: lista 200 sin caché, decisión con CSRF; 403 sin concesión; 409 conflicto', async () => {
    const app=createApp(); app.get('/csrf',authHttpSecurity(options).issueCsrf);
    let mode:'ok'|'forbidden'|'conflict'='ok';
    const review={list:async()=>{if(mode==='forbidden')throw new LocationForbiddenError('x');return[];},
      decide:async()=>{if(mode==='conflict')throw new LocationConflictError('x');return{propuestaId:proposalId,estado:'RECHAZADA',version:2};}};
    app.use('/api/v1',createPlatformLocationsRouter({session:async()=>({userId:actor})},review as never,options));
    const auth=await csrf(app);
    const list=await request(app).get('/api/v1/platform/location-proposals').set('Cookie',auth.cookie).expect(200);
    expect(list.headers['cache-control']).toBe('no-store');
    await request(app).post(`/api/v1/platform/location-proposals/${proposalId}/decision`).set('Cookie',auth.cookie)
      .set('Origin',origin).send(approve).expect(403);  // sin CSRF
    await request(app).post(`/api/v1/platform/location-proposals/${proposalId}/decision`).set('Cookie',auth.cookie)
      .set('Origin',origin).set('X-CSRF-Token',auth.token).send(approve).expect(200);
    mode='forbidden'; await request(app).get('/api/v1/platform/location-proposals').set('Cookie',auth.cookie).expect(403);
    mode='conflict'; await request(app).post(`/api/v1/platform/location-proposals/${proposalId}/decision`).set('Cookie',auth.cookie)
      .set('Origin',origin).set('X-CSRF-Token',auth.token).send(approve).expect(409);
    await request(app).get('/api/v1/platform/location-proposals').expect(401);
  });
  it('horario: público sin sesión; privado con sesión; 422 horas inválidas; 400 ids inválidos', async () => {
    const app=createApp(); app.get('/csrf',authHttpSecurity(options).issueCsrf);
    const manage={read:async()=>({version:0,dias:[]}),
      replace:async(_s:string,_p:string,body:unknown)=>({version:1,dias:parseOpeningHours(body).dias})};
    const publicHours={read:async(ids:unknown)=>{if(String(ids)==='x')throw new RangeError('x');return{};}};
    app.use('/api/v1',createOpeningHoursRouter({session:async()=>({userId:actor})},manage as never,publicHours as never,options));
    await request(app).get(`/api/v1/farmacias-publicas/horarios?ids=${pharmacy}`).expect(200);
    await request(app).get('/api/v1/farmacias-publicas/horarios?ids=x').expect(400);
    await request(app).get(`/api/v1/farmacias/${pharmacy}/horario`).expect(401);
    const auth=await csrf(app);
    await request(app).get(`/api/v1/farmacias/${pharmacy}/horario`).set('Cookie',auth.cookie).expect(200);
    await request(app).put(`/api/v1/farmacias/${pharmacy}/horario`).set('Cookie',auth.cookie).set('Origin',origin)
      .set('X-CSRF-Token',auth.token).send({version:0,dias:week()}).expect(200);
    await request(app).put(`/api/v1/farmacias/${pharmacy}/horario`).set('Cookie',auth.cookie).set('Origin',origin)
      .set('X-CSRF-Token',auth.token).send({version:0,dias:week({1:{abre:'21:00',cierra:'09:00'}})}).expect(422);
  });
});
