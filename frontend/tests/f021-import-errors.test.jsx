import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ImportPreview } from '../src/inventory/ImportPreview.jsx';

describe('F02.1: informe accesible de importación', () => {
  it('muestra dos causas distintas para precio y cantidad sin valores privados', () => {
    const html = renderToStaticMarkup(<ImportPreview busy={false} onPreview={() => {}}
      onConfirm={() => {}} preview={{ importacionId: 'demo', estado: 'VISTA_PREVIA',
        caducaEn: new Date().toISOString(), filas: [{ line: 7, errorCode: 'VALOR_INVALIDO' }],
        errores: [{ fila: 7, codigo: 'VALOR_INVALIDO' }], incidencias: [
          { line: 7, column: 'precio', field: 'precioReferencial', code: 'PRECIO_REQUERIDO', title: 'Falta el precio',
            cause: 'La celda está vacía', action: 'Completa un precio válido y vuelve a validar',
            supportCode: 'F021-PRECIO_REQUERIDO' },
          { line: 7, column: 'cantidad', field: 'cantidadFisica', code: 'CANTIDAD_REQUERIDA', title: 'Falta la cantidad',
            cause: 'La celda está vacía', action: 'Completa la cantidad y vuelve a validar',
            supportCode: 'F021-CANTIDAD_REQUERIDA' },
        ] }} />);
    expect(html).toContain('2 incidencias');
    expect(html).toContain('Fila 7, columna precio, campo precioReferencial: Falta el precio');
    expect(html).toContain('Fila 7, columna cantidad, campo cantidadFisica: Falta la cantidad');
    expect(html).not.toContain('Producto ficticio');
    expect(html).toContain('disabled');
  });
});
