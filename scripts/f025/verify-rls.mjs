/** Transactional, synthetic F02.5 RLS checks. All fixtures are rolled back. */
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { Client } from 'pg';
import { assertF025EphemeralDatabase, assertF025ConnectedTarget } from './test-env.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const local = path.join(root, '.cache/f025-docker');
const database = JSON.parse(readFileSync(path.join(local, 'state.local.json'), 'utf8')).database;
const secret = readFileSync(path.join(local, 'postgres-password.txt'), 'utf8').trim();
const url = new URL(`postgresql://127.0.0.1:55431/${database}`);
url.username = 'f01_migrator';
url.password = secret;
assertF025EphemeralDatabase(url.toString(), { migration: true });
const client = new Client({ connectionString: url.toString() });
const fingerprint = () => randomBytes(32).toString('hex');
const results = [];
const expectCount = async (name, sql, count, values = []) => {
  const actual = Number((await client.query(sql, values)).rows[0].count);
  results.push({ name, passed: actual === count, expected: count, actual });
};
const expectAffected = async (name, sql, values, expected) => {
  const actual = (await client.query(sql, values)).rowCount;
  results.push({ name, passed: actual === expected, expected, actual });
};
const expectDenied = async (name, sql, values = []) => {
  await client.query('SAVEPOINT expected_denial');
  try {
    await client.query(sql, values);
    assert.fail(`${name}: operación permitida indebidamente`);
  } catch (error) {
    if (error?.code === 'ERR_ASSERTION') throw error;
    assert.ok(['42501', '28000'].includes(error.code), `${name}: error inesperado ${error.code}`);
    results.push({ name, passed: true });
  } finally {
    await client.query('ROLLBACK TO SAVEPOINT expected_denial');
    await client.query('RELEASE SAVEPOINT expected_denial');
  }
};

await client.connect();
try {
  await assertF025ConnectedTarget(client, database);
  await client.query('BEGIN');
  const marker = randomBytes(5).toString('hex');
  const users = {};
  for (const key of ['alfa', 'beta', 'admin']) {
    users[key] = (await client.query(`INSERT INTO f01.usuario(email_canonico,password_hash)
      VALUES($1,'$argon2id$synthetic-fixture-only') RETURNING id`, [`f025-${marker}-${key}@example.invalid`])).rows[0].id;
    users[`${key}Fingerprint`] = fingerprint();
    await client.query(`INSERT INTO f01.sesion(usuario_id,token_fingerprint,idle_expires_at,absolute_expires_at)
      VALUES($1,decode($2,'hex'),now()+interval '1 hour',now()+interval '1 day')`,
    [users[key], users[`${key}Fingerprint`]]);
  }
  const pharmacies = {};
  for (const key of ['alfa', 'beta']) {
    pharmacies[key] = (await client.query('INSERT INTO f01.farmacia_referencia(nombre_publico) VALUES($1) RETURNING id',
      [`Farmacia ${key} TEST ${marker}`])).rows[0].id;
    const member = (await client.query(`INSERT INTO f01.usuario_farmacia(usuario_id,farmacia_id,rol)
      VALUES($1,$2,'DUENO') RETURNING id`, [users[key], pharmacies[key]])).rows[0].id;
    await client.query(`INSERT INTO f01.delegacion(membresia_id,farmacia_id,capacidad,granted_by_usuario_id)
      VALUES($1,$2,'inventory.read',$3)`, [member, pharmacies[key], users[key]]);
    await client.query(`INSERT INTO f01.delegacion(membresia_id,farmacia_id,capacidad,granted_by_usuario_id)
      VALUES($1,$2,'GEO_LOCATION_PROPOSE',$3)`, [member, pharmacies[key], users[key]]);
    for (const capability of ['pharmacy.profile.read', 'pharmacy.profile.write']) {
      await client.query(`INSERT INTO f01.delegacion(membresia_id,farmacia_id,capacidad,granted_by_usuario_id)
        VALUES($1,$2,$3,$4)`, [member, pharmacies[key], capability, users[key]]);
    }
    await client.query(`INSERT INTO f025.farmacia_perfil(farmacia_id,contacto,direccion,departamento,provincia,distrito)
      VALUES($1,'Contacto TEST','Dirección TEST','Lima','Lima','Lima')`, [pharmacies[key]]);
    await client.query(`INSERT INTO f03.farmacia_publica(farmacia_id,direccion_texto)
      VALUES($1,'Dirección pública ficticia TEST')`, [pharmacies[key]]);
    await client.query(`INSERT INTO f07.ubicacion_propuesta(farmacia_id,direccion_publicable,ciudad,
      latitud,longitud,fuente,propuesta_por)
      VALUES($1,'Dirección de propuesta ficticia','lima',-12.04,-77.03,'TEST',$2)`,
    [pharmacies[key], users[key]]);
  }
  const med = (await client.query(`INSERT INTO f02.medicamento(nombre,principio_activo,concentracion,presentacion,clasificacion)
    VALUES($1,'principio ficticio','test','test','test') RETURNING id`, [`f025 test ${marker}`])).rows[0].id;
  const applications = {};
  const documents = {};
  for (const key of ['alfa', 'beta']) {
    await client.query(`INSERT INTO f02.inventario(farmacia_id,medicamento_id,precio_centavos,cantidad_fisica,ultima_revision_at)
      VALUES($1,$2,100,1,now())`, [pharmacies[key], med]);
    applications[key] = (await client.query(`INSERT INTO f025.solicitud(solicitante_id,nombre_comercial,contacto,direccion,
      departamento,provincia,distrito,representante)
      VALUES($1,$2,'Contacto TEST','Dirección TEST','Lima','Lima','Lima','Representante TEST')
      RETURNING id`, [users[key], `Solicitud ${key} TEST ${marker}`])).rows[0].id;
    documents[key] = (await client.query(`INSERT INTO f025.documento(solicitud_id,tipo,storage_key,tamano_bytes,sha256_hex,expires_at)
      VALUES($1,'image/png',$2,1,$3,now()+interval '1 day') RETURNING id`,
    [applications[key], randomBytes(20).toString('hex'), randomBytes(32).toString('hex')])).rows[0].id;
  }
  // This is an uncommitted fixture: a platform role without F02.5 grants must remain denied.
  const approval = randomUUID();
  await client.query(`INSERT INTO f01.privileged_approval(id,operation,target_usuario_id,role_code,reason,
    expires_at,integrity_hash) VALUES($1,'INITIAL_PLATFORM_ADMIN',$2,'ADMINISTRADOR_PLATAFORMA',
    'Fixture sintético TEST',now()+interval '1 hour',$3)`, [approval, users.admin, 'a'.repeat(64)]);
  await client.query(`INSERT INTO f01.platform_role_assignment(usuario_id,role_code,approval_id)
    VALUES($1,'ADMINISTRADOR_PLATAFORMA',$2)`, [users.admin, approval]);

  await client.query('SET LOCAL ROLE f01_runtime');
  const actor = async (key, pharmacy) => {
    await client.query("SELECT set_config('app.actor_user_id',$1,true)", [users[key]]);
    await client.query("SELECT set_config('app.session_fingerprint',$1,true)", [users[`${key}Fingerprint`]]);
    await client.query("SELECT set_config('app.farmacia_id',$1,true)", [pharmacy ?? '']);
  };
  await actor('alfa', pharmacies.alfa);
  await expectCount('Alfa ve solo su solicitud', 'SELECT count(*) FROM f025.solicitud', 1);
  await expectCount('Alfa ve solo su membresía', 'SELECT count(*) FROM f01.usuario_farmacia', 1);
  await expectCount('Alfa ve solo su propuesta de ubicación', 'SELECT count(*) FROM f07.ubicacion_propuesta', 1);
  await expectDenied('Runtime no lee tabla de documentos directamente', 'SELECT count(*) FROM f025.documento');
  await expectDenied('Alfa no lee documento Beta mediante función estrecha',
    'SELECT * FROM f025.read_test_document($1,$2)', [applications.beta, documents.beta]);
  await expectCount('Alfa ve solo su inventario', 'SELECT count(*) FROM f02.inventario', 1);
  await expectCount('Alfa ve solo su perfil', 'SELECT count(*) FROM f025.farmacia_perfil', 1);
  await expectDenied('Alfa no crea solicitud de Beta', `INSERT INTO f025.solicitud(solicitante_id,
    nombre_comercial,contacto,direccion,departamento,provincia,distrito,representante)
    VALUES($1,'Suplantación TEST','Contacto TEST','Dirección TEST','Lima','Lima','Lima','Representante TEST')`, [users.beta]);
  await expectDenied('Alfa no cambia estado directamente',
    "UPDATE f025.solicitud SET estado='APROBADA' WHERE solicitante_id=$1", [users.alfa]);
  await client.query("SELECT set_config('app.farmacia_id',$1,true)", [pharmacies.beta]);
  await expectCount('ID Beta no concede propuesta de ubicación',
    'SELECT count(*) FROM f07.ubicacion_propuesta WHERE farmacia_id=$1', 0, [pharmacies.beta]);
  await expectAffected('Alfa no modifica propuesta de ubicación de Beta',
    `UPDATE f07.ubicacion_propuesta SET estado='RECHAZADA',revisada_por=$1,
      revisada_at=now(),version=version+1 WHERE farmacia_id=$2`, [users.alfa, pharmacies.beta], 0);
  await expectDenied('ID Beta no concede documento',
    'SELECT * FROM f025.read_test_document($1,$2)', [applications.beta, documents.beta]);
  await expectCount('Identificador Beta no concede inventario', 'SELECT count(*) FROM f02.inventario', 0);
  await expectAffected('Alfa no modifica precio de Beta',
    'UPDATE f02.inventario SET precio_centavos=precio_centavos+1 WHERE farmacia_id=$1',
    [pharmacies.beta], 0);
  await expectCount('Identificador Beta no concede perfil', 'SELECT count(*) FROM f025.farmacia_perfil', 0);
  await actor('beta', pharmacies.beta);
  await expectCount('Beta ve solo su solicitud', 'SELECT count(*) FROM f025.solicitud', 1);
  await expectCount('Beta ve solo su propuesta de ubicación', 'SELECT count(*) FROM f07.ubicacion_propuesta', 1);
  await expectDenied('Beta no lee documento Alfa mediante función estrecha',
    'SELECT * FROM f025.read_test_document($1,$2)', [applications.alfa, documents.alfa]);
  await expectCount('Beta ve solo su inventario', 'SELECT count(*) FROM f02.inventario', 1);
  await actor('admin', pharmacies.alfa);
  await expectCount('Admin global sin membresía no ve inventario Alfa', 'SELECT count(*) FROM f02.inventario', 0);
  await expectAffected('Admin global no modifica precio de Alfa',
    'UPDATE f02.inventario SET precio_centavos=precio_centavos+1 WHERE farmacia_id=$1',
    [pharmacies.alfa], 0);
  await expectCount('Admin global sin membresía no ve perfil Alfa', 'SELECT count(*) FROM f025.farmacia_perfil', 0);
  await expectCount('Admin global sin membresía no ve ubicación privada', 'SELECT count(*) FROM f07.ubicacion_propuesta', 0);
  assert.equal((await client.query("SELECT f025.has_capability('F025_APPLICATION_READ') AS allowed")).rows[0].allowed, false);
  results.push({ name: 'Rol global sin grant F02.5 no consulta solicitudes', passed: true });
  await expectCount('Admin global sin grant F02.5 no ve solicitudes', 'SELECT count(*) FROM f025.solicitud', 0);
  await expectDenied('Admin global sin grant documental no ve documentos',
    'SELECT * FROM f025.read_test_document($1,$2)', [applications.alfa, documents.alfa]);
  const idempotencyKey = `f025-test-${randomBytes(12).toString('hex')}`;
  const correlation = randomUUID();
  await expectDenied('Admin global sin grants no activa farmacia',
    'SELECT * FROM f025.activate_application($1,1,$2,$3,$4)',
    [applications.alfa, idempotencyKey, 'Aprobación sintética TEST', correlation]);
  await client.query('SET LOCAL ROLE f01_migrator');
  await client.query("UPDATE f025.solicitud SET estado='EN_REVISION' WHERE id=$1", [applications.alfa]);
  for (const capability of ['F025_APPLICATION_READ', 'F025_APPLICATION_DECIDE', 'F025_PHARMACY_ACTIVATE']) {
    await client.query(`INSERT INTO f025.platform_capability_grant(actor_id,capability_code,approval_id,
      approval_sha256,reason) VALUES($1,$2,$3,$4,$5)`,
    [users.admin, capability, randomUUID(), 'b'.repeat(64), 'Fixture sintético TEST']);
  }
  await client.query('SET LOCAL ROLE f01_runtime');
  await expectCount('Runtime no lista solicitudes directamente aunque tenga grant',
    'SELECT count(*) FROM f025.solicitud', 0);
  await expectCount('Revisor TEST sigue sin inventario Alfa', 'SELECT count(*) FROM f02.inventario', 0);
  const activation = await client.query('SELECT * FROM f025.activate_application($1,1,$2,$3,$4)',
    [applications.alfa, idempotencyKey, 'Aprobación sintética TEST', correlation]);
  assert.equal(activation.rows.length, 1);
  const replay = await client.query('SELECT * FROM f025.activate_application($1,1,$2,$3,$4)',
    [applications.alfa, idempotencyKey, 'Aprobación sintética TEST', correlation]);
  assert.deepEqual(replay.rows, activation.rows);
  results.push({ name: 'Activación TEST idempotente con dos capacidades', passed: true });
  await client.query('SET LOCAL ROLE f01_migrator');
  await expectCount('Una sola activación creada',
    `SELECT count(*) FROM f025.activacion WHERE solicitud_id='${applications.alfa}'`, 1);
  await expectCount('Membresía DUENO de la activación válida',
    `SELECT count(*) FROM f025.activacion a JOIN f01.usuario_farmacia m
      ON m.id=a.membresia_dueno_id WHERE a.solicitud_id='${applications.alfa}'
      AND m.usuario_id='${users.alfa}' AND m.farmacia_id=a.farmacia_id AND m.rol='DUENO'`, 1);
  await expectCount('Un solo evento Outbox de activación',
    `SELECT count(*) FROM f025.outbox_evento WHERE solicitud_id='${applications.alfa}'`, 1);
  await client.query('SET LOCAL ROLE f01_runtime');
  await client.query("SELECT set_config('app.session_fingerprint',$1,true)", [fingerprint()]);
  await expectCount('Sesión discordante niega solicitudes', 'SELECT count(*) FROM f025.solicitud', 0);
  await expectCount('Sesión discordante niega inventario', 'SELECT count(*) FROM f02.inventario', 0);
  await client.query("SELECT set_config('app.actor_user_id','',true)");
  await client.query("SELECT set_config('app.session_fingerprint','',true)");
  await expectCount('Sin contexto no hay solicitudes', 'SELECT count(*) FROM f025.solicitud', 0);
  await expectCount('Sin contexto no hay ubicación privada', 'SELECT count(*) FROM f07.ubicacion_propuesta', 0);
  await expectDenied('Sin contexto no hay documentos',
    'SELECT * FROM f025.read_test_document($1,$2)', [applications.alfa, documents.alfa]);
  await expectCount('Sin contexto no hay inventario', 'SELECT count(*) FROM f02.inventario', 0);
  await expectDenied('Runtime no lee grants de plataforma', 'SELECT * FROM f025.platform_capability_grant');
  await expectDenied('Runtime no inserta membresías de otra farmacia', `INSERT INTO f01.usuario_farmacia(usuario_id,farmacia_id,rol)
    VALUES($1,$2,'DUENO')`, [users.alfa, pharmacies.beta]);
  await client.query('SET LOCAL ROLE f025_activation_executor');
  await expectDenied('Ejecutor de activación no lee documentos privados',
    'SELECT count(*) FROM f025.documento');
  await expectDenied('Ejecutor de activación no ejecuta lectura de documentos',
    'SELECT * FROM f025.read_test_document($1,$2)', [applications.alfa, documents.alfa]);
  await client.query('SET LOCAL ROLE f01_runtime');
  const beforeInactive = await client.query('SELECT * FROM f03.search_public_offers($1,NULL,NULL,20)', [`f025 test ${marker}`]);
  assert.equal(beforeInactive.rows.length, 2);
  results.push({ name: 'Proyección pública muestra dos ofertas activas sin contexto privado', passed: true });
  await client.query('SET LOCAL ROLE f01_migrator');
  await client.query("UPDATE f01.farmacia_referencia SET estado='INACTIVA' WHERE id=$1", [pharmacies.beta]);
  await client.query('SET LOCAL ROLE f01_runtime');
  const afterInactive = await client.query('SELECT * FROM f03.search_public_offers($1,NULL,NULL,20)', [`f025 test ${marker}`]);
  assert.equal(afterInactive.rows.length, 1);
  assert.equal(afterInactive.rows[0].farmacia_id, pharmacies.alfa);
  assert(!Object.keys(afterInactive.rows[0]).some(key => /cantidad|comprometida|contacto|solicitante/i.test(key)));
  results.push({ name: 'Farmacia inactiva excluida y proyección sin datos privados', passed: true });
  await expectCount('Farmacia inactiva no aparece en detalle público',
    'SELECT count(*) FROM f03.get_public_pharmacy($1)', 0, [pharmacies.beta]);
  console.log(JSON.stringify({ cluster: 'farmafind-f025-test', database, checks: results,
    total: results.length, passed: results.filter(result => result.passed).length }, null, 2));
  if (results.some(result => !result.passed)) process.exitCode = 1;
} finally {
  await client.query('ROLLBACK');
  await client.end();
}
