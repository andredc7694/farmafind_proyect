/** Five-pharmacy runtime RLS matrix. Synthetic sessions are rolled back. */
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {Client} from 'pg';
import {assertF025EphemeralDatabase,assertF025ConnectedTarget} from './test-env.mjs';

const local=new URL('../../.cache/f025-docker/',import.meta.url);
const state=JSON.parse(readFileSync(new URL('state.local.json',local),'utf8'));
const users=JSON.parse(readFileSync(new URL('browser-users.local.json',local),'utf8'));
assert.equal(users.kind,'F025_BROWSER_ORDINARY_TEST');
assert.equal(users.database,state.database);
assert.equal(users.accounts.length,5);
const password=readFileSync(new URL('postgres-password.txt',local),'utf8').trim();
const target=new URL(`postgresql://127.0.0.1:55431/${state.database}`);
target.username='f01_migrator';target.password=password;
assertF025EphemeralDatabase(target.toString(),{migration:true});
const client=new Client({connectionString:target.toString()});
await client.connect();
let inTransaction=false;
try{
  await assertF025ConnectedTarget(client,state.database);
  await client.query('BEGIN');inTransaction=true;
  const owners=[];
  for(const [index,account] of users.accounts.entries()){
    const rows=(await client.query(`SELECT u.id AS user_id,m.farmacia_id
      FROM f01.usuario u JOIN f01.usuario_farmacia m ON m.usuario_id=u.id
      JOIN f01.farmacia_referencia f ON f.id=m.farmacia_id
      WHERE u.email_canonico=$1 AND m.estado='ACTIVA' AND m.rol='DUENO'
        AND f.nombre_publico LIKE $2 ORDER BY m.created_at DESC LIMIT 1`,
    [account.email,`Farmacia Navegador ${index+1} %`])).rows;
    assert.equal(rows.length,1,`Falta propietario TEST ${index+1}`);
    const fingerprint=randomBytes(32).toString('hex');
    await client.query(`INSERT INTO f01.sesion(usuario_id,token_fingerprint,idle_expires_at,absolute_expires_at)
      VALUES($1,decode($2,'hex'),now()+interval '1 hour',now()+interval '1 day')`,
    [rows[0].user_id,fingerprint]);
    owners.push({id:rows[0].user_id,pharmacy:rows[0].farmacia_id,fingerprint});
  }
  await client.query('SET LOCAL ROLE f01_runtime');
  let pairs=0,denials=0,own=0;
  for(const owner of owners){
    await client.query("SELECT set_config('app.actor_user_id',$1,true)",[owner.id]);
    await client.query("SELECT set_config('app.session_fingerprint',$1,true)",[owner.fingerprint]);
    await client.query("SELECT set_config('app.farmacia_id',$1,true)",[owner.pharmacy]);
    const visible=Number((await client.query(`SELECT count(*) AS n FROM f02.inventario
      WHERE farmacia_id=$1`,[owner.pharmacy])).rows[0].n);
    assert(visible>0,'El inventario propio TEST debe tener productos');own++;
    assert.equal((await client.query(`SELECT f04.can_reservation_action($1,'reservation.read') AS allowed`,
      [owner.pharmacy])).rows[0].allowed,true);own++;
    for(const other of owners){
      if(other===owner)continue;
      // Changing only the tenant GUC cannot grant another membership.
      await client.query("SELECT set_config('app.farmacia_id',$1,true)",[other.pharmacy]);
      assert.equal(Number((await client.query(`SELECT count(*) AS n FROM f02.inventario
        WHERE farmacia_id=$1`,[other.pharmacy])).rows[0].n),0);denials++;
      assert.equal((await client.query(`SELECT f04.can_reservation_action($1,'reservation.read') AS allowed`,
        [other.pharmacy])).rows[0].allowed,false);denials++;
      pairs++;
    }
  }
  assert.equal(pairs,20);assert.equal(denials,40);assert.equal(own,10);
  console.log(JSON.stringify({kind:'F025_SQL_TENANT_MATRIX',owners:owners.length,pairs,
    sqlDenials:denials,ownChecks:own,rolledBack:true,persistentTouched:false}));
}finally{
  if(inTransaction)await client.query('ROLLBACK');
  await client.end();
}
