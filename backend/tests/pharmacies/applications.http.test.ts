import {describe,expect,it,vi} from 'vitest';
import express from 'express';
import request from 'supertest';
import {createPharmacyApplicationRouter} from '../../src/modules/farmacias/presentation/application-router.js';
import {authHttpSecurity} from '../../src/modules/usuarios/presentation/auth-middleware.js';

const options={allowedOrigin:'http://127.0.0.1:5173',csrfKey:Buffer.alloc(32,7),cookieSecure:false as const};
const sample={nombreComercial:'Farmacia TEST',contacto:'Contacto ficticio',direccion:'Calle TEST 1',
  departamento:'Lima',provincia:'Lima',distrito:'Lima',representante:'Representante ficticio'};
const view={id:'11111111-1111-4111-8111-111111111111',estado:'BORRADOR',version:1,
  nombreComercial:'Farmacia TEST',farmaciaId:null,createdAt:'2026-11-19T00:00:00.000Z'};

function setup(){
  const app=express();
  const identity={session:vi.fn(async()=>({userId:'22222222-2222-4222-8222-222222222222'}))};
  const management={create:vi.fn(async()=>view),list:vi.fn(async()=>[view]),get:vi.fn(async()=>view),
    change:vi.fn(async()=>({...view,estado:'PENDIENTE',version:2}))};
  app.get('/api/v1/auth/csrf',authHttpSecurity(options).issueCsrf);
  app.use('/api/v1',createPharmacyApplicationRouter(identity,management as never,options));
  return {app,identity,management};
}
function sessionCookie(){return 'ff-session-local='+('a'.repeat(64));}
async function csrfHeaders(app:express.Express){
  const csrf=await request(app).get('/api/v1/auth/csrf').set('Cookie',sessionCookie());
  const cookies=csrf.headers['set-cookie'];
  return {cookie:[sessionCookie(),(Array.isArray(cookies)?cookies:[cookies])[0].split(';')[0]],
    token:csrf.body.csrfToken as string};
}

describe('F02.5 solicitudes HTTP',()=>{
  it('rechaza ausencia de sesión y no llama al servicio',async()=>{
    const {app,management}=setup();
    const response=await request(app).get('/api/v1/pharmacy-applications/me');
    expect(response.status).toBe(401);
    expect(management.list).not.toHaveBeenCalled();
  });
  it('rechaza mutación sin CSRF antes de crear borrador',async()=>{
    const {app,management}=setup();
    const response=await request(app).post('/api/v1/pharmacy-applications')
      .set('Cookie',sessionCookie()).send(sample);
    expect(response.status).toBe(403);
    expect(management.create).not.toHaveBeenCalled();
  });
  it('crea borrador con sesión y CSRF válidos sin privilegios',async()=>{
    const {app,management}=setup();
    const csrf=await request(app).get('/api/v1/auth/csrf').set('Cookie',sessionCookie());
    const cookies=csrf.headers['set-cookie'];
    const nonce=(Array.isArray(cookies)?cookies:[cookies])[0].split(';')[0];
    const response=await request(app).post('/api/v1/pharmacy-applications')
      .set('Cookie',[sessionCookie(),nonce]).set('Origin',options.allowedOrigin)
      .set('X-CSRF-Token',csrf.body.csrfToken).send(sample);
    expect(response.status).toBe(201);
    expect(response.body).toEqual(view);
    expect(management.create).toHaveBeenCalledOnce();
  });
  it('lista solicitudes propias sin exponer datos internos',async()=>{
    const {app}=setup();
    const response=await request(app).get('/api/v1/pharmacy-applications/me')
      .set('Cookie',sessionCookie());
    expect(response.status).toBe(200);
    expect(response.body).toEqual([view]);
  });
  it('no revela una solicitud ajena aunque se conozca su identificador',async()=>{
    const {app,management}=setup();
    management.get.mockRejectedValueOnce(new Error('No visible'));
    const response=await request(app).get(`/api/v1/pharmacy-applications/${view.id}`)
      .set('Cookie',sessionCookie());
    expect(response.status).toBe(404);
    expect(JSON.stringify(response.body)).not.toContain('Farmacia TEST');
  });
  it('rechaza identificadores inválidos antes de consultar la solicitud',async()=>{
    const {app,management}=setup();
    const csrf=await csrfHeaders(app);
    const response=await request(app).post('/api/v1/pharmacy-applications/not-a-uuid/submit')
      .set('Cookie',csrf.cookie).set('Origin',options.allowedOrigin)
      .set('X-CSRF-Token',csrf.token).set('Idempotency-Key','synthetic-test-id-0001')
      .send({version:1});
    expect(response.status).toBe(400);
    expect(management.get).not.toHaveBeenCalled();
  });
  it('rechaza campos privilegiados antes de guardar el borrador',async()=>{
    const {app,management}=setup();
    management.create.mockRejectedValueOnce(new Error('Entrada no válida'));
    const csrf=await csrfHeaders(app);
    const response=await request(app).post('/api/v1/pharmacy-applications')
      .set('Cookie',csrf.cookie).set('Origin',options.allowedOrigin)
      .set('X-CSRF-Token',csrf.token).send({...sample,rol:'ADMINISTRADOR_PLATAFORMA'});
    expect(response.status).toBe(400);
    expect(response.body).not.toHaveProperty('rol');
  });
  it('rechaza versión inválida e idempotencia ausente en el envío',async()=>{
    const {app,management}=setup();
    const csrf=await csrfHeaders(app);
    for(const payload of [{version:0},{version:1}]){
      const response=await request(app).post(`/api/v1/pharmacy-applications/${view.id}/submit`)
        .set('Cookie',csrf.cookie).set('Origin',options.allowedOrigin)
        .set('X-CSRF-Token',csrf.token).send(payload);
      expect(response.status).toBe(400);
    }
    expect(management.change).not.toHaveBeenCalled();
  });
});
