/** Five ordinary synthetic TEST accounts for browser journeys; never privileged. */
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {Client} from 'pg';
import {Argon2PasswordHasher} from '../../backend/dist/modules/usuarios/infrastructure/argon2-password.js';
import {assertF025EphemeralDatabase,assertF025ConnectedTarget} from './test-env.mjs';

const local=new URL('../../.cache/f025-docker/',import.meta.url);
const file=new URL('browser-users.local.json',local);
const state=JSON.parse(readFileSync(new URL('state.local.json',local),'utf8'));
assert(!existsSync(file),'Cuentas de navegador TEST ya provisionadas; no repetir');
const secret=readFileSync(new URL('postgres-password.txt',local),'utf8').trim();
const url=new URL(`postgresql://127.0.0.1:55431/${state.database}`);
url.username='f01_migrator';url.password=secret;
assertF025EphemeralDatabase(url.toString(),{migration:true});
const client=new Client({connectionString:url.toString()});
await client.connect();
try{
  await assertF025ConnectedTarget(client,state.database);
  const hasher=new Argon2PasswordHasher();
  const accounts=[];
  await client.query('BEGIN');
  try{
    for(let number=1;number<=5;number++){
      const email=`f025-browser-${randomBytes(8).toString('hex')}@example.invalid`;
      const password=`Aa1!${randomBytes(24).toString('hex')}`;
      await client.query('INSERT INTO f01.usuario(email_canonico,password_hash) VALUES($1,$2)',
        [email,await hasher.hash(password)]);
      accounts.push({email,password});
    }
    await client.query('COMMIT');
  }catch(error){await client.query('ROLLBACK');throw error;}
  writeFileSync(file,JSON.stringify({kind:'F025_BROWSER_ORDINARY_TEST',database:state.database,
    accounts},null,2),{flag:'wx',mode:0o600});
  console.log('Cinco cuentas normales ficticias preparadas solo en PostgreSQL F02.5 TEST; sin roles ni membresias.');
}finally{await client.end();}
