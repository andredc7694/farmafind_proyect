/** Real loopback HTTP against the dedicated F02.5 TEST API; no pharmacy is activated. */
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {readFileSync} from 'node:fs';

const credentials=JSON.parse(readFileSync(new URL('../../.cache/f025-docker/credentials.local.json',
  import.meta.url),'utf8'));
const base='http://127.0.0.1:3000/api/v1';
const origin='http://127.0.0.1:5173';
const cookiePart=value=>value?.split(';')[0];
class Browser {
  cookies=new Map(); csrf='';
  async send(method,path,body,extra={}){
    const headers={Origin:origin,Cookie:[...this.cookies.values()].join('; '),...extra};
    if(body!==undefined)headers['Content-Type']='application/json';
    if(method!=='GET'&&this.csrf)headers['X-CSRF-Token']=this.csrf;
    const response=await fetch(base+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});
    for(const setCookie of response.headers.getSetCookie()){
      const part=cookiePart(setCookie);if(part)this.cookies.set(part.split('=')[0],part);
    }
    const text=await response.text();
    return {status:response.status,body:text?JSON.parse(text):null};
  }
  async renew(){const result=await this.send('GET','/auth/csrf');assert.equal(result.status,200);
    this.csrf=result.body.csrfToken;}
}
let passed=0;
const visitor=new Browser();
assert.equal((await visitor.send('GET','/pharmacy-applications/me')).status,401);passed++;
assert.equal((await visitor.send('GET','/platform/pharmacy-applications')).status,401);passed++;
const suffix=randomBytes(5).toString('hex');
const email=`f025-http-${suffix}@example.invalid`;
const password=`${randomBytes(24).toString('base64url')}Aa1!`;
await visitor.renew();
assert.equal((await visitor.send('POST','/auth/register',{email,password})).status,202);passed++;
assert.equal((await visitor.send('POST','/auth/login',{email,password})).status,200);passed++;
await visitor.renew();
assert.equal((await visitor.send('GET','/platform/pharmacy-applications')).status,403);passed++;
const input={nombreComercial:`Farmacia HTTP ${suffix}`,contacto:'Contacto ficticio',
  direccion:'Calle TEST 1',departamento:'Lima',provincia:'Lima',distrito:'Lima',
  representante:'Representante ficticio'};
const draft=await visitor.send('POST','/pharmacy-applications',input);
assert.equal(draft.status,201);assert.equal(draft.body.estado,'BORRADOR');passed++;
const id=draft.body.id;
const own=await visitor.send('GET','/pharmacy-applications/me');
assert.equal(own.status,200);assert(own.body.some(item=>item.id===id));passed++;
const other=new Browser();await other.renew();
const otherEmail=`f025-http-other-${suffix}@example.invalid`;
const otherPassword=`${randomBytes(24).toString('base64url')}Aa1!`;
assert.equal((await other.send('POST','/auth/register',
  {email:otherEmail,password:otherPassword})).status,202);
assert.equal((await other.send('POST','/auth/login',
  {email:otherEmail,password:otherPassword})).status,200);
const otherList=await other.send('GET','/pharmacy-applications/me');
assert.equal(otherList.status,200);assert(!otherList.body.some(item=>item.id===id));passed++;
assert.equal((await other.send('GET',`/pharmacy-applications/${id}`)).status,404);passed++;
const sent=await visitor.send('POST',`/pharmacy-applications/${id}/submit`,{version:1},
  {'Idempotency-Key':`f025-http-${randomBytes(12).toString('hex')}`});
assert.equal(sent.status,200);assert.equal(sent.body.estado,'PENDIENTE');passed++;
const reviewer=new Browser();await reviewer.renew();
assert.equal((await reviewer.send('POST','/auth/login',credentials.reviewer)).status,200);passed++;
await reviewer.renew();
const listed=await reviewer.send('GET','/platform/pharmacy-applications');
assert.equal(listed.status,200);assert(listed.body.some(item=>item.id===id));passed++;
const detail=await reviewer.send('GET',`/platform/pharmacy-applications/${id}`);
assert.equal(detail.status,200);assert.equal(detail.body.nombreComercial,input.nombreComercial);passed++;
const reviewing=await reviewer.send('POST',`/platform/pharmacy-applications/${id}/decisions`,
  {accion:'INICIAR_REVISION',version:2,motivo:'Revisión HTTP TEST'});
assert.equal(reviewing.status,200);assert.equal(reviewing.body.estado,'EN_REVISION');passed++;
const rejected=await reviewer.send('POST',`/platform/pharmacy-applications/${id}/decisions`,
  {accion:'RECHAZAR',version:3,motivo:'Solicitud sintética de prueba'},
  {'Idempotency-Key':`f025-http-${randomBytes(12).toString('hex')}`});
assert.equal(rejected.status,200);assert.equal(rejected.body.estado,'RECHAZADA');passed++;
assert.equal((await visitor.send('GET',`/platform/pharmacy-applications/${id}`)).status,403);passed++;
console.log(JSON.stringify({kind:'F025_TEST_HTTP',passed,pharmacyActivated:false,
  persistentDatabaseTouched:false}));
