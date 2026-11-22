/** One-time TEST activation through real HTTP; credentials remain ignored locally. */
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {Client} from 'pg';
import {assertF025ConnectedTarget} from './test-env.mjs';

const directory=new URL('../../.cache/f025-docker/',import.meta.url);
const marker=new URL('http-activation.local.json',directory);
assert(!existsSync(marker),'Activación HTTP TEST ya ejecutada; no se repite automáticamente');
const credentials=JSON.parse(readFileSync(new URL('credentials.local.json',directory),'utf8'));
const state=JSON.parse(readFileSync(new URL('state.local.json',directory),'utf8'));
const adminPassword=readFileSync(new URL('postgres-password.txt',directory),'utf8').trim();
const db=new URL(`postgresql://127.0.0.1:55431/${state.database}`);
db.username='f01_migrator';db.password=adminPassword;
const client=new Client({connectionString:db.toString()});await client.connect();
try{await assertF025ConnectedTarget(client,state.database);}finally{await client.end();}

const base='http://127.0.0.1:3000/api/v1',origin='http://127.0.0.1:5173';
class Browser{
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
  async renew(){const response=await this.send('GET','/auth/csrf');assert.equal(response.status,200);
    this.csrf=response.body.csrfToken;}
}
const suffix=randomBytes(5).toString('hex');
const owner={email:`f025-owner-${suffix}@example.invalid`,
  password:`${randomBytes(24).toString('base64url')}Aa1!`};
const applicant=new Browser();let passed=0;
await applicant.renew();
assert.equal((await applicant.send('POST','/auth/register',owner)).status,202);passed++;
assert.equal((await applicant.send('POST','/auth/login',owner)).status,200);passed++;
await applicant.renew();
const input={nombreComercial:`Farmacia Activación TEST ${suffix}`,contacto:'Contacto ficticio',
  direccion:'Calle TEST 1',departamento:'Lima',provincia:'Lima',distrito:'Lima',
  representante:'Representante ficticio'};
const draft=await applicant.send('POST','/pharmacy-applications',input);
assert.equal(draft.status,201);passed++;
const id=draft.body.id;
const sent=await applicant.send('POST',`/pharmacy-applications/${id}/submit`,{version:1},
  {'Idempotency-Key':`f025-${randomBytes(12).toString('hex')}`});
assert.equal(sent.status,200);passed++;
const reviewer=new Browser();await reviewer.renew();
assert.equal((await reviewer.send('POST','/auth/login',credentials.reviewer)).status,200);passed++;
await reviewer.renew();
const reviewing=await reviewer.send('POST',`/platform/pharmacy-applications/${id}/decisions`,
  {accion:'INICIAR_REVISION',version:2,motivo:'Revisión de activación TEST'});
assert.equal(reviewing.status,200);passed++;
const key=`f025-activate-${randomBytes(12).toString('hex')}`;
const approved=await reviewer.send('POST',`/platform/pharmacy-applications/${id}/decisions`,
  {accion:'APROBAR',version:3,motivo:'Aprobación de activación TEST'},
  {'Idempotency-Key':key});
assert.equal(approved.status,200);assert.equal(approved.body.estado,'APROBADA');passed++;
const pharmacy=approved.body.farmaciaId;assert(pharmacy);passed++;
const repeated=await reviewer.send('POST',`/platform/pharmacy-applications/${id}/decisions`,
  {accion:'APROBAR',version:3,motivo:'Aprobación de activación TEST'},
  {'Idempotency-Key':key});
assert.equal(repeated.status,200);assert.equal(repeated.body.farmaciaId,pharmacy);passed++;
const memberships=await applicant.send('GET','/me/memberships');
assert.equal(memberships.status,200);
const own=memberships.body.find(item=>item.pharmacyId===pharmacy);
assert.equal(own.roleCode,'DUENO');
assert.deepEqual([...own.delegationCodes].sort(),[
  'inventory.history','inventory.import.confirm','inventory.import.preview',
  'inventory.read','inventory.write','reservation.accept','reservation.deliver',
  'reservation.read','reservation.settings']);passed++;
const inventory=await applicant.send('GET',`/farmacias/${pharmacy}/inventario`);
assert.equal(inventory.status,200);assert.deepEqual(inventory.body,[]);passed++;
assert.equal((await reviewer.send('GET',`/farmacias/${pharmacy}/inventario`)).status,404);passed++;
writeFileSync(marker,JSON.stringify({kind:'F025_TEST_HTTP_ACTIVATION',applicationId:id,
  pharmacyId:pharmacy,owner},null,2),{flag:'wx',mode:0o600});
console.log(JSON.stringify({kind:'F025_TEST_HTTP_ACTIVATION',passed,
  ownerInventoryAccessible:true,reviewerInventoryDenied:true}));
