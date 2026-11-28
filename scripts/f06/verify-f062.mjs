/** F06.2 T013: el asistente con PostgreSQL real. Crea una base TEST efímera y marcada en el clúster de pruebas
 *  (127.0.0.1:55431), aplica todas las migraciones, siembra farmacias y ofertas FICTICIAS y lee como un rol de
 *  ejecución sin BYPASSRLS. Usa la búsqueda pública F03.2, la lista pública F07 y el horario público F07.1 reales.
 *  BORRA la base y el rol al final (también si falla). Nunca farmafind_f01_test ni la DEMO. Sin Redis.
 *  Requiere `npm --prefix backend run build`. */
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
import { PgPublicOfferRepository } from '../../backend/dist/modules/busqueda/infrastructure/public-offer-repository.js';
import { SearchPublicOffers } from '../../backend/dist/modules/busqueda/application/search-public-offers.js';
import { ListNearbyPharmacies } from '../../backend/dist/modules/busqueda/application/list-nearby-pharmacies.js';
import { F03PublicAssistantGateway } from '../../backend/dist/modules/busqueda/infrastructure/public-assistant-gateway.js';
import { ReadPublicOpeningHours } from '../../backend/dist/modules/farmacias/application/manage-opening-hours.js';
import { PgPublicOpeningHours } from '../../backend/dist/modules/farmacias/infrastructure/opening-hours-repository.js';
import { ConverseAssistant } from '../../backend/dist/modules/asistente-ia/application/converse-assistant.js';
import { F03ConversationPublicTools } from '../../backend/dist/modules/asistente-ia/infrastructure/conversation-public-tools.js';
import { InMemoryReviewedSourceCatalog } from '../../backend/dist/modules/asistente-ia/infrastructure/reviewed-source-catalog.js';
import { MockConversationProvider } from '../../backend/dist/modules/asistente-ia/infrastructure/mock-conversation-provider.js';
import { F025_CLUSTER_NAME, F025_TEST_MARKER } from '../f025/test-env.mjs';

const { Client, Pool } = createRequire(new URL('../../backend/package.json', import.meta.url))('pg');
const FORBIDDEN = ['farmafind_f01_test', 'farmafind_f01_test_d0570879cf41', 'farmafind_f01_test_0e5a2f669e60'];
const secret = readFileSync(process.env.F062_SECRET_FILE ?? new URL('../../.cache/f025-docker/postgres-password.txt', import.meta.url), 'utf8').trim();
const urlFor = (name, role = 'f01_migrator', password = secret) => {
  const u = new URL(`postgresql://127.0.0.1:55431/${name}`); u.username = role; u.password = password; return u.toString();
};
const connect = async url => { const c = new Client({ connectionString: url }); await c.connect(); return c; };
const suffix = randomBytes(6).toString('hex');
const database = `farmafind_f01_test_${suffix}`;
const runtimeRole = `ff_f062v_runtime_${suffix}`;
assert(!FORBIDDEN.includes(database));
const results = {}; let passed = 0;
const ok = (name, condition, detail) => { assert.ok(condition, `${name}${detail === undefined ? '' : ` · ${JSON.stringify(detail)}`}`); results[name] = 'OK'; passed++; };
const FRIDAY_10_LIMA = () => new Date('2026-11-27T15:00:00.000Z');

const admin = await connect(urlFor('farmafind_f025_cluster'));
let main; let pool;
try {
  assert.equal((await admin.query("SELECT current_setting('cluster_name') AS n")).rows[0].n, F025_CLUSTER_NAME);
  await admin.query(`CREATE DATABASE "${database}"`);
  await admin.query(`COMMENT ON DATABASE "${database}" IS '${F025_TEST_MARKER}'`);
  await admin.query(`REVOKE CONNECT ON DATABASE "${database}" FROM PUBLIC`);
  const url = urlFor(database);
  await migrateTestDatabase(url, connect); await migrateF02TestDatabase(url, connect); await migrateF03TestDatabase(url, connect);
  await migrateF04TestDatabase(url, connect); await migrateF05TestDatabase(url, connect); await migrateF07TestDatabase(url, connect);
  await migrateF025TestDatabase(url, connect);
  main = await connect(url);
  const q = async (sql, values = []) => (await main.query(sql, values)).rows;

  // Rol de ejecución propio de esta verificación: sin superusuario ni BYPASSRLS.
  const password = randomBytes(24).toString('hex');
  await q(`CREATE ROLE "${runtimeRole}" LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD '${password}'`);
  await q(`GRANT f01_runtime TO "${runtimeRole}"`);
  await q(`GRANT CONNECT ON DATABASE "${database}" TO "${runtimeRole}"`);

  // Datos ficticios (como migrador). Ayacucho/Carmen Alto; viernes 10:00 hora de Lima.
  const owner = (await q(`INSERT INTO f01.usuario(email_canonico,password_hash) VALUES('f062-dueno@example.invalid','$argon2id$f062-ficticio') RETURNING id`))[0].id;
  const reviewer = (await q(`INSERT INTO f01.usuario(email_canonico,password_hash) VALUES('f062-revisor@example.invalid','$argon2id$f062-ficticio') RETURNING id`))[0].id;
  const pharmacy = async (name, lat, lng, hours, estado = 'ACTIVA') => {
    const id = (await q('INSERT INTO f01.farmacia_referencia(nombre_publico,estado) VALUES($1,$2) RETURNING id', [name, estado]))[0].id;
    await q('INSERT INTO f03.farmacia_publica(farmacia_id,direccion_texto) VALUES($1,$2)', [id, `Jr. ${name}`]);
    await q(`UPDATE f03.farmacia_publica SET ciudad='ayacucho',latitud=$2,longitud=$3,fuente='Datos ficticios F06.2',
      estado_ubicacion='PUBLICADA_VERIFICADA',propuesta_por=$4,revisada_por=$5,fecha_verificacion=now(),updated_at=now() WHERE farmacia_id=$1`, [id, lat, lng, owner, reviewer]);
    for (let dia = 1; dia <= 7; dia++) {
      const closed = hours === null || dia === 7;
      await q(`INSERT INTO f07.horario_atencion(farmacia_id,dia,cerrado,abre,cierra,version,actualizado_por) VALUES($1,$2,$3,$4,$5,1,$6)`,
        [id, dia, closed, closed ? null : hours[0], closed ? null : hours[1], owner]);
    }
    return id;
  };
  const P = {
    plaza: await pharmacy('Botica Plaza (ficticia)', -13.1590, -74.2245, ['08:00', '20:00']),
    carmen: await pharmacy('Farmacia Carmen (ficticia)', -13.1790, -74.2200, ['07:00', '21:00']),
    cerrada: await pharmacy('Botica Cerrada (ficticia)', -13.1600, -74.2250, null),
    inactiva: await pharmacy('Farmacia Inactiva (ficticia)', -13.1795, -74.2205, ['00:00', '23:59'], 'INACTIVA'),
  };
  const product = async (nombre, principio, conc, pres) => (await q(`INSERT INTO f02.medicamento(nombre,principio_activo,concentracion,presentacion,clasificacion)
    VALUES($1,$2,$3,$4,'venta libre') RETURNING id`, [nombre, principio, conc, pres]))[0].id;
  const stock = (farmacia, medicamento, price, quantity = 25) => q(`INSERT INTO f02.inventario(farmacia_id,medicamento_id,precio_centavos,
    cantidad_fisica,cantidad_comprometida,ultima_revision_at) VALUES($1,$2,$3,$4,0,now())`, [farmacia, medicamento, price, quantity]);
  const M = {
    ibu400: await product('ibuprofeno', 'ibuprofeno', '400 mg', 'tabletas x 10'),
    ibu600: await product('ibuprofeno', 'ibuprofeno', '600 mg', 'tabletas x 10'),
    amox: await product('amoxicilina', 'amoxicilina', '500 mg', 'cápsulas x 12'),
    panadol: await product('panadol', 'paracetamol', '500 mg', 'tabletas x 20'),
    paraTab: await product('paracetamol', 'paracetamol', '500 mg', 'tabletas x 100'),
    paraCaja: await product('paracetamol ficticio', 'paracetamol', '500 mg', 'caja x 30'),
    paraJarabe: await product('paracetamol jarabe', 'paracetamol', '500 mg', 'jarabe 60 ml'),
  };
  await stock(P.plaza, M.ibu400, 400); await stock(P.carmen, M.ibu400, 380); await stock(P.inactiva, M.ibu400, 100);
  await stock(P.cerrada, M.ibu400, 50, 0); // sin stock: nunca público
  await stock(P.plaza, M.ibu600, 700);
  await stock(P.plaza, M.amox, 300); await stock(P.carmen, M.amox, 350);
  await stock(P.plaza, M.panadol, 1500); await stock(P.carmen, M.paraTab, 900);
  await stock(P.plaza, M.paraCaja, 300); await stock(P.cerrada, M.paraJarabe, 200);

  // Composición real (solo lectura pública) con el rol de ejecución.
  pool = new Pool({ connectionString: urlFor(database, runtimeRole, password), max: 3 });
  const role = (await pool.query('SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname=current_user')).rows[0];
  ok('rol de ejecución sin superusuario ni BYPASSRLS', role.rolsuper === false && role.rolbypassrls === false, role);
  const repository = new PgPublicOfferRepository(pool, { exposeVerifiedLocation: true });
  const search = new SearchPublicOffers(repository, null, { ttlSeconds: 30, candidateLimit: 200 });
  const tools = new F03ConversationPublicTools(new F03PublicAssistantGateway(search, repository),
    new ListNearbyPharmacies(new PgPublicOfferRepository(pool)), new ReadPublicOpeningHours(new PgPublicOpeningHours(pool)));
  const assistant = new ConverseAssistant(new MockConversationProvider(), new InMemoryReviewedSourceCatalog([]), tools, FRIDAY_10_LIMA);
  const ask = (consulta, contexto = {}) => assistant.execute({ consulta, contexto }, randomUUID());
  const names = answer => (answer.tarjetas ?? []).map(card => card.farmacia.nombre);

  // SC-001 · 1. Precio con aclaración y tarjetas; inactiva y sin stock fuera.
  const price = await ask('¿En qué farmacia el ibuprofeno está más barato?');
  ok('precio: aclara 400 mg / 600 mg', price.estado === 'ACLARACION' && price.opciones?.length === 2, price.opciones);
  const chosen = await ask(price.opciones.find(option => option.consulta.includes('400 mg')).consulta, price.contexto);
  ok('precio: tarjetas ordenadas por precio (3,80 y 4,00)', JSON.stringify(chosen.tarjetas.map(card => card.precioCentavos)) === '[380,400]', chosen.tarjetas);
  ok('precio: farmacia INACTIVA y oferta sin stock nunca aparecen', !JSON.stringify(chosen).includes('Inactiva') && !JSON.stringify(chosen).includes('Cerrada'));
  ok('precio: «Reservar» lleva a la pantalla existente', chosen.tarjetas[0].reservarUrl === `/reservations?pharmacyId=${P.carmen}&medicationId=${M.ibu400}`);
  const sixHundred = await ask('¿y el de 600 mg?', chosen.contexto);
  ok('seguimiento: «¿y el de 600 mg?»', sixHundred.tarjetas?.length === 1 && sixHundred.tarjetas[0].precioCentavos === 700, sixHundred.tarjetas);
  // 2. «¿y en Carmen Alto?» → cercanía con distancia real (F03.1/F07).
  const near = await ask('¿y en Carmen Alto?', chosen.contexto);
  ok('seguimiento: «¿y en Carmen Alto?» por cercanía', near.contexto.intencion === 'CERCANIA' && names(near)[0] === 'Farmacia Carmen (ficticia)'
    && near.tarjetas[0].distanciaKm !== null && near.tarjetas[0].distanciaKm < 0.5, near.tarjetas);
  // 3. Cerca con el distrito elegido en la búsqueda.
  const amox = await ask('¿Dónde hay amoxicilina cerca?', { distrito: 'Ayacucho' });
  ok('cerca: amoxicilina ordenada por distancia desde Ayacucho', names(amox)[0] === 'Botica Plaza (ficticia)', amox.tarjetas);
  // 4. Abierta ahora (horario público F07.1 real, hora de Lima).
  const open = await ask('¿Qué farmacia está abierta ahora?', { distrito: 'Carmen Alto' });
  ok('abierta ahora: solo activas y abiertas (viernes 10:00)', open.estado === 'BUSQUEDA_PUBLICA' && names(open).includes('Farmacia Carmen (ficticia)')
    && names(open).includes('Botica Plaza (ficticia)') && !names(open).some(name => /Cerrada|Inactiva/.test(name)), open.tarjetas);
  // 5. Alternativa por forma conocida.
  const alt = await ask('¿Hay algo más barato que Panadol?');
  ok('alternativa: solo misma forma conocida (tabletas x 100), fuera «caja x 30» y jarabe',
    JSON.stringify((alt.tarjetas ?? []).map(card => card.producto.id)) === JSON.stringify([M.paraTab]) && alt.tarjetas[0].etiqueta === 'Mismo principio activo y concentración', alt);
  ok('alternativa: aviso y sin «equivalente» ni «reemplazar»', alt.respuesta.includes('Consulta al químico farmacéutico antes de cambiar de producto.')
    && !/equivalente|reemplaz|sustitu/i.test(alt.respuesta));
  // 6. «¿Quisiste decir…?» con las sugerencias públicas reales (F08.1).
  const typo = await ask('ibuprofemo');
  ok('«ibuprofemo» → «¿Quisiste decir ibuprofeno?»', typo.sugerencia?.texto === '¿Quisiste decir ibuprofeno?', typo);
  // 7. Emergencia: primero y sola.
  const urgent = await ask('tengo dolor de pecho', chosen.contexto);
  ok('emergencia sola con 106/116/105', urgent.estado === 'URGENCIA' && urgent.tarjetas === undefined
    && urgent.emergencia.numeros.map(item => item.numero).join() === '106,116,105');
  // Privacidad: ninguna respuesta lleva campos internos.
  ok('sin campos privados en ninguna respuesta', ![price, chosen, near, amox, open, alt, typo].some(answer =>
    /cantidad_fisica|cantidad_comprometida|password_hash|token_fingerprint|email/i.test(JSON.stringify(answer))));
  console.log(JSON.stringify({ database, resultados: results, total: `${passed}/${passed}` }, null, 1));
} finally {
  if (pool) await pool.end().catch(() => undefined);
  if (main) await main.end().catch(() => undefined);
  try {
    const mark = (await admin.query(`SELECT shobj_description(oid,'pg_database') AS m FROM pg_database WHERE datname=$1`, [database])).rows[0]?.m;
    if (mark === F025_TEST_MARKER) {
      await admin.query(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1 AND pid<>pg_backend_pid()`, [database]);
      await admin.query(`DROP DATABASE "${database}"`);
    }
    await admin.query(`DROP ROLE IF EXISTS "${runtimeRole}"`);
    const left = (await admin.query(`SELECT (SELECT count(*)::int FROM pg_database WHERE datname=$1) dbs,
      (SELECT count(*)::int FROM pg_roles WHERE rolname=$2) roles`, [database, runtimeRole])).rows[0];
    console.log(JSON.stringify({ limpieza: { base: database, quedan: left } }));
  } finally { await admin.end(); }
}
