import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { createInventoryClient } from '../../src/inventory/inventory-client.js';
import { ImportPreview } from '../../src/inventory/ImportPreview.jsx';
import { ImportHistory } from '../../src/inventory/ImportHistory.jsx';
import { InventoryView } from '../../src/inventory/InventoryView.jsx';

const response = (status, body = null) => ({ ok: status >= 200 && status < 300,
  status, json: async () => body });

describe('interacciones mínimas de inventario F02', () => {
  it('consulta catálogo y stock propio usando solo cookies del mismo origen', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(response(200, [{ id: 'med1' }]))
      .mockResolvedValueOnce(response(200, [{ medicamentoId: 'med1' }]));
    const client = createInventoryClient(fetcher);
    expect(await client.catalog('producto')).toHaveLength(1);
    expect(await client.inventory('alfa')).toHaveLength(1);
    expect(fetcher.mock.calls[0][0]).toContain('q=producto');
    expect(fetcher.mock.calls[1]).toEqual(['/api/v1/farmacias/alfa/inventario',
      { credentials: 'same-origin', cache: 'no-store' }]);
  });

  it('cambio manual, vista previa y confirmación piden CSRF en cada escritura', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(response(200, { csrfToken: 'csrf-1' }))
      .mockResolvedValueOnce(response(200, { cantidadFisica: 5 }))
      .mockResolvedValueOnce(response(200, { csrfToken: 'csrf-2' }))
      .mockResolvedValueOnce(response(200, { importacionId: 'imp1' }))
      .mockResolvedValueOnce(response(200, { csrfToken: 'csrf-3' }))
      .mockResolvedValueOnce(response(200, { estado: 'CONFIRMADA' }));
    const client = createInventoryClient(fetcher);
    await client.review('alfa', 'med1', { precioReferencial: 12.5, cantidadFisica: 5, motivo: 'Conteo' });
    const file = new Blob(['nombre\nProducto ficticio\n'], { type: 'text/csv' });
    await client.preview('alfa', file, { nombre: 'nombre' });
    await client.confirm('alfa', 'imp1');
    expect(fetcher.mock.calls[1][1]).toMatchObject({ method: 'PUT', credentials: 'same-origin',
      headers: { 'X-CSRF-Token': 'csrf-1' } });
    expect(fetcher.mock.calls[3][1]).toMatchObject({ method: 'POST', credentials: 'same-origin',
      headers: { 'X-CSRF-Token': 'csrf-2' } });
    expect(fetcher.mock.calls[3][1].body).toBeInstanceOf(FormData);
    expect(fetcher.mock.calls[3][1].headers['Content-Type']).toBeUndefined();
    expect(fetcher.mock.calls[5][1]).toMatchObject({ method: 'POST',
      headers: { 'X-CSRF-Token': 'csrf-3' } });
  });

  it('no revela detalles privados del servidor en errores ni en la vista previa', async () => {
    const client = createInventoryClient(vi.fn().mockResolvedValue(response(404, { secret: 'privado' })));
    await expect(client.inventory('beta')).rejects.toThrow('No tienes acceso');
    const html = renderToStaticMarkup(<ImportPreview busy={false} onPreview={() => {}}
      onConfirm={() => {}} preview={{ importacionId: 'imp1', estado: 'VISTA_PREVIA',
        caducaEn: '2026-11-12T13:00:00Z', filas: [{ line: 2, errorCode: 'VALOR_INVALIDO' }],
        errores: [{ fila: 2, codigo: 'VALOR_INVALIDO' }] }} />);
    expect(html).toContain('Un error bloquea el archivo completo');
    expect(html).toContain('VALOR_INVALIDO');
    expect(html).toContain('disabled');
    expect(renderToStaticMarkup(<ImportHistory records={[]} />)).toContain('Sin importaciones');
    expect(renderToStaticMarkup(<InventoryView pharmacyId="alfa" />)).toContain('Cargando inventario');
  });
});
