import {describe,expect,it,vi} from 'vitest';
import express from 'express';
import request from 'supertest';
import {createPlatformApplicationsRouter} from '../../src/modules/farmacias/presentation/platform-applications-router.js';
import {authHttpSecurity} from '../../src/modules/usuarios/presentation/auth-middleware.js';

const options={allowedOrigin:'http://127.0.0.1:5173',csrfKey:Buffer.alloc(32,8),cookieSecure:false as const};
const cookie='ff-session-local='+('a'.repeat(64));
const id='11111111-1111-4111-8111-111111111111';
function setup(){
  const app=express();
  const identity={session:vi.fn(async()=>({userId:id}))};
  const review={list:vi.fn(async()=>[]),detail:vi.fn(async()=>({id,estado:'PENDIENTE'})),
    decide:vi.fn(async()=>({solicitudId:id,estado:'EN_REVISION',version:2}))};
  app.get('/api/v1/auth/csrf',authHttpSecurity(options).issueCsrf);
  app.use('/api/v1',createPlatformApplicationsRouter(identity,review as never,options));
  return {app,review};
}
async function authorizedHeaders(app:express.Express){
  const csrf=await request(app).get('/api/v1/auth/csrf').set('Cookie',cookie);
  const cookies=csrf.headers['set-cookie'];
  return {cookies:[cookie,(Array.isArray(cookies)?cookies:[cookies])[0].split(';')[0]],
    token:csrf.body.csrfToken as string};
}
describe('F02.5 plataforma HTTP',()=>{
  it('requiere sesión para listar solicitudes',async()=>{
    const {app,review}=setup();
    expect((await request(app).get('/api/v1/platform/pharmacy-applications')).status).toBe(401);
    expect(review.list).not.toHaveBeenCalled();
  });
  it('limita y valida filtros de lista',async()=>{
    const {app,review}=setup();
    const result=await request(app).get('/api/v1/platform/pharmacy-applications?limit=101')
      .set('Cookie',cookie);
    expect(result.status).toBe(400);
    expect(review.list).not.toHaveBeenCalled();
  });
  it('no decide sin CSRF',async()=>{
    const {app,review}=setup();
    const response=await request(app).post(`/api/v1/platform/pharmacy-applications/${id}/decisions`)
      .set('Cookie',cookie).send({accion:'APROBAR',version:1,motivo:'Aprobación TEST'});
    expect(response.status).toBe(403);
    expect(review.decide).not.toHaveBeenCalled();
  });
  it('acepta una revisión con sesión y CSRF válidos',async()=>{
    const {app,review}=setup();
    const csrf=await request(app).get('/api/v1/auth/csrf').set('Cookie',cookie);
    const cookies=csrf.headers['set-cookie'];
    const nonce=(Array.isArray(cookies)?cookies:[cookies])[0].split(';')[0];
    const response=await request(app).post(`/api/v1/platform/pharmacy-applications/${id}/decisions`)
      .set('Cookie',[cookie,nonce]).set('Origin',options.allowedOrigin)
      .set('X-CSRF-Token',csrf.body.csrfToken)
      .send({accion:'INICIAR_REVISION',version:1,motivo:'Revisión TEST'});
    expect(response.status).toBe(200);
    expect(review.decide).toHaveBeenCalledOnce();
  });
  it('devuelve 403 sin filtrar solicitud cuando falta el permiso de plataforma',async()=>{
    const {app,review}=setup();
    review.list.mockRejectedValueOnce(new Error('No autorizado'));
    const response=await request(app).get('/api/v1/platform/pharmacy-applications')
      .set('Cookie',cookie);
    expect(response.status).toBe(403);
    expect(JSON.stringify(response.body)).not.toContain(id);
  });
  it('rechaza una decisión inválida antes de invocar el caso de uso',async()=>{
    const {app,review}=setup();
    const csrf=await authorizedHeaders(app);
    const response=await request(app).post(`/api/v1/platform/pharmacy-applications/${id}/decisions`)
      .set('Cookie',csrf.cookies).set('Origin',options.allowedOrigin)
      .set('X-CSRF-Token',csrf.token).send({accion:'OTORGAR_DUENO',version:1,motivo:'Motivo TEST'});
    expect(response.status).toBe(400);
    expect(review.decide).not.toHaveBeenCalled();
  });
  it('informa conflicto de versión sin datos del solicitante',async()=>{
    const {app,review}=setup();
    review.decide.mockRejectedValueOnce(Object.assign(new Error('Conflicto'),{code:'40001'}));
    const csrf=await authorizedHeaders(app);
    const response=await request(app).post(`/api/v1/platform/pharmacy-applications/${id}/decisions`)
      .set('Cookie',csrf.cookies).set('Origin',options.allowedOrigin)
      .set('X-CSRF-Token',csrf.token).set('Idempotency-Key','synthetic-key-test-0001')
      .send({accion:'RECHAZAR',version:1,motivo:'Motivo TEST válido'});
    expect(response.status).toBe(409);
    expect(JSON.stringify(response.body)).not.toContain(id);
  });
});
