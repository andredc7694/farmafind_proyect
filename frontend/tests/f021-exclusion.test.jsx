// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ImportPreview } from '../src/inventory/ImportPreview.jsx';
import { exclusionSummary } from '../src/inventory/ExclusionConfirm.jsx';
import { createInventoryClient } from '../src/inventory/inventory-client.js';

afterEach(cleanup);

const row = (line, errorCode, extra = {}) => ({ line, errorCode, medicationId: errorCode === 'REFERENCIA_NO_CONCILIADA' ? null : 'm1',
  priceCents: 100, physicalQuantity: 5, producto: { nombre: `fila ${line}` }, ...extra });
const preview = filas => ({ importacionId: 'p1', estado: 'VISTA_PREVIA', caducaEn: new Date().toISOString(), filas,
  errores: filas.filter(item => item.errorCode).map(item => ({ fila: item.line, codigo: item.errorCode })), incidencias: [] });
const show = (filas, props = {}) => {
  const onConfirm = vi.fn();
  render(<ImportPreview busy={false} onPreview={() => {}} onConfirm={onConfirm} preview={preview(filas)} {...props} />);
  return onConfirm;
};

describe('exclusión explícita en la vista previa', () => {
  const mixed = [row(2, null), row(3, 'FILA_DUPLICADA', { priceCents: 200 }), row(4, 'FILA_DUPLICADA'), row(5, 'REFERENCIA_NO_CONCILIADA')];

  it('cuenta listas, duplicadas, pendientes y repetidas con otro precio o stock', () => {
    expect(exclusionSummary(mixed)).toEqual({ ready: 1, duplicated: 2, pending: 1, blocking: 0, different: 1 });
  });

  it('pide aceptar los números exactos y cancelar no envía nada', () => {
    const onConfirm = show(mixed);
    expect(screen.getByRole('button', { name: 'Confirmar archivo completo' }).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Excluir las 3 filas (2 por revisar (duplicadas) y 1 de pendientes de catálogo) y confirmar la fila lista' }));
    expect(screen.getByText(/Se importarán 1 fila y quedarán fuera 3 filas/)).toBeTruthy();
    expect(screen.getByText(/En 1 fila repetida el precio o el stock es distinto/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.queryByRole('group', { name: 'Confirmar exclusión' })).toBeNull();
  });

  it('al aceptar envía la decisión con sus conteos', () => {
    const onConfirm = show([row(2, null), row(3, null), row(4, 'FILA_DUPLICADA')]);
    fireEvent.click(screen.getByRole('button', { name: 'Excluir la fila por revisar y confirmar las 2 listas' }));
    expect(onConfirm).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Sí, excluir 1 y confirmar 2' }));
    expect(onConfirm).toHaveBeenCalledWith('p1', { duplicadas: 1, pendientes: 0 });
  });

  it.each(['VALOR_INVALIDO', 'REFERENCIA_INVALIDA', 'REFERENCIA_AMBIGUA', 'FARMACIA_AJENA'])(
    'con una fila %s no ofrece excluir y la confirmación sigue bloqueada', code => {
      show([row(2, null), row(3, 'FILA_DUPLICADA'), row(4, code)]);
      expect(screen.queryByRole('button', { name: /Excluir/ })).toBeNull();
      expect(screen.getByText(/no se pueden excluir/)).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Confirmar archivo completo' }).disabled).toBe(true);
    });

  it('sin permiso para confirmar, o sin filas listas, no hay botón de exclusión', () => {
    show([row(2, null), row(3, 'FILA_DUPLICADA')], { canConfirm: false });
    expect(screen.queryByRole('button', { name: /Excluir/ })).toBeNull();
    cleanup();
    show([row(2, 'REFERENCIA_NO_CONCILIADA')]);
    expect(screen.queryByRole('button', { name: /Excluir/ })).toBeNull();
    expect(screen.getByText('No hay ninguna fila lista para confirmar.')).toBeTruthy();
  });

  it('el cliente envía la exclusión solo cuando se decidió', async () => {
    const fetcher = vi.fn().mockImplementation(async url => ({ ok: true, status: 200, json: async () => (url.endsWith('/csrf') ? { csrfToken: 't' } : {}) }));
    const client = createInventoryClient(fetcher);
    await client.confirm('alfa', 'imp1');
    expect(fetcher.mock.calls[1][1].body).toBeUndefined();
    await client.confirm('alfa', 'imp1', { duplicadas: 2, pendientes: 0 });
    expect(JSON.parse(fetcher.mock.calls[3][1].body)).toEqual({ excluir: { duplicadas: 2, pendientes: 0 } });
  });
});
