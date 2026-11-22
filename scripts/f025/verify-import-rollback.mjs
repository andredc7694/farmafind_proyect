/** Invalid import cannot change stock in the existing technical F02.5 TEST slot. */
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {Client} from 'pg';
import {assertF025ConnectedTarget,assertF025EphemeralDatabase} from './test-env.mjs';

const local=new URL('../../.cache/f025-docker/',import.meta.url);
const state=JSON.parse(readFileSync(new URL('state.local.json',local),'utf8'));
const users=JSON.parse(readFileSync(new URL('browser-users.local.json',local),'utf8'));
assert.equal(users.kind,'F025_BROWSER_ORDINARY_TEST');
assert.equal(users.database,state.database);
const password=readFileSync(new URL('postgres-password.txt',local),'utf8').trim();
const dbUrl=new URL(`postgresql://127.0.0.1:55431/${state.database}`);
dbUrl.username='f01_migrator';dbUrl.password=password;
assertF025EphemeralDatabase(dbUrl.toString(),{migration:true});
const db=new Client({connectionString:dbUrl.toString()});
await db.connect();
try{await assertF025ConnectedTarget(db,state.database);}finally{await db.end();}

const base='http://127.0.0.1:3000/api/v1';
const origin='http://127.0.0.1:5173';
const cookies=new Map();
let csrf='';
async function request(method,path,body){
  const headers={Origin:origin,Cookie:[...cookies.values()].join('; ')};
  if(method!=='GET'&&csrf)headers['X-CSRF-Token']=csrf;
  if(body!==undefined&&!(body instanceof FormData))headers['Content-Type']='application/json';
  const response=await fetch(base+path,{method,headers,
    body:body===undefined?undefined:body instanceof FormData?body:JSON.stringify(body)});
  for(const value of response.headers.getSetCookie()){
    const pair=value.split(';')[0];cookies.set(pair.split('=')[0],pair);
  }
  const text=await response.text();
  return {status:response.status,body:text?JSON.parse(text):null};
}
async function renew(){const result=await request('GET','/auth/csrf');
  assert.equal(result.status,200);csrf=result.body.csrfToken;}

await renew();
assert.equal((await request('POST','/auth/login',users.accounts[0])).status,200);
await renew();
const memberships=await request('GET','/me/memberships');
assert.equal(memberships.status,200);
const own=memberships.body.filter(item=>item.pharmacyName.startsWith('Farmacia Navegador 1 ')).at(-1);
assert(own,'Falta propietario TEST de la primera farmacia');
const path=`/farmacias/${own.pharmacyId}`;
const before=await request('GET',`${path}/inventario`);
assert.equal(before.status,200);
const mapping={nombre:'nombre',concentracion:'concentracion',presentacion:'presentacion',
  clasificacion:'clasificacion',precioReferencial:'precio',cantidadFisica:'cantidad'};
const csv=`nombre,concentracion,presentacion,clasificacion,precio,cantidad\nreferencia inexistente ${randomBytes(8).toString('hex')},10 mg,tabletas,venta libre,1.00,2\n`;
const form=new FormData();
form.append('archivo',new Blob([csv],{type:'text/csv'}),`invalido-${randomBytes(8).toString('hex')}.csv`);
form.append('mapeo',JSON.stringify(mapping));
const preview=await request('POST',`${path}/importaciones/vista-previa`,form);
assert.equal(preview.status,200);
assert.equal(preview.body.errores.length,1);
const confirm=await request('POST',`${path}/importaciones/${preview.body.importacionId}/confirmar`);
assert.equal(confirm.status,409);
const after=await request('GET',`${path}/inventario`);
assert.equal(after.status,200);
assert.deepEqual(after.body,before.body,'La importación rechazada modificó el inventario');
const status=await request('GET',`${path}/importaciones/${preview.body.importacionId}`);
assert.equal(status.status,200);
assert.equal(status.body.estado,'RECHAZADA');
console.log(JSON.stringify({kind:'F025_IMPORT_ROLLBACK_TEST',checks:10,
  invalidRows:1,confirmationDenied:true,inventoryUnchanged:true,
  technicalTestOnly:true,persistentDatabaseTouched:false}));
