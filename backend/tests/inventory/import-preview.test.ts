import { describe, expect, it } from 'vitest';
import ExcelJS from '@excel.js/exceljs';
import { parseInventoryFile } from '../../src/modules/inventario/infrastructure/file-parser.js';
import { reconcileImportRows } from '../../src/modules/inventario/domain/importacion.js';
import { createMedicationReference } from '../../src/modules/medicamentos/domain/medicamento.js';

const headers = ['nombre','concentracion','presentacion','clasificacion','precio','cantidad'];
const mapping = { nombre: 'nombre', concentracion: 'concentracion', presentacion: 'presentacion',
  clasificacion: 'clasificacion', precioReferencial: 'precio', cantidadFisica: 'cantidad' };
const catalog = [{ ...createMedicationReference({ name: 'producto ficticio', concentration: '10 mg',
  presentation: 'tabletas', classification: 'venta libre' }), id: 'med1' }];

describe('vista previa de importación F02', () => {
  it('acepta CSV y XLSX ficticios, con mapeo explícito y sin evaluar fórmulas', async () => {
    const csv = Buffer.from(`${headers.join(',')}\nproducto ficticio,10 mg,tabletas,venta libre,12.50,5\n`);
    const parsed = await parseInventoryFile(csv, 'inventario.csv');
    expect(parsed.rows).toHaveLength(1);
    expect(reconcileImportRows(parsed, mapping, catalog, 'alfa')[0]).toMatchObject({
      medicationId: 'med1', priceCents: 1250, physicalQuantity: 5, errorCode: null,
    });
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Inventario');
    sheet.addRow(headers); sheet.addRow(['producto ficticio','10 mg','tabletas','venta libre',12.5,5]);
    const xlsx = Buffer.from(await workbook.xlsx.writeBuffer());
    expect((await parseInventoryFile(xlsx, 'inventario.xlsx')).rows).toHaveLength(1);
    sheet.getCell('E2').value = { formula: '1+1', result: 2 };
    await expect(parseInventoryFile(Buffer.from(await workbook.xlsx.writeBuffer()), 'formula.xlsx')).rejects.toThrow();
  });

  it('rechaza filas duplicadas, ambiguas, farmacia ajena y rangos inválidos sin stock', () => {
    const parsed = { headers: [...headers, 'farmacia_id'], rows: [
      ['producto ficticio','10 mg','tabletas','venta libre','12.50','5','beta'],
      ['producto ficticio','10 mg','tabletas','venta libre','-1','-2','alfa'],
    ] };
    const result = reconcileImportRows(parsed,
      { ...mapping, farmaciaId: 'farmacia_id' }, catalog, 'alfa');
    expect(result.every(row => row.errorCode !== null)).toBe(true);
    expect(result[0].errorCode).toBe('FARMACIA_AJENA');
    expect(result[1].errorCode).toBe('VALOR_INVALIDO');
    const ambiguous = reconcileImportRows({ headers, rows: [
      ['producto ficticio','10 mg','tabletas','venta libre','12.50','5'],
    ] }, mapping, [...catalog, { ...catalog[0], id: 'other' }], 'alfa');
    expect(ambiguous[0].errorCode).toBe('REFERENCIA_AMBIGUA');
    const duplicate = reconcileImportRows({ headers, rows: [
      ['producto ficticio','10 mg','tabletas','venta libre','12.50','5'],
      ['producto ficticio','10 mg','tabletas','venta libre','12.50','5'],
    ] }, mapping, catalog, 'alfa');
    expect(duplicate[1].errorCode).toBe('FILA_DUPLICADA');
    expect(() => reconcileImportRows({ headers: ['nombre','nombre'], rows: [['a','b']] },
      mapping, catalog, 'alfa')).toThrow('Encabezados duplicados');
    expect(() => reconcileImportRows({ headers, rows: [parsed.rows[0]] },
      { ...mapping, nombre: 'inexistente' }, catalog, 'alfa')).toThrow('Mapeo incompleto');
  });

  it('rechaza formato, tamaño y CSV malformado', async () => {
    await expect(parseInventoryFile(Buffer.from('x'), 'archivo.txt')).rejects.toThrow();
    await expect(parseInventoryFile(Buffer.alloc(5 * 1024 * 1024 + 1), 'grande.csv')).rejects.toThrow();
    await expect(parseInventoryFile(Buffer.from('a,b\n"sin cerrar'), 'malo.csv')).rejects.toThrow();
    await expect(parseInventoryFile(Buffer.from('no es zip'), 'malo.xlsx')).rejects.toThrow();
  });
});
