import { describe, expect, it } from 'vitest';
import { reconcileImportRows } from '../../src/modules/inventario/domain/importacion.js';
import { createMedicationReference } from '../../src/modules/medicamentos/domain/medicamento.js';

const mapping = { nombre: 'nombre', concentracion: 'concentracion', presentacion: 'presentacion',
  clasificacion: 'clasificacion', precioReferencial: 'precio', cantidadFisica: 'cantidad' };
const catalog = [{ ...createMedicationReference({ name: 'producto ficticio', concentration: '10 mg',
  presentation: 'tabletas', classification: 'venta libre' }), id: 'med1' }];

describe('F02.1: incidencias localizables', () => {
  it('separa precio y cantidad vacíos sin reflejar valores privados', () => {
    const rows = reconcileImportRows({ headers: ['nombre','concentracion','presentacion','clasificacion','precio','cantidad'],
      rows: [['producto ficticio','10 mg','tabletas','venta libre','','']], sourceLines: [7] }, mapping, catalog, 'alfa');
    expect(rows[0].errorCode).toBe('VALOR_INVALIDO');
    expect(rows[0].line).toBe(7);
    expect(rows[0].incidents).toMatchObject([
      { line: 7, field: 'precioReferencial', column: 'precio', code: 'PRECIO_REQUERIDO' },
      { line: 7, field: 'cantidadFisica', column: 'cantidad', code: 'CANTIDAD_REQUERIDA' },
    ]);
    expect(JSON.stringify(rows[0].incidents)).not.toContain('producto ficticio');
  });
  it('localiza una referencia repetida sin incluir el nombre del producto en el mensaje', () => {
    const parsed = { headers: ['nombre','concentracion','presentacion','clasificacion','precio','cantidad'],
      rows: [
        ['producto ficticio','10 mg','tabletas','venta libre','2','1'],
        ['producto ficticio','10 mg','tabletas','venta libre','2','1'],
      ], sourceLines: [4, 8] };
    const result = reconcileImportRows(parsed, mapping, catalog, 'alfa');
    expect(result[1].errorCode).toBe('FILA_DUPLICADA');
    expect(result[1].incidents).toMatchObject([{ line: 8, field: 'nombre', code: 'FILA_DUPLICADA' }]);
    expect(JSON.stringify(result[1].incidents)).not.toContain('producto ficticio');
  });
});
