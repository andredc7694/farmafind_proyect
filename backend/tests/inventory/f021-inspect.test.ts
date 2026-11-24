import { describe, expect, it, vi } from 'vitest';
import { InspectImport } from '../../src/modules/inventario/application/inspect-import.js';
import { inspectInventoryFile, selectInventoryFile } from '../../src/modules/inventario/infrastructure/file-parser.js';

describe('F02.1: caso de uso de inspección', () => {
  const bytes = Buffer.from('Medicamento,Concentración,Presentación,Clasificación,Precio,Stock\nProducto ficticio,10 mg,tabletas,venta libre,2,3\n');
  const files = { inspect: inspectInventoryFile, select: selectInventoryFile };

  it('exige autorización de la farmacia antes de leer el archivo', async () => {
    const authorize = vi.fn().mockRejectedValue(new Error('denegado'));
    await expect(new InspectImport({ authorize }, files).run('sesion', 'beta', bytes, 'demo.csv')).rejects.toThrow();
    expect(authorize).toHaveBeenCalledWith('sesion', 'beta');
  });

  it('devuelve propuestas sin valores de inventario ni persistencia', async () => {
    const authorize = vi.fn().mockResolvedValue(undefined);
    const result = await new InspectImport({ authorize }, files).run('sesion', 'alfa', bytes, 'demo.csv');
    expect(result.candidatos[0]).toMatchObject({ sheet: 'CSV', headerRow: 1, matchedFields: 6 });
    expect(JSON.stringify(result)).not.toContain('Producto ficticio');
    expect(result.huella).toMatch(/^[0-9a-f]{64}$/);
  });
});
