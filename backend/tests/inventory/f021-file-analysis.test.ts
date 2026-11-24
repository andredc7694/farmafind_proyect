import { describe, expect, it } from 'vitest';
import ExcelJS from '@excel.js/exceljs';
import { inspectInventoryFile, selectInventoryFile } from '../../src/modules/inventario/infrastructure/file-parser.js';

describe('F02.1: inspección acotada de archivos', () => {
  it('propone hojas y encabezados desplazados sin escribir inventario', async () => {
    const workbook = new ExcelJS.Workbook();
    const notes = workbook.addWorksheet('Notas');
    notes.addRow(['Documento ficticio']);
    const stock = workbook.addWorksheet('Inventario');
    stock.addRow(['Archivo de prueba']);
    stock.addRow(['Producto', 'Concentración', 'Presentación', 'Clasificación', 'Precio', 'Stock']);
    stock.addRow(['Producto ficticio', '10 mg', 'tabletas', 'venta libre', 12.5, 3]);
    const bytes = Buffer.from(await workbook.xlsx.writeBuffer());
    const inspected = await inspectInventoryFile(bytes, 'ejemplo.xlsx');
    expect(inspected.sheets.map(sheet => sheet.name)).toEqual(['Notas', 'Inventario']);
    expect(inspected.sheets[1].headerRows).toContain(2);
    expect(selectInventoryFile(bytes, 'ejemplo.xlsx', inspected, { sheet: 'Inventario', headerRow: 2 }))
      .resolves.toMatchObject({ headers: ['Producto', 'Concentración', 'Presentación', 'Clasificación', 'Precio', 'Stock'],
        rows: [['Producto ficticio', '10 mg', 'tabletas', 'venta libre', '12.5', '3']] });
  });

  it('conserva encabezado desplazado en CSV y rechaza huella ajena', async () => {
    const bytes = Buffer.from('Archivo ficticio\nProducto,Precio,Stock\nEjemplo,5.20,2\n');
    const inspected = await inspectInventoryFile(bytes, 'ejemplo.csv');
    expect(inspected.sheets[0].headerRows).toContain(2);
    const selected = await selectInventoryFile(bytes, 'ejemplo.csv', inspected, { sheet: 'CSV', headerRow: 2 });
    expect(selected.rows).toEqual([['Ejemplo', '5.20', '2']]);
    await expect(selectInventoryFile(Buffer.from('otro'), 'ejemplo.csv', inspected,
      { sheet: 'CSV', headerRow: 2 })).rejects.toThrow('Archivo distinto');
  });

  it('informa la línea física de un registro CSV tras un campo entrecomillado multilínea', async () => {
    const bytes = Buffer.from('Nota,"en dos\nlíneas"\nnombre,precio,cantidad\nEjemplo,5,2\n');
    const inspected = await inspectInventoryFile(bytes, 'lineas.csv');
    expect(inspected.sheets[0].headerRows).toContain(3);
    const parsed = await selectInventoryFile(bytes, 'lineas.csv', inspected, { sheet: 'CSV', headerRow: 3 });
    expect(parsed.sourceLines).toEqual([4]);
  });

  it('mantiene límites y rechaza fórmulas aun en hojas no seleccionadas', async () => {
    const workbook = new ExcelJS.Workbook();
    workbook.addWorksheet('No seleccionada').addRow([{ formula: '1+1', result: 2 }]);
    const sheet = workbook.addWorksheet('Inventario');
    sheet.addRow(['Producto', 'Precio']); sheet.addRow(['Ejemplo', 2]);
    await expect(inspectInventoryFile(Buffer.from(await workbook.xlsx.writeBuffer()), 'formula.xlsx'))
      .rejects.toThrow('Celda XLSX no permitida');
    await expect(inspectInventoryFile(Buffer.alloc(5 * 1024 * 1024 + 1), 'grande.csv'))
      .rejects.toThrow('Archivo excede límites');
    const wide = new ExcelJS.Workbook();
    const tooWide = wide.addWorksheet('Ancha');
    tooWide.addRow(Array.from({ length: 51 }, (_, index) => `col${index}`));
    tooWide.addRow(Array.from({ length: 51 }, () => 'x'));
    await expect(inspectInventoryFile(Buffer.from(await wide.xlsx.writeBuffer()), 'ancha.xlsx'))
      .rejects.toThrow('XLSX excede límites');
  });

  it('conserva dos hojas igualmente plausibles para selección explícita', async () => {
    const workbook = new ExcelJS.Workbook();
    for (const name of ['Alfa', 'Beta']) {
      const sheet = workbook.addWorksheet(name);
      sheet.addRow(['nombre', 'precio', 'cantidad']);
      sheet.addRow(['ficticio', 1, 2]);
    }
    const result = await inspectInventoryFile(Buffer.from(await workbook.xlsx.writeBuffer()), 'ambiguo.xlsx');
    expect(result.sheets.map(sheet => sheet.name)).toEqual(['Alfa', 'Beta']);
    expect(result.sheets.every(sheet => sheet.headerRows.includes(1))).toBe(true);
  });
});
