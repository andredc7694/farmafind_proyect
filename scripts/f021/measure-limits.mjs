/**
 * F02.1 — medición de tiempo y memoria con archivos al límite de F02 (5 MiB, 5000 filas, 50 columnas).
 * Solo datos ficticios en .cache/f021-perf (ignorado por Git). No usa base de datos ni red.
 * Mide inspección + selección + sugerencia de mapeo + conciliación en proceso hijo limpio por caso.
 * Uso: node scripts/f021/measure-limits.mjs [repeticiones=3]
 */
import { mkdirSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../../', import.meta.url));
const dir = path.join(root, '.cache/f021-perf');
const maxBytes = 5 * 1024 * 1024;
const core = ['nombre', 'concentracion', 'presentacion', 'clasificacion', 'precio', 'cantidad'];

if (process.argv[2] === '--child') {
  const [, , , file, kind, sheetName, headerRow] = process.argv;
  const { readFileSync } = await import('node:fs');
  const { inspectInventoryFile, selectInventoryFile } =
    await import('../../backend/dist/modules/inventario/infrastructure/file-parser.js');
  const { suggestImportMapping, reconcileImportRows } =
    await import('../../backend/dist/modules/inventario/domain/importacion.js');
  const { catalogKey } = await import('../../backend/dist/modules/medicamentos/contracts/reference.js');
  const bytes = readFileSync(file);
  const name = `medicion.${kind}`;
  const catalog = ['tabletas', 'jarabe'].map((presentation, index) => ({ id: `ref-${index}`, state: 'ACTIVO',
    key: catalogKey({ name: 'producto ficticio', concentration: '10 mg', presentation, classification: 'venta libre' }) }));
  const out = { bytes: bytes.length };
  const lap = (label, start) => { out[label] = Math.round(Number(process.hrtime.bigint() - start) / 1e6); };
  const total = process.hrtime.bigint();
  try {
    let t = process.hrtime.bigint();
    const inspected = await inspectInventoryFile(bytes, name); lap('inspeccion_ms', t);
    t = process.hrtime.bigint();
    const parsed = await selectInventoryFile(bytes, name, inspected, { sheet: sheetName, headerRow: Number(headerRow) });
    lap('seleccion_ms', t);
    t = process.hrtime.bigint();
    const { mapping } = suggestImportMapping(parsed.headers);
    const rows = reconcileImportRows(parsed, { ...mapping }, catalog, 'farmacia-ficticia');
    lap('conciliacion_ms', t);
    out.filas = parsed.rows.length; out.columnas = parsed.headers.length;
    out.incidencias = rows.reduce((sum, row) => sum + row.incidents.length, 0);
    out.resultado = 'procesado';
  } catch (error) { out.resultado = `rechazado: ${error.message}`; }
  lap('total_ms', total);
  out.pico_rss_mib = Math.round(process.resourceUsage().maxRSS / 1024 * 10) / 10;
  out.heap_final_mib = Math.round(process.memoryUsage().heapUsed / 1048576 * 10) / 10;
  console.log(JSON.stringify(out));
  process.exit(0);
}

const { default: ExcelJS } = await import('@excel.js/exceljs');
mkdirSync(dir, { recursive: true });

function csvRows(rows, filler) {
  const header = [...core, ...Array.from({ length: 44 }, (_, i) => `extra_${String(i + 1).padStart(2, '0')}`)];
  const lines = [header.join(',')];
  for (let i = 0; i < rows; i++) {
    const known = i < 2;
    const row = [known ? 'producto ficticio' : `producto ficticio ${i}`, '10 mg', known && i === 1 ? 'jarabe' : 'tabletas',
      'venta libre', i % 7 === 0 ? '' : '12.50', i % 11 === 0 ? '' : String(i % 90),
      ...Array.from({ length: 44 }, () => filler)];
    lines.push(row.join(','));
  }
  return lines.join('\n') + '\n';
}

function fitCsv(rows) {
  for (let length = 40; length >= 1; length--) {
    const text = csvRows(rows, 'x'.repeat(length));
    if (Buffer.byteLength(text) <= maxBytes) return text;
  }
  throw new Error('No cabe');
}

async function xlsx(sheets) {
  const workbook = new ExcelJS.Workbook();
  for (const { name, rows, cols } of sheets) {
    const sheet = workbook.addWorksheet(name);
    sheet.addRow([...core, ...Array.from({ length: cols - 6 }, (_, i) => `extra_${i + 1}`)]);
    for (let i = 0; i < rows; i++) {
      sheet.addRow([i < 2 ? 'producto ficticio' : `producto ficticio ${i}`, '10 mg', i === 1 ? 'jarabe' : 'tabletas',
        'venta libre', i % 7 === 0 ? '' : 12.5, i % 11 === 0 ? '' : i % 90,
        ...Array.from({ length: cols - 6 }, (_, c) => `valor ${i}-${c} ${'y'.repeat(18)}`)]);
    }
  }
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

const cases = [
  { id: 'csv-5000-filas-50-col-cerca-5MiB', kind: 'csv', sheet: 'CSV', header: 1, data: () => fitCsv(5000) },
  { id: 'xlsx-5000-filas-50-col', kind: 'xlsx', sheet: 'Inventario', header: 1,
    data: () => xlsx([{ name: 'Inventario', rows: 5000, cols: 50 }]) },
  { id: 'xlsx-5-hojas-1000-filas', kind: 'xlsx', sheet: 'Hoja3', header: 1,
    data: () => xlsx([1, 2, 3, 4, 5].map(n => ({ name: `Hoja${n}`, rows: 1000, cols: 20 }))) },
  { id: 'rechazo-csv-5001-filas', kind: 'csv', sheet: 'CSV', header: 1, data: () => csvRows(5001, 'x') },
  { id: 'rechazo-csv-mayor-5MiB', kind: 'csv', sheet: 'CSV', header: 1,
    data: () => csvRows(5000, 'x'.repeat(40)) + 'x'.repeat(maxBytes) },
];
const repetitions = Number(process.argv[2] ?? 3);
const median = list => [...list].sort((a, b) => a - b)[Math.floor(list.length / 2)];
const report = [];
for (const item of cases) {
  const file = path.join(dir, `${item.id}.${item.kind}`);
  if (!existsSync(file)) writeFileSync(file, await item.data());
  const runs = [];
  for (let i = 0; i < repetitions; i++) {
    const child = spawnSync(process.execPath, [fileURLToPath(import.meta.url), '--child', file, item.kind,
      item.sheet, String(item.header)], { cwd: root, encoding: 'utf8', maxBuffer: 1 << 20 });
    if (child.status !== 0) throw new Error(`Falló ${item.id}: ${child.stderr}`);
    runs.push(JSON.parse(child.stdout.trim().split('\n').pop()));
  }
  const first = runs[0];
  report.push({ caso: item.id, tamaño_bytes: statSync(file).size, resultado: first.resultado, filas: first.filas,
    columnas: first.columnas, incidencias: first.incidencias,
    total_ms: { min: Math.min(...runs.map(r => r.total_ms)), mediana: median(runs.map(r => r.total_ms)), max: Math.max(...runs.map(r => r.total_ms)) },
    inspeccion_ms: median(runs.map(r => r.inspeccion_ms)), seleccion_ms: median(runs.map(r => r.seleccion_ms)),
    conciliacion_ms: median(runs.map(r => r.conciliacion_ms)),
    pico_rss_mib: { mediana: median(runs.map(r => r.pico_rss_mib)), max: Math.max(...runs.map(r => r.pico_rss_mib)) } });
}
console.log(JSON.stringify({ node: process.version, plataforma: `${process.platform} ${process.arch}`, repeticiones: repetitions, report }, null, 2));
