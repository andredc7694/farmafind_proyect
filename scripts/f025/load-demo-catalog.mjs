/**
 * SOLO DEMO/TEST: carga en el catálogo de una base TEST de F02.5 los productos distintos de un archivo ficticio.
 * Se niega fuera del clúster y la base TEST marcados. No toca inventario, farmacias, permisos ni producción.
 * Además deja una copia local sin filas repetidas (ignorada por Git) para poder probar la confirmación.
 * Uso: node scripts/f025/load-demo-catalog.mjs <archivo.xlsx|csv> [manual|tecnica]
 */
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import ExcelJS from '@excel.js/exceljs';
import { Client } from 'pg';
import { InspectImport } from '../../backend/dist/modules/inventario/application/inspect-import.js';
import { inspectInventoryFile, selectInventoryFile } from '../../backend/dist/modules/inventario/infrastructure/file-parser.js';
import { createMedicationReference } from '../../backend/dist/modules/medicamentos/contracts/reference.js';
import { assertF025EphemeralDatabase, F025_CLUSTER_NAME, F025_TEST_MARKER } from './test-env.mjs';

const [file, slot = 'manual'] = process.argv.slice(2);
assert(file && ['manual', 'tecnica'].includes(slot), 'Uso: node scripts/f025/load-demo-catalog.mjs <archivo> [manual|tecnica]');
const bytes = readFileSync(file);
const filename = path.basename(file);

const analysis = await new InspectImport({ authorize: async () => {} }, { inspect: inspectInventoryFile, select: selectInventoryFile })
  .run('local', 'local', bytes, filename);
const candidate = analysis.candidatos[0];
assert(candidate && candidate.preguntas.length === 0, 'El archivo no tiene las seis columnas claras; no se carga nada');
const inspected = await inspectInventoryFile(bytes, filename);
const parsed = await selectInventoryFile(bytes, filename, inspected, { sheet: candidate.sheet, headerRow: candidate.headerRow });
const index = Object.fromEntries(Object.entries(candidate.mapping).map(([field, header]) => [field, parsed.headers.indexOf(header)]));

const references = new Map(); const uniqueRows = []; let skipped = 0;
for (const row of parsed.rows) {
  try {
    const reference = createMedicationReference({ name: row[index.nombre], concentration: row[index.concentracion],
      presentation: row[index.presentacion], classification: row[index.clasificacion] });
    if (!references.has(reference.key)) { references.set(reference.key, reference); uniqueRows.push(row); }
  } catch { skipped++; }
}

const dir = new URL('../../.cache/f025-docker/', import.meta.url);
const state = JSON.parse(readFileSync(new URL(slot === 'manual' ? 'state.manual.local.json' : 'state.local.json', dir), 'utf8'));
const secret = readFileSync(new URL('postgres-password.txt', dir), 'utf8').trim();
const url = new URL(`postgresql://127.0.0.1:55431/${state.database}`);
url.username = 'f01_migrator'; url.password = secret;
assertF025EphemeralDatabase(url.toString(), { migration: true });
const client = new Client({ connectionString: url.toString() });
await client.connect();
try {
  const target = (await client.query(`SELECT current_setting('cluster_name') AS cluster,
    (SELECT description FROM pg_shdescription WHERE objoid=(SELECT oid FROM pg_database WHERE datname=current_database())) AS marker`)).rows[0];
  assert.equal(target.cluster, F025_CLUSTER_NAME, 'Solo el clúster TEST F02.5');
  assert.equal(target.marker, F025_TEST_MARKER, 'Solo una base marcada como TEST');
  let added = 0;
  await client.query('BEGIN');
  try {
    for (const item of references.values()) {
      const result = await client.query(`INSERT INTO f02.medicamento(nombre,concentracion,presentacion,clasificacion)
        VALUES($1,$2,$3,$4) ON CONFLICT (nombre,concentracion,presentacion,clasificacion) DO NOTHING`,
      // El catálogo exige texto en minúsculas y con espacios simples (restricciones de f02.medicamento).
      [item.name, item.concentration, item.presentation, item.classification]
        .map(value => value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('es-PE')));
      added += result.rowCount;
    }
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  const total = (await client.query('SELECT count(*)::int AS n FROM f02.medicamento')).rows[0].n;
  console.log(`Base TEST ${slot}: ${parsed.rows.length} filas leídas, ${references.size} productos distintos, ${added} añadidos al catálogo (total ${total}); ${skipped} filas sin datos suficientes.`);
} finally { await client.end(); }

const book = new ExcelJS.Workbook(); const sheet = book.addWorksheet(candidate.sheet);
sheet.addRow([...parsed.headers]);
for (const row of uniqueRows) sheet.addRow(row.map((value, column) => (column === index.precioReferencial || column === index.cantidadFisica) && value !== '' ? Number(value) : value));
const outDir = new URL('imports/', dir); mkdirSync(outDir, { recursive: true });
const out = new URL(`${path.parse(filename).name}-sin-duplicados.xlsx`, outDir);
await book.xlsx.writeFile(out.pathname.replace(/^\/([A-Za-z]:)/, '$1'));
console.log(`Copia sin filas repetidas (${uniqueRows.length} filas): .cache/f025-docker/imports/${path.parse(filename).name}-sin-duplicados.xlsx`);
