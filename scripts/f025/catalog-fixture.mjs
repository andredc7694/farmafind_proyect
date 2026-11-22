/** One fictitious shared catalog reference in the isolated technical TEST database. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {Client} from 'pg';
import {assertF025EphemeralDatabase,assertF025ConnectedTarget} from './test-env.mjs';
import {localStateName} from './demo-slot.mjs';

const local=new URL('../../.cache/f025-docker/',import.meta.url);
const file=new URL(localStateName('catalog-fixture.local.json'),local);
const state=JSON.parse(readFileSync(new URL(localStateName('state.local.json'),local),'utf8'));
const secret=readFileSync(new URL('postgres-password.txt',local),'utf8').trim();
const url=new URL(`postgresql://127.0.0.1:55431/${state.database}`);
url.username='f01_migrator';url.password=secret;
assertF025EphemeralDatabase(url.toString(),{migration:true});
const client=new Client({connectionString:url.toString()});
await client.connect();
try{
  await assertF025ConnectedTarget(client,state.database);
  const name=`producto demo f025 ${state.database.slice(-12)}`;
  if(existsSync(file)){
    const saved=JSON.parse(readFileSync(file,'utf8'));
    assert.equal(saved.database,state.database);
    const result=await client.query('SELECT id FROM f02.medicamento WHERE id=$1 AND nombre=$2',[saved.id,name]);
    assert.equal(result.rowCount,1,'La referencia TEST registrada ya no existe');
    console.log('Referencia ficticia de catalogo F02.5 TEST ya preparada; no se duplica.');
  }else{
    const existing=await client.query('SELECT id FROM f02.medicamento WHERE nombre=$1',[name]);
    assert(existing.rowCount<=1,'Referencia TEST duplicada: requiere revision');
    let id=existing.rows[0]?.id;
    if(!id){
      const result=await client.query(`INSERT INTO f02.medicamento
        (nombre,concentracion,presentacion,clasificacion,principio_activo)
        VALUES($1,'10 mg','tabletas','venta libre','sustancia demo f025') RETURNING id`,[name]);
      id=result.rows[0].id;
    }
    writeFileSync(file,JSON.stringify({kind:'F025_CATALOG_TEST',database:state.database,
      name,id},null,2),{flag:'wx',mode:0o600});
    console.log('Una referencia ficticia de catalogo preparada en PostgreSQL F02.5 TEST; sin inventario precargado.');
  }
}finally{await client.end();}
