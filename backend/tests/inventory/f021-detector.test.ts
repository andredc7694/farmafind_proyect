import { describe, expect, it, vi } from 'vitest';
import ExcelJS from '@excel.js/exceljs';
import { InspectImport } from '../../src/modules/inventario/application/inspect-import.js';
import { describeFileError, PreviewImport, PreviewInputError } from '../../src/modules/inventario/application/preview-import.js';
import { reconcileImportRows, suggestImportMapping, type ImportMapping } from '../../src/modules/inventario/domain/importacion.js';
import { inspectInventoryFile, parseInventoryFile, selectInventoryFile } from '../../src/modules/inventario/infrastructure/file-parser.js';
import { createMedicationReference } from '../../src/modules/medicamentos/contracts/reference.js';

const files = { inspect: inspectInventoryFile, select: selectInventoryFile };
const inspector = new InspectImport({ authorize: vi.fn().mockResolvedValue(undefined) }, files);

const HEADERS = ['codigo', 'medicamento', 'nombre_generico', 'concentracion', 'forma_farmaceutica', 'presentacion', 'tipo', 'nombre_comercial',
  'laboratorio', 'categoria_terapeutica', 'condicion_venta', 'precio_regular_sol', 'precio_promocional_sol', 'precio_efectivo_sol',
  'precio_por_unidad_sol', 'stock_disponible', 'disponible', 'fecha_actualizacion'];
const generics = ['Carvedilol', 'Aciclovir', 'Ciprofloxacino', 'Ácido fólico', 'Losartán', 'Metformina', 'Omeprazol', 'Loratadina'];
const sales = ['Venta con receta médica', 'Venta sin receta médica', 'Venta bajo receta médica especial'];

/** Archivo ficticio como el del usuario: 3 hojas, 48 filas, mismos encabezados, fechas en una columna no usada. */
async function realistic(extra?: (sheet: ExcelJS.Worksheet) => void) {
  const book = new ExcelJS.Workbook();
  const prices = book.addWorksheet('Precios');
  prices.addRow(HEADERS);
  for (let i = 0; i < 48; i++) {
    const generic = generics[i % generics.length]; const strength = `${5 * (i + 1)} mg`; const pack = `Caja x ${10 + i}`;
    prices.addRow([`MED-${String(i + 1).padStart(5, '0')}`, `${generic} ${strength} Tableta – ${pack}`, generic, strength, 'Tableta', pack, i % 2 ? 'Marca' : 'Genérico', i % 2 ? `Marca ficticia ${i}` : '—',
      `Laboratorio ficticio ${i % 3}`, 'Antibiótico', sales[i % 3], 10.5 + i, i % 4 ? '' : 9.5 + i, 10.5 + i, 0.4, i % 31, i % 31 ? 'Sí' : 'No', new Date('2026-11-01T00:00:00Z')]);
  }
  extra?.(prices);
  const pharmacy = book.addWorksheet('Farmacia');
  pharmacy.addRow(['campo', 'valor']); pharmacy.addRow(['nombre', 'Farmacia ficticia']); pharmacy.addRow(['actualizado', new Date('2026-11-01T00:00:00Z')]);
  const readme = book.addWorksheet('Léeme');
  readme.addRow(['Instrucciones del archivo ficticio']); readme.addRow(['Los precios están en soles.']);
  return Buffer.from(await book.xlsx.writeBuffer());
}
const expected = { nombre: 'nombre_generico', concentracion: 'concentracion', presentacion: 'presentacion', clasificacion: 'condicion_venta',
  precioReferencial: 'precio_regular_sol', cantidadFisica: 'stock_disponible' };

describe('F02.1 enmienda: detector por nombre y contenido', () => {
  it('propone hoja, encabezado y los seis campos solo; ignora «Farmacia» y «Léeme»; la categoría no es la clasificación', async () => {
    const result = await inspector.run('s', 'alfa', await realistic(), 'farma.xlsx');
    expect(result.candidatos[0]).toMatchObject({ sheet: 'Precios', headerRow: 1, matchedFields: 6, preguntas: [] });
    expect(result.candidatos[0].mapping).toEqual(expected);
    expect(Object.values(result.candidatos[0].mapping)).not.toContain('categoria_terapeutica');
    expect(result.hojasIgnoradas).toEqual(['Farmacia', 'Léeme']);
    expect(result.hojasConStock).toEqual([{ hoja: 'Precios', columna: 'stock_disponible' }]);
  });

  it('reconoce encabezados inventados solo por el contenido', () => {
    const headers = ['zz1', 'zz2', 'zz3', 'zz4', 'zz5', 'zz6'];
    const rows = Array.from({ length: 40 }, (_, i) => [`${generics[i % 8]} ${'abcdefgh'[i % 8]}${'ab'[i % 2]}`, `${i + 1} mg`, `Frasco ${10 + i} mL`, sales[i % 3], `S/ ${i + 1}.50`, String(i % 12)]);
    expect(suggestImportMapping(headers, rows).mapping).toEqual({ nombre: 'zz1', concentracion: 'zz2', presentacion: 'zz3',
      clasificacion: 'zz4', precioReferencial: 'zz5', cantidadFisica: 'zz6' });
  });

  it('ante un empate real pregunta solo por ese campo y no lo asigna en silencio', () => {
    const headers = ['nombre', 'concentracion', 'presentacion', 'condicion_venta', 'precio', 'col_a', 'col_b'];
    const rows = Array.from({ length: 20 }, (_, i) => [`${generics[i % 8]}`, `${i + 1} mg`, 'Caja x 10', sales[0], `${i}.50`, String(i), String(i + 3)]);
    const result = suggestImportMapping(headers, rows);
    expect(result.ambiguous).toEqual(['cantidadFisica']);
    expect(result.mapping.cantidadFisica).toBeUndefined();
    expect(Object.keys(result.mapping)).toHaveLength(5);
  });

  it('tolera pequeñas diferencias en el encabezado (tildes, guiones bajos, mayúsculas, una letra)', () => {
    const result = suggestImportMapping(['Nombre_Genérico', 'CONCENTRACIÓN', 'Presentacion', 'Condición de Venta', 'Precio Regular (S/)', 'Stok disponible']);
    expect(Object.keys(result.mapping)).toHaveLength(6);
  });

  it('todos los productos llegan a la vista previa: listos o pendientes de catálogo, sin equipararlos', async () => {
    const bytes = await realistic();
    const inspected = await inspectInventoryFile(bytes, 'farma.xlsx');
    const parsed = await selectInventoryFile(bytes, 'farma.xlsx', inspected, { sheet: 'Precios', headerRow: 1 });
    const catalog = [{ ...createMedicationReference({ name: 'carvedilol', concentration: '5 mg', presentation: 'caja x 10', classification: sales[0].toLowerCase() }), id: 'med-1', state: 'ACTIVO' as const }];
    const rows = reconcileImportRows(parsed, expected as ImportMapping, catalog, 'alfa');
    expect(rows).toHaveLength(48);
    expect(rows.filter(row => row.errorCode === null)).toHaveLength(1);
    expect(rows.filter(row => row.errorCode === 'REFERENCIA_NO_CONCILIADA')).toHaveLength(47);
    expect(rows[0]).toMatchObject({ priceCents: 1050, physicalQuantity: 0, producto: { nombre: 'Carvedilol', concentracion: '5 mg' } });
  });

  it('una fórmula o fecha en una columna usada señala solo esa celda, con hoja, celda, causa y solución', async () => {
    const bytes = await realistic(sheet => { sheet.getRow(3).getCell(12).value = { formula: '1+1', result: 2 }; });
    const inspected = await inspectInventoryFile(bytes, 'farma.xlsx');
    const parsed = await selectInventoryFile(bytes, 'farma.xlsx', inspected, { sheet: 'Precios', headerRow: 1 });
    const rows = reconcileImportRows(parsed, expected as ImportMapping, [], 'alfa');
    const flagged = rows.flatMap(row => row.incidents ?? []).filter(item => item.title === 'Celda no admitida');
    expect(flagged).toHaveLength(1); // las 48 fechas de una columna no usada no molestan
    expect(flagged[0]).toMatchObject({ line: 3, field: 'precioReferencial', cause: 'Hoja «Precios», celda L3: contiene una fórmula' });
    expect(flagged[0].action).toContain('texto o número');
  });

  it('los errores del archivo son específicos (causa y solución), no genéricos', async () => {
    const multi = await realistic();
    await expect(parseInventoryFile(multi, 'farma.xlsx')).rejects.toThrow('una hoja');
    expect(describeFileError(new Error('XLSX debe tener una hoja'))).toContain('varias hojas');
    expect(describeFileError(new Error('XLSX contiene contenido no permitido'))).toContain('macros');
    expect(describeFileError(new Error('Archivo excede límites'))).toContain('5 000 filas');
    await expect(inspectInventoryFile(Buffer.from('no es un libro'), 'x.xlsx')).rejects.toThrow();
  });

  it('repetir la misma vista previa reutiliza la vigente; si ya se confirmó, lo explica', async () => {
    let stored: { id: string; state: 'VISTA_PREVIA' | 'CONFIRMADA'; expiresAt: string } | null = null;
    const create = vi.fn(async () => (stored = { id: 'imp-1', state: 'VISTA_PREVIA', expiresAt: new Date(Date.now() + 600_000).toISOString() }));
    const ports = { imports: { create, findByDigest: vi.fn(async () => stored) }, lookupReferences: vi.fn().mockResolvedValue([]),
      parseFile: parseInventoryFile, inspectFile: inspectInventoryFile, selectFile: selectInventoryFile };
    const preview = new PreviewImport({ run: (_s: string, _p: string, _c: string, work: (value: typeof ports) => unknown) => work(ports) } as never);
    const csv = Buffer.from('nombre,concentracion,presentacion,clasificacion,precio,cantidad\nficticio,1 mg,caja x 1,venta libre,1,1\n');
    const mapping = { nombre: 'nombre', concentracion: 'concentracion', presentacion: 'presentacion', clasificacion: 'clasificacion', precioReferencial: 'precio', cantidadFisica: 'cantidad' };
    const selection = { sheet: 'CSV', headerRow: 1, digest: (await inspectInventoryFile(csv, 'a.csv')).digest };
    const first = await preview.run('s', 'alfa', csv, 'a.csv', mapping, selection);
    const again = await preview.run('s', 'alfa', csv, 'a.csv', mapping, selection);
    expect(again.importacionId).toBe(first.importacionId); expect(create).toHaveBeenCalledOnce();
    stored = { ...stored!, state: 'CONFIRMADA' };
    await expect(preview.run('s', 'alfa', csv, 'a.csv', mapping, selection)).rejects.toSatisfy((error: unknown) => error instanceof PreviewInputError && error.conflict);
  });
});
