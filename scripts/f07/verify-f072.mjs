/** F07.2 T011: «Reemplazada», envío único y RLS con PostgreSQL real. Crea una base TEST efímera y marcada en el
 *  clúster de pruebas (127.0.0.1:55431), aplica todas las migraciones, usa usuarios y farmacias ficticios, y BORRA la
 *  base al final (también si falla). Nunca farmafind_f01_test ni la DEMO. Requiere `npm --prefix backend run build`. */
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { migrateTestDatabase } from '../../backend/dist/modules/usuarios/infrastructure/db/migrate.js';
import { migrateF02TestDatabase } from '../../backend/dist/modules/inventario/infrastructure/migrate.js';
import { migrateF03TestDatabase, migrateF07TestDatabase } from '../../backend/dist/modules/busqueda/infrastructure/migrate.js';
import { migrateF04TestDatabase } from '../../backend/dist/modules/reservas/infrastructure/migrate.js';
import { migrateF05TestDatabase } from '../../backend/dist/modules/notificaciones/infrastructure/migrate.js';
import { migrateF025TestDatabase } from '../../backend/dist/modules/farmacias/infrastructure/migrate-f025.js';
import { ManagePharmacyLocation } from '../../backend/dist/modules/farmacias/application/manage-pharmacy-location.js';
import { PlatformLocationReview } from '../../backend/dist/modules/farmacias/application/platform-location-review.js';
import { replacedProposals } from '../../backend/dist/modules/farmacias/application/location-status.js';
import { PgLocationRepository } from '../../backend/dist/modules/farmacias/infrastructure/location-repository.js';
import { PgPlatformLocationRepository } from '../../backend/dist/modules/farmacias/infrastructure/platform-location-repository.js';

const { Client } = createRequire(new URL('../../backend/package.json', import.meta.url))('pg');
const FORBIDDEN = ['farmafind_f01_test', 'farmafind_f01_test_d0570879cf41', 'farmafind_f01_test_0e5a2f669e60'];
const MARKERS = ['FarmaFind F07 TEST efimera'];
const secret = readFileSync(process.env.F072_SECRET_FILE ?? new URL('../../.cache/f025-docker/postgres-password.txt', import.meta.url), 'utf8').trim();
const urlFor = name => { const u = new URL(`postgresql://127.0.0.1:55431/${name}`); u.username = 'f01_migrator'; u.password = secret; return u.toString(); };
const connect = async url => { const c = new Client({ connectionString: url }); await c.connect(); return c; };
const database = `farmafind_f01_test_${randomBytes(6).toString('hex')}`;
assert(!FORBIDDEN.includes(database));
const results = {}; let passed = 0;
const ok = (name, condition, detail) => { assert.ok(condition, `${name}${detail === undefined ? '' : ` · ${JSON.stringify(detail)}`}`); results[name] = 'OK'; passed++; };
const body = { direccionPublicable: 'Jr. Ficticio 123', ciudad: 'Ayacucho', latitud: -13.165, longitud: -74.216, fuente: 'Punto marcado en el mapa' };

const admin = await connect(urlFor('farmafind_f025_cluster'));
const extra = [];
let main;
try {
  await admin.query(`CREATE DATABASE "${database}"`);
  await admin.query(`COMMENT ON DATABASE "${database}" IS '${MARKERS[0]}'`);
  await admin.query(`REVOKE CONNECT ON DATABASE "${database}" FROM PUBLIC`);
  const url = urlFor(database);
  await migrateTestDatabase(url, connect); await migrateF02TestDatabase(url, connect); await migrateF03TestDatabase(url, connect);
  await migrateF04TestDatabase(url, connect); await migrateF05TestDatabase(url, connect); await migrateF07TestDatabase(url, connect);
  await migrateF025TestDatabase(url, connect);
  main = await connect(url);
  const q = async (client, sql, values = []) => (await client.query(sql, values)).rows;

  // Datos ficticios (como migrador, confirmados).
  const user = async key => {
    const id = (await q(main, `INSERT INTO f01.usuario(email_canonico,password_hash) VALUES($1,'$argon2id$f072-ficticio') RETURNING id`,
      [`f072-${key}@example.invalid`]))[0].id;
    const fingerprint = randomBytes(32).toString('hex');
    await q(main, `INSERT INTO f01.sesion(usuario_id,token_fingerprint,idle_expires_at,absolute_expires_at)
      VALUES($1,decode($2,'hex'),now()+interval '30 minutes',now()+interval '30 minutes')`, [id, fingerprint]);
    return { id, fingerprint };
  };
  const reviewer = async key => {
    const u = await user(key); const approval = randomUUID();
    await q(main, `INSERT INTO f01.privileged_approval(id,operation,target_usuario_id,role_code,reason,expires_at,integrity_hash)
      VALUES($1,'INITIAL_PLATFORM_ADMIN',$2,'ADMINISTRADOR_PLATAFORMA','F07.2 TEST',now()+interval '1 hour',$3)`, [approval, u.id, 'a'.repeat(64)]);
    await q(main, `INSERT INTO f01.platform_role_assignment(usuario_id,role_code,approval_id) VALUES($1,'ADMINISTRADOR_PLATAFORMA',$2)`, [u.id, approval]);
    await q(main, `INSERT INTO f07.platform_location_grant(actor_id,approval_id,approval_sha256,reason) VALUES($1,$2,$3,'F07.2 TEST')`, [u.id, randomUUID(), 'c'.repeat(64)]);
    return u;
  };
  const pharmacy = async name => {
    const id = (await q(main, 'INSERT INTO f01.farmacia_referencia(nombre_publico) VALUES($1) RETURNING id', [name]))[0].id;
    await q(main, "INSERT INTO f03.farmacia_publica(farmacia_id,direccion_texto) VALUES($1,'Dirección inicial TEST')", [id]);
    return id;
  };
  const member = async (u, f, rol, caps) => {
    const m = (await q(main, 'INSERT INTO f01.usuario_farmacia(usuario_id,farmacia_id,rol) VALUES($1,$2,$3) RETURNING id', [u.id, f, rol]))[0].id;
    for (const c of caps) await q(main, 'INSERT INTO f01.delegacion(membresia_id,farmacia_id,capacidad,granted_by_usuario_id) VALUES($1,$2,$3,$4)', [m, f, c, u.id]);
  };
  const R = await reviewer('revisor'), R2 = await reviewer('revisor-miembro');
  const DA = await user('dueno-stuart'), DB = await user('dueno-beta');
  const stuart = await pharmacy('STUART-FAR (ficticia)'), beta = await pharmacy('Beta (ficticia)');
  await member(DA, stuart, 'DUENO', ['GEO_LOCATION_PROPOSE']); await member(DB, beta, 'DUENO', ['GEO_LOCATION_PROPOSE']);
  await member(R2, stuart, 'TRABAJADOR', []);

  // Actuar como un usuario real: f01_runtime con la sesión verificada (GUC locales a la transacción).
  async function as(client, u, farmacia, work) {
    await client.query('BEGIN');
    try {
      await client.query("SELECT set_config('app.actor_user_id',$1,true),set_config('app.session_fingerprint',$2,true),set_config('app.farmacia_id',$3,true)",
        [u.id, u.fingerprint, farmacia]);
      await client.query('SET LOCAL ROLE f01_runtime');
      const value = await work(); await client.query('COMMIT'); return value;
    } catch (error) { await client.query('ROLLBACK'); throw error; }
  }
  const ownerUseCase = (client, u) => new ManagePharmacyLocation({ run: (_s, f, capability, work) =>
    work(new PgLocationRepository(client, f), { pharmacyId: f, actorId: u.id, capability }) });
  const reviewUseCase = (client, u) => new PlatformLocationReview({ run: (_s, work) => work(new PgPlatformLocationRepository(client), u.id) });

  // ---- Caso real STUART-FAR: dos propuestas idénticas con 4 s (datos heredados, como en la DEMO) ----
  const legacy = async at => (await q(main, `INSERT INTO f07.ubicacion_propuesta(farmacia_id,direccion_publicable,ciudad,latitud,longitud,fuente,
      propuesta_por,propuesta_at,base_public_version) VALUES($1,'Jr. Ficticio 123','ayacucho',-13.165,-74.216,'Punto marcado en el mapa',$2,$3,
      (SELECT public_version FROM f03.farmacia_publica WHERE farmacia_id=$1)) RETURNING id`, [stuart, DA.id, at]))[0].id;
  const oldId = await legacy('2026-11-27T22:33:42Z'), newId = await legacy('2026-11-27T22:33:46Z');
  for (const id of [oldId, newId]) await q(main, `INSERT INTO f07.ubicacion_auditoria(farmacia_id,propuesta_id,actor_usuario_id,accion) VALUES($1,$2,$3,'PROPUESTA')`, [stuart, id, DA.id]);
  const listIds = async () => (await as(main, R, '', () => reviewUseCase(main, R).list('s'))).map(item => item.propuestaId);
  ok('antes: «Pendientes» muestra solo la más nueva (la vieja ya no es la última)', JSON.stringify(await listIds()) === JSON.stringify([newId]));
  const approved = await as(main, R, '', () => reviewUseCase(main, R).decide('s', newId, { decision: 'APROBAR', version: 1, evidenciaConfirmada: true, motivo: 'Coincide (TEST)' }));
  ok('se aprueba la más nueva (17:33:46)', approved.estado === 'PUBLICADA_VERIFICADA');
  ok('después: la vieja NO vuelve a «Pendientes» (antes reaparecía)', (await listIds()).length === 0);
  const replacedForReviewer = await as(main, R, '', () => reviewUseCase(main, R).history('s', 'REEMPLAZADA', '1'));
  ok('filtro «Reemplazadas» del revisor: la vieja, con fecha de reemplazo 17:33:46 y motivo', replacedForReviewer.total === 1 &&
    replacedForReviewer.filas[0].propuestaId === oldId && replacedForReviewer.filas[0].decision === 'REEMPLAZADA' &&
    replacedForReviewer.filas[0].decididaAt === '2026-11-27T22:33:46.000Z' && replacedForReviewer.filas[0].motivo === 'Se envió una propuesta más reciente',
    replacedForReviewer);
  const pendingForReviewer = await as(main, R, '', () => reviewUseCase(main, R).history('s', 'PENDIENTE', '1'));
  ok('filtro «Pendientes» del historial: vacío para STUART-FAR', pendingForReviewer.filas.every(row => row.propuestaId !== oldId));
  const ownerRows = await as(main, DA, stuart, () => new PgLocationRepository(main, stuart).history(stuart, 50));
  const ownerView = await as(main, DA, stuart, () => ownerUseCase(main, DA).status('s', stuart));
  const ownerReplaced = [...replacedProposals(ownerRows).keys()].sort(), reviewerReplaced = replacedForReviewer.filas.map(row => row.propuestaId).sort();
  ok('IGUALDAD dueño/revisor (condición de Andre): mismas propuestas «Reemplazada»', JSON.stringify(ownerReplaced) === JSON.stringify(reviewerReplaced) && ownerReplaced.length === 1,
    { ownerReplaced, reviewerReplaced });
  ok('historial del dueño: una entrada «Reemplazada» con la misma fecha que ve el revisor', ownerView.historial.filter(item => item.accion === 'REEMPLAZADA')
    .map(item => item.fecha).join() === '2026-11-27T22:33:46.000Z' && ownerView.estado === 'VERIFICADA' && ownerView.pendiente === null, ownerView.historial);
  let conflict = '';
  try { await as(main, R, '', () => reviewUseCase(main, R).decide('s', oldId, { decision: 'APROBAR', version: 1, evidenciaConfirmada: true, motivo: 'x' })); }
  catch (error) { conflict = error.message; }
  ok('decidir la vieja: 409 «Propuesta reemplazada»', conflict === 'Propuesta reemplazada', conflict);
  const oldRow = (await q(main, 'SELECT estado,version,revisada_por,revisada_at FROM f07.ubicacion_propuesta WHERE id=$1', [oldId]))[0];
  ok('D-03: la vieja no se borró ni se modificó (PENDIENTE, versión 1, sin revisor)', oldRow.estado === 'PENDIENTE' && Number(oldRow.version) === 1 &&
    oldRow.revisada_por === null && oldRow.revisada_at === null);

  // ---- Envío único (FR-002) ----
  const countBeta = async () => Number((await q(main, 'SELECT count(*)::int AS n FROM f07.ubicacion_propuesta WHERE farmacia_id=$1', [beta]))[0].n);
  const first = await as(main, DB, beta, () => ownerUseCase(main, DB).propose('s', beta, body));
  const again = await as(main, DB, beta, () => ownerUseCase(main, DB).propose('s', beta, body));
  ok('envío idéntico al instante: misma propuesta, una sola fila y una sola auditoría', again.id === first.id && await countBeta() === 1 &&
    Number((await q(main, "SELECT count(*)::int AS n FROM f07.ubicacion_auditoria WHERE farmacia_id=$1 AND accion='PROPUESTA'", [beta]))[0].n) === 1);
  const changed = await as(main, DB, beta, () => ownerUseCase(main, DB).propose('s', beta, { ...body, direccionPublicable: 'Jr. Ficticio 125' }));
  ok('propuesta distinta: se crea y la anterior queda «Reemplazada»', changed.id !== first.id && await countBeta() === 2 &&
    (await as(main, R, '', () => reviewUseCase(main, R).history('s', 'REEMPLAZADA', '1'))).filas.some(row => row.propuestaId === first.id));
  // Dos conexiones a la vez con el mismo envío nuevo: una sola fila.
  const c1 = await connect(url), c2 = await connect(url); extra.push(c1, c2);
  const twin = { ...body, direccionPublicable: 'Jr. Ficticio 200' };
  const [a, b] = await Promise.all([as(c1, DB, beta, () => ownerUseCase(c1, DB).propose('s', beta, twin)),
    as(c2, DB, beta, () => ownerUseCase(c2, DB).propose('s', beta, twin))]);
  ok('dos envíos idénticos simultáneos (dos conexiones): la misma propuesta y una sola fila nueva', a.id === b.id && await countBeta() === 3, { a, b });
  ok('«Pendientes» de Beta: solo la más reciente', JSON.stringify((await as(main, R, '', () => reviewUseCase(main, R).list('s')))
    .filter(item => item.farmaciaId === beta).map(item => item.propuestaId)) === JSON.stringify([a.id]));

  // ---- RLS sin cambios ----
  const r2List = await as(main, R2, '', () => reviewUseCase(main, R2).list('s'));
  const r2History = await as(main, R2, '', () => reviewUseCase(main, R2).history('s', 'REEMPLAZADA', '1'));
  ok('R2 (miembro de STUART-FAR) no ve STUART-FAR ni en «Pendientes» ni en «Reemplazadas»; sí ve Beta', r2List.every(item => item.farmaciaId !== stuart) &&
    r2History.filas.every(row => row.farmaciaNombre !== 'STUART-FAR (ficticia)') && r2History.filas.some(row => row.farmaciaNombre === 'Beta (ficticia)'));
  let crossOwner = 'permitido';
  try { await as(main, DB, stuart, () => ownerUseCase(main, DB).propose('s', stuart, body)); } catch { crossOwner = 'denegado'; }
  ok('el dueño de Beta no puede proponer en STUART-FAR', crossOwner === 'denegado');
  console.log(JSON.stringify({ database, passed, results }, null, 1));
} finally {
  for (const client of extra) await client.end().catch(() => undefined);
  if (main) await main.end().catch(() => undefined);
  const mark = (await admin.query(`SELECT shobj_description(oid,'pg_database') AS m FROM pg_database WHERE datname=$1`, [database])).rows[0]?.m;
  let dropped = false;
  if (MARKERS.includes(mark) && !FORBIDDEN.includes(database)) {
    await admin.query(`DROP DATABASE "${database}" WITH (FORCE)`);
    dropped = (await admin.query('SELECT count(*)::int AS n FROM pg_database WHERE datname=$1', [database])).rows[0].n === 0;
  }
  const demo = (await admin.query(`SELECT count(*)::int AS n FROM pg_database WHERE datname='farmafind_f01_test_d0570879cf41'`)).rows[0].n;
  console.log(JSON.stringify({ baseEfimera: database, borrada: dropped, demoSigueExistiendo: demo === 1 }));
  await admin.end();
}
