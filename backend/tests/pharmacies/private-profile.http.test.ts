import {describe,it,expect,vi} from 'vitest';
import express from 'express';
import request from 'supertest';
import {authHttpSecurity} from '../../src/modules/usuarios/presentation/auth-middleware.js';
import {createPharmacyProfileRouter} from '../../src/modules/farmacias/presentation/pharmacy-profile-router.js';

const options={allowedOrigin:'http://127.0.0.1:5173',csrfKey:Buffer.alloc(32,3),cookieSecure:false as const};
const farmacia='11111111-1111-4111-8111-111111111111';
const cookie='ff-session-local='+('a'.repeat(64));
const profile={farmaciaId:farmacia,contacto:'Contacto TEST',direccion:'Dirección TEST',
  departamento:'Lima',provincia:'Lima',distrito:'Lima',version:1,updatedAt:'2026-11-21T00:00:00.000Z'};
function setup(){
  const service={get:vi.fn(async()=>profile),updateContact:vi.fn(async()=>({...profile,contacto:'Nuevo TEST',version:2}))};
  const app=express();
  app.get('/api/v1/auth/csrf',authHttpSecurity(options).issueCsrf);
  app.use('/api/v1',createPharmacyProfileRouter(service as never,options));
  return {app,service};
}
async function csrf(app:express.Express){
  const result=await request(app).get('/api/v1/auth/csrf').set('Cookie',cookie);
  const nonce=(Array.isArray(result.headers['set-cookie'])?result.headers['set-cookie']:
    [result.headers['set-cookie']])[0].split(';')[0];
  return {cookies:[cookie,nonce],token:result.body.csrfToken as string};
}
describe('F02.5 perfil privado HTTP',()=>{
  it('requiere sesión y no consulta el perfil anónimamente',async()=>{
    const {app,service}=setup();
    expect((await request(app).get(`/api/v1/farmacias/${farmacia}/perfil`)).status).toBe(401);
    expect(service.get).not.toHaveBeenCalled();
  });
  it('consulta el perfil autorizado sin caché',async()=>{
    const {app,service}=setup();
    const result=await request(app).get(`/api/v1/farmacias/${farmacia}/perfil`).set('Cookie',cookie);
    expect(result.status).toBe(200);
    expect(result.headers['cache-control']).toBe('no-store');
    expect(service.get).toHaveBeenCalledWith('a'.repeat(64),farmacia);
  });
  it('no expone perfil ajeno cuando el servicio lo deniega',async()=>{
    const {app,service}=setup();service.get.mockRejectedValueOnce(new Error('No visible'));
    const result=await request(app).get(`/api/v1/farmacias/${farmacia}/perfil`).set('Cookie',cookie);
    expect(result.status).toBe(404);
    expect(JSON.stringify(result.body)).not.toContain('Contacto TEST');
  });
  it('exige CSRF y rechaza campos protegidos',async()=>{
    const {app,service}=setup();
    const url=`/api/v1/farmacias/${farmacia}/perfil`;
    expect((await request(app).patch(url).set('Cookie',cookie).send({contacto:'Nuevo TEST',version:1})).status).toBe(403);
    const guard=await csrf(app);
    const result=await request(app).patch(url).set('Cookie',guard.cookies)
      .set('Origin',options.allowedOrigin).set('X-CSRF-Token',guard.token)
      .send({contacto:'Nuevo TEST',version:1,direccion:'Cambio prohibido'});
    expect(result.status).toBe(400);
    expect(service.updateContact).not.toHaveBeenCalled();
  });
  it('propaga edición permitida y conflicto de versión',async()=>{
    const {app,service}=setup(),guard=await csrf(app);
    const send=()=>request(app).patch(`/api/v1/farmacias/${farmacia}/perfil`)
      .set('Cookie',guard.cookies).set('Origin',options.allowedOrigin)
      .set('X-CSRF-Token',guard.token).send({contacto:'Nuevo TEST',version:1});
    expect((await send()).status).toBe(200);
    expect(service.updateContact).toHaveBeenCalledWith('a'.repeat(64),farmacia,'Nuevo TEST',1);
    service.updateContact.mockRejectedValueOnce(new Error('Conflicto'));
    expect((await send()).status).toBe(409);
  });
});
