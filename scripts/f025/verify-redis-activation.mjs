/** Real Redis generation change after an authorized activation in technical TEST only. */
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {readFileSync,existsSync,writeFileSync} from 'node:fs';
import {createClient} from 'redis';

const local=new URL('../../.cache/f025-docker/',import.meta.url);
const marker=new URL('redis-activation.local.json',local);
assert(!existsSync(marker),'Verificacion de activacion Redis TEST ya ejecutada; no repetir altas');
const state=JSON.parse(readFileSync(new URL('state.local.json',local),'utf8'));
assert.match(state.database,/^farmafind_f01_test_[a-f0-9]{12}$/);
const credentials=JSON.parse(readFileSync(new URL('credentials.local.json',local),'utf8'));
const password=readFileSync(new URL('../../.cache/f03-docker/redis-password.txt',import.meta.url),'utf8').trim();
const redisUrl=new URL('redis://127.0.0.1:56379/0');redisUrl.password=password;
const redis=createClient({url:redisUrl.toString()});await redis.connect();
const base='http://127.0.0.1:3000/api/v1',origin='http://127.0.0.1:5173';
class Browser {
  cookies=new Map();csrf='';
  async send(method,path,body,extra={}){
    const headers={Origin:origin,Cookie:[...this.cookies.values()].join('; '),...extra};
    if(body!==undefined)headers['Content-Type']='application/json';
    if(method!=='GET'&&this.csrf)headers['X-CSRF-Token']=this.csrf;
    const response=await fetch(base+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});
    for(const cookie of response.headers.getSetCookie()){
      const pair=cookie.split(';')[0];this.cookies.set(pair.split('=')[0],pair);
    }
    const content=await response.text();return {status:response.status,body:content?JSON.parse(content):null};
  }
  async renew(){const result=await this.send('GET','/auth/csrf');
    assert.equal(result.status,200);this.csrf=result.body.csrfToken;}
}
const generation=()=>redis.get('farmafind:f03:v1:generation').then(value=>Number(value??'0'));
try {
  const before=await generation();
  const suffix=randomBytes(5).toString('hex');
  const owner={email:`f025-redis-${suffix}@example.invalid`,
    password:`${randomBytes(24).toString('base64url')}Aa1!`};
  const applicant=new Browser();await applicant.renew();
  assert.equal((await applicant.send('POST','/auth/register',owner)).status,202);
  assert.equal((await applicant.send('POST','/auth/login',owner)).status,200);
  await applicant.renew();
  const draft=await applicant.send('POST','/pharmacy-applications',{
    nombreComercial:`Farmacia Redis TEST ${suffix}`,contacto:'Contacto ficticio',
    direccion:'Calle TEST 1',departamento:'Lima',provincia:'Lima',distrito:'Lima',
    representante:'Representante ficticio'});
  assert.equal(draft.status,201);
  const id=draft.body.id;
  assert.equal((await applicant.send('POST',`/pharmacy-applications/${id}/submit`,{version:1},
    {'Idempotency-Key':`f025-${randomBytes(12).toString('hex')}`})).status,200);
  const reviewer=new Browser();await reviewer.renew();
  assert.equal((await reviewer.send('POST','/auth/login',credentials.reviewer)).status,200);
  await reviewer.renew();
  assert.equal((await reviewer.send('POST',`/platform/pharmacy-applications/${id}/decisions`,
    {accion:'INICIAR_REVISION',version:2,motivo:'Revision sintetica TEST'})).status,200);
  assert.equal(await generation(),before,'La revision no debe invalidar Redis');
  const approved=await reviewer.send('POST',`/platform/pharmacy-applications/${id}/decisions`,
    {accion:'APROBAR',version:3,motivo:'Aprobacion sintetica TEST'},
    {'Idempotency-Key':`f025-${randomBytes(12).toString('hex')}`});
  assert.equal(approved.status,200);assert.equal(approved.body.estado,'APROBADA');
  assert.equal(await generation(),before+1,'La activacion debe invalidar Redis tras commit');
  assert.equal((await reviewer.send('GET',`/farmacias/${approved.body.farmaciaId}/inventario`)).status,404);
  writeFileSync(marker,JSON.stringify({kind:'F025_REDIS_ACTIVATION_TEST',database:state.database,
    pharmacyId:approved.body.farmaciaId,generationBefore:before,generationAfter:before+1},null,2),
    {flag:'wx',mode:0o600});
  console.log(JSON.stringify({kind:'F025_REDIS_ACTIVATION_TEST',database:state.database,
    generationAdvanced:true,reviewUnchanged:true,reviewerInventoryDenied:true}));
} finally {await redis.quit();}
