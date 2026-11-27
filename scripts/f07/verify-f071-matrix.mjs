/** F07.1 T013/T014: matriz RLS de la revisión de plataforma y del horario (casos 1–20 y 22 de
 *  specs/021-f071-mi-farmacia/sql-review/README.md). Solo en la base TEST efímera técnica F02.5
 *  (.cache/f025-docker/state.local.json); todos los datos se crean en una transacción que se revierte.
 *  Una sola conexión para todos los actores (Alfa → Beta con GUC limpiados, caso 20). */
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { Client } from 'pg';
import { assertF025EphemeralDatabase, assertF025ConnectedTarget } from '../f025/test-env.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const local = path.join(root, '.cache/f025-docker');
const database = JSON.parse(readFileSync(path.join(local, 'state.local.json'), 'utf8')).database;
for (const forbidden of ['farmafind_f01_test', 'farmafind_f01_test_d0570879cf41']) assert.notEqual(database, forbidden);
const secret = readFileSync(path.join(local, 'postgres-password.txt'), 'utf8').trim();
const url = new URL(`postgresql://127.0.0.1:55431/${database}`); url.username = 'f01_migrator'; url.password = secret;
assertF025EphemeralDatabase(url.toString(), { migration: true });
const client = new Client({ connectionString: url.toString() });
await client.connect();
const results = {}; let passed = 0;
const ok = (name, condition) => { assert.ok(condition, name); results[name] = 'OK'; passed++; };
const q = async (sql, values = []) => (await client.query(sql, values)).rows;
/** Ejecuta en un SAVEPOINT; devuelve filas o el código de error (la transacción sigue viva). */
async function attempt(sql, values = []) {
  await client.query('SAVEPOINT m');
  try { const rows = await q(sql, values); await client.query('RELEASE SAVEPOINT m'); return { rows }; }
  catch (error) { await client.query('ROLLBACK TO SAVEPOINT m'); return { code: error.code }; }
}
const denied = r => (r.code !== undefined) || r.rows.length === 0;

try {
  await assertF025ConnectedTarget(client, database);
  await client.query('BEGIN');
  const migrator = () => client.query('SET LOCAL ROLE f01_migrator');
  const user = async key => {
    const id = (await q(`INSERT INTO f01.usuario(email_canonico,password_hash) VALUES($1,'$argon2id$matriz-sintetica') RETURNING id`,
      [`m071-${key}-${randomBytes(4).toString('hex')}@example.invalid`]))[0].id;
    const fingerprint = randomBytes(32).toString('hex');
    await q(`INSERT INTO f01.sesion(usuario_id,token_fingerprint,idle_expires_at,absolute_expires_at)
      VALUES($1,decode($2,'hex'),now()+interval '10 minutes',now()+interval '10 minutes')`, [id, fingerprint]);
    return { id, fingerprint, key };
  };
  const admin = async (key, grant) => {
    const u = await user(key); const approval = randomUUID();
    await q(`INSERT INTO f01.privileged_approval(id,operation,target_usuario_id,role_code,reason,expires_at,integrity_hash)
      VALUES($1,'INITIAL_PLATFORM_ADMIN',$2,'ADMINISTRADOR_PLATAFORMA','Matriz F07.1 TEST',now()+interval '1 hour',$3)`, [approval, u.id, 'a'.repeat(64)]);
    await q(`INSERT INTO f01.platform_role_assignment(usuario_id,role_code,approval_id) VALUES($1,'ADMINISTRADOR_PLATAFORMA',$2)`, [u.id, approval]);
    if (grant) await q(`INSERT INTO f07.platform_location_grant(actor_id,approval_id,approval_sha256,reason)
      VALUES($1,$2,$3,'Matriz F07.1 TEST')`, [u.id, randomUUID(), 'c'.repeat(64)]);
    return u;
  };
  const pharmacy = async name => {
    const id = (await q(`INSERT INTO f01.farmacia_referencia(nombre_publico) VALUES($1) RETURNING id`, [name]))[0].id;
    await q(`INSERT INTO f03.farmacia_publica(farmacia_id,direccion_texto) VALUES($1,'Dirección inicial TEST')`, [id]);
    return id;
  };
  const member = async (u, f, rol, caps = []) => {
    const m = (await q(`INSERT INTO f01.usuario_farmacia(usuario_id,farmacia_id,rol) VALUES($1,$2,$3) RETURNING id`, [u.id, f, rol]))[0].id;
    for (const c of caps) await q(`INSERT INTO f01.delegacion(membresia_id,farmacia_id,capacidad,granted_by_usuario_id)
      VALUES($1,$2,$3,$4)`, [m, f, c, u.id]);
    return m;
  };
  const R = await admin('r', true), R2 = await admin('r2', true), RF = await admin('rf', false);
  const DA = await user('da'), DB = await user('db'), T = await user('t'), C = await user('c');
  const alfa = await pharmacy('Alfa Matriz F071'), beta = await pharmacy('Beta Matriz F071'), gamma = await pharmacy('Gamma Inactiva F071');
  await q(`UPDATE f01.farmacia_referencia SET estado='INACTIVA' WHERE id=$1`, [gamma]);
  const ownerCaps = ['GEO_LOCATION_PROPOSE', 'pharmacy.profile.read', 'pharmacy.profile.write', 'inventory.read'];
  await member(DA, alfa, 'DUENO', ownerCaps); await member(DB, beta, 'DUENO', ownerCaps);
  await member(T, alfa, 'TRABAJADOR', ['inventory.read']); await member(R2, alfa, 'TRABAJADOR');
  // Datos privados de Alfa y Beta que el revisor nunca debe ver.
  const med = (await q(`INSERT INTO f02.medicamento(nombre,principio_activo,concentracion,presentacion,clasificacion)
    VALUES('medicamento matriz f071','principio ficticio','10 mg','tabletas','venta libre') RETURNING id`))[0].id;
  for (const f of [alfa, beta]) await q(`INSERT INTO f02.inventario(farmacia_id,medicamento_id,precio_centavos,cantidad_fisica,cantidad_comprometida,ultima_revision_at)
    VALUES($1,$2,500,10,0,now())`, [f, med]);
  for (const [f, by] of [[alfa, DA], [gamma, DA]]) for (let dia = 1; dia <= 7; dia++)
    await q(`INSERT INTO f07.horario_atencion(farmacia_id,dia,cerrado,abre,cierra,version,actualizado_por) VALUES($1,$2,false,'08:00','20:00',1,$3)`, [f, dia, by.id]);
  const propose = async (f, by, at, lat = -12.05) => (await q(`INSERT INTO f07.ubicacion_propuesta(farmacia_id,direccion_publicable,ciudad,latitud,longitud,
    fuente,propuesta_por,propuesta_at,base_public_version) VALUES($1,'Jr. Matriz 1','lima',$4,-77.04,'Punto marcado en el mapa',$2,$3,
    (SELECT public_version FROM f03.farmacia_publica WHERE farmacia_id=$1)) RETURNING id`, [f, by.id, at, lat]))[0].id;
  const aOld = await propose(alfa, DA, '2026-11-20T10:00:00Z'), aNew = await propose(alfa, DA, '2026-11-21T10:00:00Z');
  const bNew = await propose(beta, DB, '2026-11-22T10:00:00Z');

  const as = async (u, farmacia = '') => {
    await migrator();
    await client.query("SELECT set_config('app.actor_user_id',$1,true)", [u.id]);
    await client.query("SELECT set_config('app.session_fingerprint',$1,true)", [u.fingerprint]);
    await client.query("SELECT set_config('app.farmacia_id',$1,true)", [farmacia]);
    await client.query('SET LOCAL ROLE f01_runtime');
  };
  const pending = async ids => (await q(`SELECT id FROM f07.ubicacion_propuesta WHERE estado='PENDIENTE' AND farmacia_id = ANY($1)`, [ids])).map(r => String(r.id));
  const decide = (id, f, by, status, version = 1) => attempt(`UPDATE f07.ubicacion_propuesta SET estado=$4,revisada_por=$3,revisada_at=now(),version=version+1
    WHERE id=$1 AND farmacia_id=$2 AND estado='PENDIENTE' AND version=$5 RETURNING *`, [id, f, by.id, status, version]);
  const publish = (p, baseVersion) => attempt(`UPDATE f03.farmacia_publica SET direccion_texto=$2,ciudad=$3,latitud=$4,longitud=$5,precision_m=$6,fuente=$7,
    estado_ubicacion='PUBLICADA_VERIFICADA',propuesta_por=$8,revisada_por=$9,fecha_verificacion=now(),updated_at=now(),public_version=public_version+1
    WHERE farmacia_id=$1 AND public_version=$10 RETURNING public_version`,
    [p.farmacia_id, p.direccion_publicable, p.ciudad, p.latitud, p.longitud, p.precision_m, p.fuente, p.propuesta_por, p.revisada_por, baseVersion]);
  const audit = (f, id, by, accion, motivo) => attempt(`INSERT INTO f07.ubicacion_auditoria(farmacia_id,propuesta_id,actor_usuario_id,accion,evidencia_confirmada,motivo)
    VALUES($1,$2,$3,$4,$5,$6) RETURNING id`, [f, id, by.id, accion, accion === 'APROBACION', motivo]);
  const count = async sql => { const r = await attempt(sql); return r.code ? 'denegado' : Number(r.rows[0].n); };

  // 1 · R ve la última y las demás pendientes de Alfa y Beta, solo columnas públicas (22 lo detalla).
  await as(R);
  ok('1 R lista pendientes de Alfa y Beta', (await pending([alfa, beta])).sort().join() === [aOld, aNew, bNew].map(String).sort().join());
  // 2–6 · Nada privado.
  for (const [name, sql] of [
    ['2 inventario', 'SELECT count(*) n FROM f02.inventario'], ['2 movimiento', 'SELECT count(*) n FROM f02.movimiento'],
    ['2 importacion', 'SELECT count(*) n FROM f02.importacion'], ['3 reserva', 'SELECT count(*) n FROM f04.reserva'],
    ['4 usuario_farmacia ajenas', `SELECT count(*) n FROM f01.usuario_farmacia WHERE usuario_id<>'${R.id}'`],
    ['4 delegacion', 'SELECT count(*) n FROM f01.delegacion'], ['4 invitacion_personal', 'SELECT count(*) n FROM f01.invitacion_personal'],
    ['4 credencial_temporal', 'SELECT count(*) n FROM f01.credencial_temporal'],
    ['5 farmacia_perfil', 'SELECT count(*) n FROM f025.farmacia_perfil'], ['5 documento', 'SELECT count(*) n FROM f025.documento'],
    ['6 horario privado', 'SELECT count(*) n FROM f07.horario_atencion']]) {
    const n = await count(sql); ok(`${name}: R no lee nada`, n === 0 || n === 'denegado');
  }
  const f04 = await attempt(`SELECT f04.can_reservation_action($1,'reservation.read') AS allowed`, [beta]);
  ok('3 funciones F04 denegadas a R', f04.code !== undefined || f04.rows[0].allowed === false);
  // 22 · Columnas visibles para R.
  const propCols = Object.keys((await q('SELECT * FROM f07.ubicacion_propuesta WHERE id=$1', [bNew]))[0]).sort().join();
  ok('22 columnas de la propuesta', propCols === ['id', 'farmacia_id', 'version', 'direccion_publicable', 'ciudad', 'latitud', 'longitud', 'precision_m', 'fuente',
    'evidencia_referencia', 'estado', 'propuesta_por', 'propuesta_at', 'revisada_por', 'revisada_at', 'base_public_version'].sort().join());
  const pubCols = Object.keys((await q('SELECT * FROM f03.farmacia_publica WHERE farmacia_id=$1', [beta]))[0]).sort().join();
  ok('22 columnas de la proyección', pubCols === ['farmacia_id', 'direccion_texto', 'latitud', 'longitud', 'updated_at', 'ciudad', 'precision_m', 'fuente',
    'estado_ubicacion', 'propuesta_por', 'revisada_por', 'fecha_verificacion', 'public_version'].sort().join());

  // 8 · Pendiente que ya no es la última.
  ok('8 no decide la pendiente antigua de Alfa', denied(await decide(aOld, alfa, R, 'RECHAZADA')));
  // 7 · Aprueba la última de Beta: publicada, auditoría y versión pública +1.
  const before = Number((await q('SELECT public_version FROM f03.farmacia_publica WHERE farmacia_id=$1', [beta]))[0].public_version);
  const decided = await decide(bNew, beta, R, 'PUBLICADA_VERIFICADA');
  ok('7 decide la última de Beta', decided.rows?.length === 1);
  // 9 · Versión pública obsoleta: no publica (luego se publica con la correcta).
  ok('9 publicación con versión obsoleta falla', denied(await publish(decided.rows[0], before - 1)));
  const published = await publish(decided.rows[0], before);
  ok('7 publica con versión +1', Number(published.rows?.[0]?.public_version) === before + 1);
  ok('7 auditoría APROBACION', (await audit(beta, bNew, R, 'APROBACION', 'Coincide (matriz)')).rows?.length === 1);
  // 10 · R2 (miembro de Alfa) no ve ni decide Alfa; sí Beta.
  await migrator(); const b2 = await propose(beta, DB, '2026-11-23T10:00:00Z');
  await as(R2);
  ok('10 R2 no ve Alfa', (await pending([alfa])).length === 0);
  ok('10 R2 no decide Alfa', denied(await decide(aNew, alfa, R2, 'RECHAZADA')));
  ok('10 R2 sí ve Beta', (await pending([beta])).includes(String(b2)));
  // 15 · Rechazo por R2 en Beta: lo publicado no cambia; auditoría RECHAZO con motivo.
  await migrator(); const pubBefore = JSON.stringify((await q('SELECT direccion_texto,public_version FROM f03.farmacia_publica WHERE farmacia_id=$1', [beta]))[0]);
  await as(R2);
  ok('15 R2 rechaza la última de Beta', (await decide(b2, beta, R2, 'RECHAZADA')).rows?.length === 1);
  ok('15 auditoría RECHAZO con motivo', (await audit(beta, b2, R2, 'RECHAZO', 'Punto en otra cuadra (matriz)')).rows?.length === 1);
  await migrator();
  ok('15 lo publicado no cambia', JSON.stringify((await q('SELECT direccion_texto,public_version FROM f03.farmacia_publica WHERE farmacia_id=$1', [beta]))[0]) === pubBefore);
  ok('15 motivo guardado', (await q(`SELECT motivo FROM f07.ubicacion_auditoria WHERE propuesta_id=$1 AND accion='RECHAZO'`, [b2]))[0]?.motivo === 'Punto en otra cuadra (matriz)');
  // 11 · Autoaprobación: R como autor de una propuesta de Beta.
  const own = await propose(beta, R, '2026-11-24T10:00:00Z');
  await as(R);
  ok('11 R no aprueba su propia propuesta', denied(await decide(own, beta, R, 'PUBLICADA_VERIFICADA')));
  // 12 · RF sin concesión.
  await as(RF);
  ok('12 RF no lista', (await pending([alfa, beta])).length === 0);
  ok('12 RF no decide', denied(await decide(own, beta, RF, 'RECHAZADA')));
  // 13 · Dueño, trabajador y cliente por la vía de plataforma (farmacia ajena).
  for (const [name, u, f] of [['DA en Beta', DA, beta], ['T en Beta', T, beta], ['C en Alfa', C, alfa]]) {
    await as(u);
    ok(`13 ${name}: 0 filas`, (await pending([f])).length === 0 && denied(await decide(own, beta, u, 'RECHAZADA')));
  }
  // 16 · Fuera del Perú.
  await migrator();
  const outside = await attempt(`INSERT INTO f07.ubicacion_propuesta(farmacia_id,direccion_publicable,ciudad,latitud,longitud,fuente,propuesta_por)
    VALUES($1,'Fuera','madrid',40.4,-3.7,'Punto marcado en el mapa',$2) RETURNING id`, [alfa, DA.id]);
  ok('16 propuesta fuera del Perú rechazada', outside.code === '23514');
  // 17 · Horario: DA escribe Alfa; T y DB no.
  const setHours = (u, f) => attempt(`UPDATE f07.horario_atencion SET abre='09:00',version=version+1,actualizado_por=$2,actualizado_at=now()
    WHERE farmacia_id=$1 AND dia=1 RETURNING dia`, [f, u.id]);
  await as(DA, alfa); ok('17 DA guarda el horario de Alfa', (await setHours(DA, alfa)).rows?.length === 1);
  await as(T, alfa); ok('17 T no escribe el horario de Alfa', denied(await setHours(T, alfa)));
  await as(DB, alfa); ok('17 DB no escribe el horario de Alfa (contexto Alfa)', denied(await setHours(DB, alfa)));
  await as(DB, beta); ok('17 DB no escribe el horario de Alfa (contexto Beta)', denied(await setHours(DB, alfa)));
  // 20 · Misma conexión Alfa → Beta: DB en Beta no lee el horario de Alfa.
  ok('20 Alfa → Beta sin filtración del horario', (await count(`SELECT count(*) n FROM f07.horario_atencion WHERE farmacia_id='${alfa}'`)) === 0);
  // 18 · Tramos inválidos.
  await migrator();
  for (const [name, sql] of [['cierre <= apertura', `UPDATE f07.horario_atencion SET abre='20:00',cierra='08:00' WHERE farmacia_id='${alfa}' AND dia=2`],
    ['Cerrado con horas', `UPDATE f07.horario_atencion SET cerrado=true WHERE farmacia_id='${alfa}' AND dia=3`]])
    ok(`18 ${name} rechazado`, (await attempt(sql)).code === '23514');
  // 19 · Horario público: activa sí; inactiva no; más de 50 ids no.
  await client.query("SELECT set_config('app.actor_user_id','',true), set_config('app.session_fingerprint','',true), set_config('app.farmacia_id','',true)");
  await client.query('SET LOCAL ROLE f01_runtime');
  ok('19 horario público de Alfa activa', (await q('SELECT * FROM f07.public_opening_hours($1)', [[alfa]])).length === 7);
  ok('19 farmacia INACTIVA: 0 filas', (await q('SELECT * FROM f07.public_opening_hours($1)', [[gamma]])).length === 0);
  ok('19 más de 50 ids: 0 filas', (await q('SELECT * FROM f07.public_opening_hours($1)', [[alfa, ...Array.from({ length: 50 }, () => randomUUID())]])).length === 0);
  // 14 · Concesión revocada y sesión cerrada.
  await migrator(); const late = await propose(beta, DB, '2026-11-25T10:00:00Z');
  await q(`UPDATE f01.sesion SET estado='REVOCADA' WHERE usuario_id=$1`, [R2.id]);
  await as(R2); ok('14 sesión cerrada: R2 no ve nada', (await pending([beta])).length === 0);
  await migrator(); await q(`UPDATE f07.platform_location_grant SET estado='REVOCADA',revoked_at=now() WHERE actor_id=$1`, [R.id]);
  await as(R); ok('14 concesión revocada: R no ve ni decide', (await pending([beta])).length === 0 && denied(await decide(late, beta, R, 'RECHAZADA')));
  console.log(JSON.stringify({ cluster: 'farmafind-f025-test', database, passed, results, rolledBack: true }, null, 1));
} finally { await client.query('ROLLBACK').catch(() => undefined); await client.end(); }
