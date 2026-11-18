import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { authHttpSecurity } from '../../src/modules/usuarios/contracts/http-security.js';
import { createLocationRouter } from '../../src/modules/farmacias/presentation/location-router.js';
import { ManagePharmacyLocation } from '../../src/modules/farmacias/application/manage-pharmacy-location.js';
import { LocationConflictError, LocationForbiddenError, LocationNotVisibleError,
  LocationValidationError } from '../../src/modules/farmacias/domain/pharmacy-location.js';

const id='00000000-0000-4000-8000-000000000001';
const proposalId='00000000-0000-4000-8000-000000000002';
const secret='a'.repeat(64);
const origin='http://127.0.0.1:5173';
const options={allowedOrigin:origin,csrfKey:Buffer.alloc(32,7),cookieSecure:false};
const body={direccionPublicable:'Calle Ficticia 1',ciudad:'Lima',latitud:-12,longitud:-77,fuente:'TEST F07'};

function fixture(result?:Error){
  const app=createApp();
  const security=authHttpSecurity(options);
  app.get('/csrf',security.issueCsrf);
  const identity={session:async()=>({userId:id})};
  const management={
    propose:async()=>{if(result)throw result;return{id:proposalId,estado:'PENDIENTE',version:0};},
    review:async()=>{if(result)throw result;return{id:proposalId,estado:'PUBLICADA_VERIFICADA',version:1};},
  } as unknown as ManagePharmacyLocation;
  app.use('/api/v1',createLocationRouter(identity,management,options));
  return app;
}
async function csrf(app:ReturnType<typeof createApp>,withSession=true){
  const cookie=withSession?`ff-session-local=${secret}`:'';
  const result=await request(app).get('/csrf').set('Cookie',cookie).expect(200);
  const nonce=/ff-csrf-local=([a-f0-9]{64})/.exec(result.headers['set-cookie']?.join(';')??'')?.[1];
  if(!nonce)throw new Error('CSRF TEST faltante');
  return {token:result.body.csrfToken as string,cookie:`${cookie}; ff-csrf-local=${nonce}`};
}
describe('F07 contrato HTTP privado',()=>{
  it('crea propuesta 201 y revisión 200 con sesión, origen y CSRF',async()=>{
    const app=fixture();const auth=await csrf(app);
    const proposed=await request(app).post(`/api/v1/farmacias/${id}/ubicacion/propuestas`)
      .set('Cookie',auth.cookie).set('Origin',origin).set('X-CSRF-Token',auth.token).send(body).expect(201);
    expect(proposed.body).toEqual({id:proposalId,estado:'PENDIENTE',version:0});
    expect(proposed.headers['cache-control']).toBe('no-store');
    const reviewed=await request(app).post(`/api/v1/farmacias/${id}/ubicacion/propuestas/${proposalId}/revision`)
      .set('Cookie',auth.cookie).set('Origin',origin).set('X-CSRF-Token',auth.token)
      .send({decision:'APROBAR',evidenciaConfirmada:true}).expect(200);
    expect(reviewed.body.estado).toBe('PUBLICADA_VERIFICADA');
  });
  it('rechaza ausencia de sesión, CSRF y UUID inválido',async()=>{
    const app=fixture();const anon=await csrf(app,false);const auth=await csrf(app);
    await request(app).post(`/api/v1/farmacias/${id}/ubicacion/propuestas`)
      .set('Cookie',anon.cookie).set('Origin',origin).set('X-CSRF-Token',anon.token).send(body).expect(401);
    await request(app).post(`/api/v1/farmacias/${id}/ubicacion/propuestas`)
      .set('Cookie',auth.cookie).set('Origin','http://example.invalid').set('X-CSRF-Token',auth.token)
      .send(body).expect(403);
    await request(app).post('/api/v1/farmacias/invalid/ubicacion/propuestas')
      .set('Cookie',auth.cookie).set('Origin',origin).set('X-CSRF-Token',auth.token).send(body).expect(400);
  });
  it.each([
    [new LocationValidationError(),400],
    [new LocationForbiddenError(),403],
    [new LocationNotVisibleError(),404],
    [new LocationConflictError(),409],
  ])('distingue errores de autorización y conflicto: %s',async(error,status)=>{
    const app=fixture(error);const auth=await csrf(app);
    const result=await request(app).post(`/api/v1/farmacias/${id}/ubicacion/propuestas`)
      .set('Cookie',auth.cookie).set('Origin',origin).set('X-CSRF-Token',auth.token).send(body).expect(status);
    expect(result.body).not.toHaveProperty('stack');
  });
});
