import {createHash,createHmac,randomUUID} from 'node:crypto';
import {describe,it,expect} from 'vitest';
import request from 'supertest';
import {createApp} from '../src/app.js';
import {MemoryApplicationEventRepository} from '../src/events/application-repository.js';
import {canonicalJson} from '../src/events/signature.js';

const secret='f025-local-test-secret-'+'a'.repeat(40);
const now=new Date('2026-11-21T12:00:00.000Z');
function event(){return {eventId:randomUUID(),version:1,type:'SOLICITUD_ENVIADA',
  correlationId:randomUUID(),occurredAt:now.toISOString(),
  payload:{applicationId:randomUUID(),applicationVersion:2,recipientUserId:randomUUID()}};}
function signed(value:unknown,path='/internal/v1/pharmacy-application-events'){
  const body=canonicalJson(value),id=String((value as {eventId:string}).eventId),timestamp=now.toISOString();
  const digest=createHash('sha256').update(body).digest('hex');
  const signature=createHmac('sha256',secret).update(`POST\n${path}\n${timestamp}\n${id}\n${digest}`).digest('hex');
  return {'X-FarmaFind-Event-Id':id,'X-FarmaFind-Timestamp':timestamp,
    'X-FarmaFind-Signature':`sha256=${signature}`};
}
describe('F02.5 contrato interno F05 separado de reservas',()=>{
  const path='/internal/v1/pharmacy-application-events';
  it('acepta un evento mínimo y deduplica su reenvío',async()=>{
    const app=createApp({processor:{execute:async()=>{throw new Error('ruta F04 no usada');}} as never,
      applicationRepository:new MemoryApplicationEventRepository(),secret,clock:{now:()=>now}});
    const value=event(),headers=signed(value);
    expect((await request(app).post(path).set(headers).send(value)).status).toBe(202);
    expect((await request(app).post(path).set(headers).send(value)).status).toBe(200);
  });
  it('rechaza firma inválida, payload privado y colisión de identidad',async()=>{
    const app=createApp({processor:{} as never,applicationRepository:new MemoryApplicationEventRepository(),
      secret,clock:{now:()=>now}});
    const value=event();
    expect((await request(app).post(path).send(value)).status).toBe(401);
    const privateValue={...value,payload:{...value.payload,email:'persona@example.invalid'}};
    expect((await request(app).post(path).set(signed(privateValue)).send(privateValue)).status).toBe(422);
    expect((await request(app).post(path).set(signed(value)).send(value)).status).toBe(202);
    const changed={...value,payload:{...value.payload,applicationVersion:3}};
    expect((await request(app).post(path).set(signed(changed)).send(changed)).status).toBe(409);
  });
  it('no duplica un efecto lógico aunque cambie eventId',async()=>{
    const app=createApp({processor:{} as never,applicationRepository:new MemoryApplicationEventRepository(),
      secret,clock:{now:()=>now}});
    const first=event(),second={...first,eventId:randomUUID()};
    expect((await request(app).post(path).set(signed(first)).send(first)).status).toBe(202);
    expect((await request(app).post(path).set(signed(second)).send(second)).status).toBe(409);
  });
  it('devuelve fallo temporal sin alterar la solicitud de origen',async()=>{
    const app=createApp({processor:{} as never,
      applicationRepository:{accept:async()=>{throw new Error('PostgreSQL TEST indisponible');}},
      secret,clock:{now:()=>now}});
    const value=event();
    expect((await request(app).post(path).set(signed(value)).send(value)).status).toBe(503);
  });
});
