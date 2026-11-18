/** Real F07 private HTTP check; mutations and cleanup restricted to isolated TEST DB. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Client } from 'pg';
import { assertF07EphemeralDatabase } from './fixtures.mjs';

const state=JSON.parse(readFileSync(new URL('../../.cache/f07-fixture/state.local.json',import.meta.url),'utf8'));
assert.equal(state.kind,'F07_TEST_ONLY');
assert.equal(assertF07EphemeralDatabase(state.runtimeUrl).pathname,`/${state.database}`);
const secret=readFileSync(new URL('../../.cache/f01-docker/postgres-password.txt',import.meta.url),'utf8').trim();
assert.match(secret,/^[a-f0-9]{64}$/i);
const url=new URL(state.runtimeUrl);url.username='f01_migrator';url.password=secret;
const admin=new Client({connectionString:url.toString()});await admin.connect();
const pharmacy=state.pharmacyIds['alfa-centro'];
const base='http://127.0.0.1:3000/api/v1';
const origin='http://127.0.0.1:5173';
let proposalId;
const oldPublic=(await admin.query('SELECT * FROM f03.farmacia_publica WHERE farmacia_id=$1',[pharmacy])).rows[0];

async function post(actor,path,body) {
  const session=state.sessionSecrets[actor];assert.match(session,/^[a-f0-9]{64}$/i);
  const csrf=await fetch(`${base}/auth/csrf`,{headers:{Cookie:`ff-session-local=${session}`}});
  assert.equal(csrf.status,200,'CSRF TEST');
  const token=(await csrf.json()).csrfToken;
  const nonce=/ff-csrf-local=([a-f0-9]{64})/.exec(csrf.headers.getSetCookie().join(';'))?.[1];
  assert.ok(nonce,'Cookie CSRF TEST');
  const result=await fetch(`${base}${path}`,{method:'POST',headers:{Origin:origin,
    Cookie:`ff-session-local=${session}; ff-csrf-local=${nonce}`,
    'X-CSRF-Token':token,'Content-Type':'application/json'},body:JSON.stringify(body)});
  return {status:result.status,data:await result.json()};
}
try {
  const path=`/farmacias/${pharmacy}/ubicacion/propuestas`;
  const body={direccionPublicable:'Calle HTTP Ficticia 707',ciudad:'Lima',latitud:-12.044,
    longitud:-77.034,fuente:'TEST F07 HTTP',evidenciaReferencia:'TEST-F07-HTTP'};
  const proposed=await post('alfa-proposer',path,body);
  assert.equal(proposed.status,201,`Propuesta HTTP: ${proposed.data.code??'sin código'}`);
  proposalId=proposed.data.id;
  const self=await post('alfa-proposer',`${path}/${proposalId}/revision`,
    {decision:'APROBAR',evidenciaConfirmada:true});
  assert.equal(self.status,403,'Autoaprobación HTTP');
  const cross=await post('beta-reviewer',`${path}/${proposalId}/revision`,
    {decision:'APROBAR',evidenciaConfirmada:true});
  assert.equal(cross.status,403,'Tenant cruzado HTTP');
  const reviewed=await post('alfa-reviewer',`${path}/${proposalId}/revision`,
    {decision:'APROBAR',evidenciaConfirmada:true,motivo:'Evidencia ficticia verificada'});
  assert.equal(reviewed.status,200,`Revisión HTTP: ${reviewed.data.code??'sin código'}`);
  assert.equal(reviewed.data.estado,'PUBLICADA_VERIFICADA');
  const publicRow=(await admin.query('SELECT direccion_texto FROM f03.farmacia_publica WHERE farmacia_id=$1',[pharmacy])).rows[0];
  assert.equal(publicRow.direccion_texto,body.direccionPublicable);
  console.log('F07 TEST HTTP: propuesta 201, autoaprobación 403, tenant cruzado 403, revisión 200 y publicación verificadas.');
} finally {
  await admin.query(`UPDATE f03.farmacia_publica SET direccion_texto=$2,ciudad=$3,latitud=$4,longitud=$5,
    precision_m=$6,fuente=$7,estado_ubicacion=$8,propuesta_por=$9,revisada_por=$10,
    fecha_verificacion=$11,updated_at=$12,public_version=$13 WHERE farmacia_id=$1`,
    [pharmacy,oldPublic.direccion_texto,oldPublic.ciudad,oldPublic.latitud,oldPublic.longitud,
      oldPublic.precision_m,oldPublic.fuente,oldPublic.estado_ubicacion,oldPublic.propuesta_por,
      oldPublic.revisada_por,oldPublic.fecha_verificacion,oldPublic.updated_at,oldPublic.public_version]);
  if(proposalId){
    await admin.query('DELETE FROM f07.ubicacion_auditoria WHERE propuesta_id=$1',[proposalId]);
    await admin.query('DELETE FROM f07.ubicacion_propuesta WHERE id=$1',[proposalId]);
  }
  await admin.end();
}
