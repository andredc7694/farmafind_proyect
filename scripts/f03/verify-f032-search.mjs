/** F03.2 T001–T003: prueba las migraciones f03/003 y f07/010 con PostgreSQL real.
 *  Crea una base TEST efímera y marcada en el clúster de pruebas (127.0.0.1:55431), aplica F01→F03 (sin F07),
 *  comprueba, aplica F07 (001–010), vuelve a comprobar y BORRA la base al final. Nunca farmafind_f01_test ni la DEMO.
 *  Solo datos ficticios. Requiere `npm --prefix backend run build`. */
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { assertF07EphemeralDatabase } from '../f07/fixtures.mjs';
import { migrateTestDatabase } from '../../backend/dist/modules/usuarios/infrastructure/db/migrate.js';
import { migrateF02TestDatabase } from '../../backend/dist/modules/inventario/infrastructure/migrate.js';
import { migrateF03TestDatabase, migrateF07TestDatabase } from '../../backend/dist/modules/busqueda/infrastructure/migrate.js';
import { PgPublicOfferRepository } from '../../backend/dist/modules/busqueda/infrastructure/public-offer-repository.js';
import { SearchPublicOffers } from '../../backend/dist/modules/busqueda/application/search-public-offers.js';
import { SuggestPublicOffers } from '../../backend/dist/modules/busqueda/application/suggest-public.js';
import { parsePublicQuery } from '../../backend/dist/modules/busqueda/domain/public-query.js';
import { normalizeSearchText } from '../../backend/dist/modules/busqueda/domain/search-terms.js';

const { Client } = createRequire(new URL('../../backend/package.json', import.meta.url))('pg');
const FORBIDDEN = ['farmafind_f01_test', 'farmafind_f01_test_d0570879cf41', 'farmafind_f01_test_0e5a2f669e60'];
const MARKER = 'FarmaFind F07 TEST efimera';
const secret = readFileSync(process.env.F032_SECRET_FILE ?? new URL('../../.cache/f025-docker/postgres-password.txt', import.meta.url), 'utf8').trim();
const urlFor = name => { const url = new URL(`postgresql://127.0.0.1:55431/${name}`); url.username = 'f01_migrator'; url.password = secret; return url.toString(); };
const connect = async url => { const client = new Client({ connectionString: url }); await client.connect(); return client; };

const database = `farmafind_f01_test_${randomBytes(6).toString('hex')}`;
assert(!FORBIDDEN.includes(database)); assertF07EphemeralDatabase(urlFor(database));
const results = {}; let passed = 0;
const ok = (name, condition, detail) => { assert.ok(condition, `${name}${detail === undefined ? '' : ` · ${JSON.stringify(detail)}`}`); results[name] = 'OK'; passed++; };

const PHARMACIES = [['alfa', 'Farmacia Alfa Ficticia', 'ACTIVA', -13.1631, -74.2244], ['beta', 'Farmacia Beta Ficticia', 'ACTIVA', -13.1650, -74.2200],
  ['gamma', 'Farmacia Gamma Ficticia', 'INACTIVA', -13.17, -74.21]];
// [clave, nombre, principio activo, concentración, presentación, estado]
const MEDS = [
  ['p500x10', 'paracetamol', 'paracetamol', '500 mg', 'tabletas x 10', 'ACTIVO'], ['p500x100', 'paracetamol', 'paracetamol', '500 mg', 'tabletas x 100', 'ACTIVO'],
  ['p1g', 'paracetamol', 'paracetamol', '1 g', 'tabletas x 10', 'ACTIVO'], ['pjar', 'paracetamol', 'paracetamol', '120 mg/5 ml', 'jarabe 60 ml', 'ACTIVO'],
  ['amoxcap', 'amoxicilina', 'amoxicilina', '500 mg', 'cápsulas x 100', 'ACTIVO'], ['amoxsus', 'amoxicilina', 'amoxicilina', '250 mg/5 ml', 'suspensión 60 ml', 'ACTIVO'],
  ['ibu400', 'ibuprofeno', 'ibuprofeno', '400mg', 'tabletas x 10', 'ACTIVO'], ['ibu600', 'ibuprofeno', 'ibuprofeno', '600 mg', 'tabletas x 10', 'ACTIVO'],
  ['aas', 'ácido acetilsalicílico', 'ácido acetilsalicílico', '100 mg', 'tabletas x 100', 'ACTIVO'],
  ['aspirina', 'aspirina', 'ácido acetilsalicílico', '1500 mg', 'sobres x 10', 'ACTIVO'],
  ['clorf', 'clorfenamina', 'clorfenamina', '4 mg', 'tabletas x 20', 'ACTIVO'], ['lora', 'loratadina', 'loratadina', '10 mg', 'tabletas x 10', 'INACTIVO'],
  ['ceti', 'cetirizina', null, '10 mg', 'tabletas x 10', 'ACTIVO'],
];
// [farmacia, medicamento, precio, stock físico] (clorfenamina sin stock disponible)
const STOCK = [['alfa', 'p500x10', 250, 10], ['alfa', 'p1g', 600, 10], ['alfa', 'pjar', 900, 10], ['alfa', 'amoxcap', 3500, 10], ['alfa', 'ibu400', 400, 10],
  ['alfa', 'aas', 500, 10], ['alfa', 'aspirina', 800, 10], ['alfa', 'clorf', 300, 0], ['alfa', 'lora', 450, 10], ['alfa', 'ceti', 450, 10],
  ['beta', 'p500x10', 270, 10], ['beta', 'p500x100', 1800, 10], ['beta', 'amoxsus', 1500, 10], ['beta', 'ibu600', 700, 10], ['gamma', 'p500x10', 200, 10]];

const admin = await connect(urlFor('farmafind_f025_cluster'));
let test; let dropped = false;
try {
  assert.equal((await admin.query('SELECT current_database() AS d')).rows[0].d, 'farmafind_f025_cluster');
  await admin.query(`CREATE DATABASE "${database}"`);
  await admin.query(`COMMENT ON DATABASE "${database}" IS '${MARKER}'`);
  await admin.query(`REVOKE CONNECT ON DATABASE "${database}" FROM PUBLIC`);
  const url = urlFor(database);
  const migrations = { f01: (await migrateTestDatabase(url, connect)).applied.length, f02: (await migrateF02TestDatabase(url, connect)).length,
    f03: await migrateF03TestDatabase(url, connect) };
  ok('T001 · F03 aplica 001–003 (003 con hash aprobado)', migrations.f03.join() === '001_public_search.sql,002_public_projection.sql,003_search_terms.sql', migrations.f03);
  test = await connect(url);
  const q = async (sql, values = []) => (await test.query(sql, values)).rows;

  // Datos ficticios.
  const pharmacy = {}; const med = {};
  await q('BEGIN');
  for (const [key, name, estado, lat, lon] of PHARMACIES) {
    pharmacy[key] = (await q('INSERT INTO f01.farmacia_referencia(nombre_publico) VALUES($1) RETURNING id', [name]))[0].id;
    await q('INSERT INTO f03.farmacia_publica(farmacia_id,direccion_texto,latitud,longitud) VALUES($1,$2,$3,$4)', [pharmacy[key], `Jr. Ficticio ${key}`, lat, lon]);
    if (estado !== 'ACTIVA') await q('UPDATE f01.farmacia_referencia SET estado=$2 WHERE id=$1', [pharmacy[key], estado]);
  }
  for (const [key, nombre, principio, conc, pres, estado] of MEDS)
    med[key] = (await q(`INSERT INTO f02.medicamento(nombre,principio_activo,concentracion,presentacion,clasificacion,estado)
      VALUES($1,$2,$3,$4,'venta libre',$5) RETURNING id`, [nombre, principio, conc, pres, estado]))[0].id;
  for (const [ph, m, price, stock] of STOCK)
    await q(`INSERT INTO f02.inventario(farmacia_id,medicamento_id,precio_centavos,cantidad_fisica,cantidad_comprometida,ultima_revision_at)
      VALUES($1,$2,$3,$4,0,now())`, [pharmacy[ph], med[m], price, stock]);
  await q('COMMIT');

  const label = offer => `${offer.medicamento.nombreComercial} ${offer.medicamento.concentracion} ${offer.medicamento.presentacion}`;
  async function asRuntime(work) {
    await q('BEGIN'); await q('SET LOCAL ROLE f01_runtime');
    try { return await work(); } finally { await q('ROLLBACK'); }
  }
  const useCase = exposeVerifiedLocation => new SearchPublicOffers(new PgPublicOfferRepository(test, { exposeVerifiedLocation }), null,
    { ttlSeconds: 60, candidateLimit: 200 });
  const search = (text, extra = {}, expose = false) => useCase(expose).execute(parsePublicQuery({ q: text, ...extra }));
  const each = async list => { const out = []; for (const text of list) out.push(await search(text)); return out; };

  // ---- Fase A: sin F07 ----
  await asRuntime(async () => {
    const rows = await q(`SELECT * FROM f03.search_public_offers_terms('{paracetamol}','{}',NULL,NULL,200)`);
    ok('A · sin F07 la función nueva existe y nunca da coordenadas', rows.length === 5 && rows.every(r => r.farmacia_latitud === null && r.farmacia_longitud === null), rows.length);
  });

  // Paridad TS/SQL y tildes en mayúsculas (como dueño de la función; f01_runtime no puede ejecutarla).
  const samples = ['ÁCIDO', 'Ácido', 'acido', 'IBUPROFENO 400MG', 'tabletas x10', '2,5 mg/5ml.', 'Cápsulas — Niño', 'ÑANDÚ Ü', 'paracetamol  500   mg',
    'ÀÄÂÃ ÈËÊ ÌÏÎ ÒÖÔÕ ÙÛ Ç', 'vitamina b12', '0.5%crema', 'x.10', '100 UI/ml'];
  await q('BEGIN'); await q('SET LOCAL ROLE f03_projection_owner');
  const sql = (await q('SELECT s, f03.normalize_search_text(s) AS n FROM unnest($1::text[]) s', [samples])).map(r => [r.s, r.n]);
  const concat = (await q(`SELECT f03.normalize_search_text(concat_ws(' ', 'clorfenamina', NULL, 'Tabletas')) AS n`))[0].n;
  await q('ROLLBACK');
  const mismatch = sql.filter(([s, n]) => normalizeSearchText(s) !== n);
  ok('T004 · paridad de limpieza TS/SQL en 14 textos', mismatch.length === 0, mismatch.map(([s, n]) => [s, n, normalizeSearchText(s)]));
  ok('T003 · «ÁCIDO», «Ácido» y «acido» se limpian igual en la base real', new Set(sql.slice(0, 3).map(([, n]) => n)).size === 1 && sql[0][1] === 'acido');
  ok('T003 · concat_ws conserva el texto si una parte es NULL', concat === 'clorfenamina tabletas', concat);
  await q('BEGIN'); let rejected = false;
  try { await q(`INSERT INTO f02.medicamento(nombre,principio_activo,concentracion,presentacion,clasificacion) VALUES('sin presentacion','x','1 mg',NULL,'venta libre')`); }
  catch (error) { rejected = error.code === '23502'; }
  await q('ROLLBACK');
  ok('T003 · el catálogo no admite un producto sin presentación (NOT NULL de F02)', rejected);

  // ---- F07 (001–010) ----
  const f07 = await migrateF07TestDatabase(url, connect);
  ok('T001 · F07 aplica 001–010 (010 con hash aprobado)', f07.length === 10 && f07.at(-1) === '010_search_terms_location.sql', f07);
  // Dos usuarios ficticios (quien propone y quien revisa); hash con formato argon2id que nunca se usa para entrar.
  const ids = [];
  for (const who of ['propone', 'revisa']) ids.push((await q(
    `INSERT INTO f01.usuario(email_canonico,password_hash) VALUES($1,'$argon2id$v=19$m=65536,t=3,p=4$ZmljdGljaW8$ZmljdGljaW8') RETURNING id`,
    [`f032-${who}@example.invalid`]))[0].id);
  const [proposer, reviewer] = ids;
  await q(`UPDATE f03.farmacia_publica SET estado_ubicacion='PUBLICADA_VERIFICADA', ciudad='ayacucho', fuente='Fixture F03.2 TEST',
    propuesta_por=$2, revisada_por=$3, fecha_verificacion=now(), updated_at=now() WHERE farmacia_id=$1`, [pharmacy.alfa, proposer, reviewer]);
  await q(`UPDATE f03.farmacia_publica SET estado_ubicacion='PENDIENTE' WHERE farmacia_id=$1`, [pharmacy.beta]);

  // Privilegios y forma de las funciones.
  const fn = 'f03.search_public_offers_terms(text[],text[],bigint,bigint,integer)';
  const meta = (await q(`SELECT p.proname, r.rolname AS owner, r.rolbypassrls, p.prosecdef, p.proconfig, coalesce(p.proacl::text,'') AS acl
    FROM pg_proc p JOIN pg_roles r ON r.oid=p.proowner WHERE p.oid IN ($1::regprocedure, 'f03.normalize_search_text(text)'::regprocedure) ORDER BY p.proname`, [fn]));
  const terms = meta.find(m => m.proname === 'search_public_offers_terms'); const norm = meta.find(m => m.proname === 'normalize_search_text');
  ok('T002 · función de búsqueda: SECURITY DEFINER, dueño f03_projection_owner sin BYPASSRLS y search_path fijo',
    terms.prosecdef && terms.owner === 'f03_projection_owner' && !terms.rolbypassrls && terms.proconfig.some(c => c.startsWith('search_path=')), terms);
  ok('T002 · nadie más por PUBLIC; f01_runtime puede ejecutar la búsqueda y no la limpieza',
    !/(^|[{,])=X/.test(terms.acl) && !/(^|[{,])=X/.test(norm.acl) &&
    (await q(`SELECT has_function_privilege('f01_runtime',$1,'EXECUTE') AS a, has_function_privilege('f01_runtime','f03.normalize_search_text(text)','EXECUTE') AS b`, [fn]))
      .every(r => r.a === true && r.b === false), [terms.acl, norm.acl]);
  const oldDef = (await q(`SELECT pg_get_functiondef('f03.search_public_offers(text,bigint,bigint,integer)'::regprocedure) AS d`))[0].d;
  ok('T002 · f03.search_public_offers no cambia (sigue con position y coordenadas verificadas)',
    !oldDef.includes('normalize_search_text') && oldDef.includes('position(p_query') && oldDef.includes('PUBLICADA_VERIFICADA'));

  await asRuntime(async () => {
    // Publicación (FR-008).
    const all = await search('paracetamol', {}, true);
    const where = all.ofertas.map(o => o.farmacia.id);
    ok('T002 · farmacia INACTIVA no aparece', !where.includes(pharmacy.gamma) && where.includes(pharmacy.alfa) && where.includes(pharmacy.beta));
    const byPharmacy = Object.fromEntries(all.ofertas.map(o => [o.farmacia.id, o.farmacia.ubicacion]));
    ok('T002 · con F07: coordenadas solo de la verificada; PENDIENTE con coordenadas → null',
      byPharmacy[pharmacy.alfa] !== null && byPharmacy[pharmacy.beta] === null, byPharmacy);
    ok('T002 · opción apagada: todo null', (await search('paracetamol', {}, false)).ofertas.every(o => o.farmacia.ubicacion === null));
    for (const [text, why] of [['clorfenamina', 'sin stock'], ['loratadina', 'medicamento inactivo'], ['cetirizina', 'sin principio activo']]) {
      const result = await search(text);
      ok(`T002 · ${why} no aparece`, result.ofertas.length === 0 && result.coincidencia === 'NINGUNA', result.coincidencia);
    }
    ok('T002 · solo campos públicos en la fila', Object.keys((await q(`SELECT * FROM f03.search_public_offers_terms('{paracetamol}','{}',NULL,NULL,1)`))[0]).sort().join() ===
      'clasificacion,coincidencias,concentracion,farmacia_direccion,farmacia_id,farmacia_latitud,farmacia_longitud,farmacia_nombre,medicamento_id,nombre_comercial,precio_centavos,presentacion,principio_activo,ultima_revision');

    // Comparación (FR-001 a FR-006, FR-013).
    const exact = await search('paracetamol 500 mg tabletas x 10');
    ok('T003 · «paracetamol 500 mg tabletas x 10» → solo esa presentación (2 farmacias activas)', exact.coincidencia === 'EXACTA' &&
      exact.ofertas.length === 2 && exact.ofertas.every(o => label(o) === 'paracetamol 500 mg tabletas x 10'), exact.ofertas.map(label));
    const p500 = await search('paracetamol 500', { orden: 'precio_asc' });
    ok('T003 · «paracetamol 500» → las de 500 mg, sin 1 g ni jarabe, de menor a mayor precio', p500.coincidencia === 'EXACTA' &&
      JSON.stringify(p500.ofertas.map(o => o.precioReferencialCentavos)) === '[250,270,1800]', p500.ofertas.map(label));
    const caps = await search('amoxicilina capsulas');
    ok('T003 · «amoxicilina capsulas» → solo cápsulas', caps.coincidencia === 'EXACTA' && caps.ofertas.map(label).join() === 'amoxicilina 500 mg cápsulas x 100');
    const ibu = await each(['ibuprofeno 400mg', 'IBUPROFENO 400 MG', 'ibuprofeno 400 mg']);
    ok('T003 · «500mg» = «500 mg» y sin mayúsculas (dato guardado «400mg»)', ibu.every(r => r.coincidencia === 'EXACTA' && r.ofertas.map(label).join() === 'ibuprofeno 400mg tabletas x 10'));
    const acid = await each(['ÁCIDO', 'Ácido', 'acido']);
    const acidSet = acid.map(r => r.ofertas.map(o => o.medicamento.nombreComercial).sort().join());
    ok('T003 · «ÁCIDO», «Ácido» y «acido» dan lo mismo y encuentran «ácido» guardado con tilde', new Set(acidSet).size === 1 && acidSet[0] === 'aspirina,ácido acetilsalicílico', acidSet);
    const x10 = await each(['paracetamol tabletas x10', 'paracetamol tabletas x 10']);
    ok('T003 · «x10» = «x 10»', JSON.stringify(x10[0].ofertas) === JSON.stringify(x10[1].ofertas) && x10[0].coincidencia === 'EXACTA');
    const asp = await search('aspirina 500');
    ok('T003 · «500» no coincide con «1500 mg»', asp.coincidencia === 'APROXIMADA' && asp.ofertas.length === 1);
    const p750 = await search('paracetamol 750 mg tabletas');
    ok('T003 · sin la presentación pedida → APROXIMADA con todas, las más parecidas primero', p750.coincidencia === 'APROXIMADA' && p750.ofertas.length === 5 &&
      p750.ofertas.slice(0, 3).every(o => o.medicamento.concentracion === '500 mg'), p750.ofertas.map(label));
    ok('T003 · nombre inexistente → NINGUNA', (await search('xyzol 500 mg')).coincidencia === 'NINGUNA');
    for (const t of ['tabletas', '500 mg']) ok(`T003 · «${t}» → FALTA_NOMBRE`, (await search(t)).coincidencia === 'FALTA_NOMBRE');
    const before = (await search('parace')).ofertas.length;
    ok('T003 · lo de hoy sigue: «parace» y «paracetamol» traen los 5 paracetamoles', before === 5 && (await search('paracetamol')).ofertas.length === 5);

    // Palabras cortas (pedido de Andre).
    const count = async (words, tokens = []) => (await q('SELECT count(*)::int AS n FROM f03.search_public_offers_terms($1,$2,NULL,NULL,200)', [words, tokens]))[0].n;
    const total = (await q(`SELECT count(*)::int AS n FROM f03.search_public_offers_terms('{a,e,i,o,u}'::text[] || '{}'::text[],'{}',NULL,NULL,200)`))[0].n;
    ok('T003 · palabras de una letra en la función → 0 filas (no todo el catálogo)', (await count(['a'])) === 0 && (await count(['p'])) === 0 && total === 0);
    ok('T003 · sin palabras o con más de 8 → 0 filas', (await count([])) === 0 && (await count(['para', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'])) === 0);
    ok('T003 · «ib» (2 letras) solo trae ibuprofeno', (await search('ib')).ofertas.every(o => o.medicamento.nombreComercial === 'ibuprofeno'));
    ok('T003 · el backend no envía una letra: «p x» → sin consultar y con ayuda (la API ya rechaza «p», menos de 2 caracteres)', (await search('p x')).coincidencia === 'FALTA_NOMBRE');
    const rankedFirst = (await q(`SELECT coincidencias FROM f03.search_public_offers_terms('{paracetamol,tableta}','{500,mg,10}',NULL,NULL,1)`))[0].coincidencias;
    ok('T003 · la base ordena por coincidencias antes del límite (la primera es exacta)', rankedFirst === 5, rankedFirst);

    // Sugerencias (FR-007) contra la base real.
    const suggest = new SuggestPublicOffers(new PgPublicOfferRepository(test, { exposeVerifiedLocation: true }));
    const seen = new Set();
    for (const typed of ['pa', 'para', 'parac', 'paracetamol 5', 'am', 'amox', 'ib', 'ibu', 'ac', 'acido', 'asp', 'paracetamol 500', 'amoxicilina caps'])
      for (const item of (await suggest.execute(typed)).suggestions) seen.add(item.text);
    const empty = [];
    for (const text of seen) { const r = await search(text); if (r.paginacion.total === 0 || r.coincidencia !== 'EXACTA') empty.push([text, r.coincidencia]); }
    console.log(JSON.stringify({ sugerencias: [...seen] }));
    ok(`T008 · las ${seen.size} sugerencias de la base real llevan a ≥ 1 resultado exacto`, seen.size >= 10 && empty.length === 0, empty);
  });
  console.log(JSON.stringify({ database, passed, results }, null, 1));
} finally {
  if (test) await test.end().catch(() => undefined);
  const mark = (await admin.query(`SELECT shobj_description(oid,'pg_database') AS m FROM pg_database WHERE datname=$1`, [database])).rows[0]?.m;
  if (mark === MARKER && !FORBIDDEN.includes(database)) {
    await admin.query(`DROP DATABASE "${database}" WITH (FORCE)`);
    dropped = (await admin.query('SELECT count(*)::int AS n FROM pg_database WHERE datname=$1', [database])).rows[0].n === 0;
  }
  const demo = (await admin.query(`SELECT count(*)::int AS n FROM pg_database WHERE datname='farmafind_f01_test_d0570879cf41'`)).rows[0].n;
  console.log(JSON.stringify({ baseEfimera: database, borrada: dropped, demoSigueExistiendo: demo === 1 }));
  await admin.end();
}
