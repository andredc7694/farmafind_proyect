// @vitest-environment jsdom
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, cleanup } from '@testing-library/react';

const api = vi.hoisted(() => ({
  catalog: vi.fn(), inventory: vi.fn(), movements: vi.fn(), imports: vi.fn(),
  review: vi.fn(), preview: vi.fn(), confirm: vi.fn(),
}));
vi.mock('../../src/inventory/inventory-client.js', () => ({ createInventoryClient: () => api }));
import { InventoryView } from '../../src/inventory/InventoryView.jsx';

beforeEach(() => {
  cleanup(); vi.clearAllMocks();
  api.catalog.mockResolvedValue([{ id: 'med1', nombre: 'Producto ficticio',
    concentracion: '10 mg', presentacion: 'tabletas' }]);
  api.inventory.mockResolvedValue([]);
  api.movements.mockResolvedValue([]);
  api.imports.mockResolvedValue([]);
  api.review.mockResolvedValue({ cantidadFisica: 5 });
  api.preview.mockResolvedValue({ importacionId: 'imp1', estado: 'VISTA_PREVIA',
    caducaEn: '2026-11-12T13:00:00Z', filas: [{ line: 2, medicationId: 'med1',
      physicalQuantity: 5, priceCents: 1250, errorCode: null }], errores: [] });
  api.confirm.mockResolvedValue({ estado: 'CONFIRMADA' });
});

describe('interacción React F02 sin navegador externo', () => {
  it('consulta y envía una revisión física manual de la farmacia seleccionada', async () => {
    render(<InventoryView pharmacyId="alfa" />);
    await screen.findByText('Revisión física manual');
    fireEvent.change(screen.getByLabelText('Medicamento'), { target: { value: 'med1' } });
    fireEvent.change(screen.getByLabelText('Precio referencial (S/)'), { target: { value: '12.50' } });
    fireEvent.change(screen.getByLabelText('Cantidad física revisada'), { target: { value: '5' } });
    fireEvent.change(screen.getByLabelText('Motivo de revisión'), { target: { value: 'Conteo ficticio' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar revisión' }));
    await waitFor(() => expect(api.review).toHaveBeenCalledWith('alfa','med1',
      { precioReferencial: 12.5, cantidadFisica: 5, motivo: 'Conteo ficticio' }));
  });

  it('previsualiza archivo y confirma solo después de recibir una vista sin errores', async () => {
    render(<InventoryView pharmacyId="alfa" />);
    await screen.findByText('Importar inventario');
    const file = new File(['nombre\nProducto ficticio\n'], 'stock.csv', { type: 'text/csv' });
    fireEvent.change(screen.getByLabelText('Archivo CSV o XLSX'), { target: { files: [file] } });
    fireEvent.submit(screen.getByRole('button', { name: 'Preparar vista previa' }).closest('form'));
    await waitFor(() => expect(api.preview).toHaveBeenCalled());
    await screen.findByText('Vista previa: VISTA_PREVIA');
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar archivo completo' }));
    await waitFor(() => expect(api.confirm).toHaveBeenCalledWith('alfa', 'imp1'));
  });

  it('mantiene secciones permitidas si solo una consulta devuelve denegación', async () => {
    api.inventory.mockRejectedValue(new Error('No autorizado'));
    render(<InventoryView pharmacyId="alfa" />);
    await screen.findByText('Catálogo e inventario de la farmacia');
    expect(screen.getByText('Consulta de existencias no disponible para esta sesión.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Buscar' })).toBeTruthy();
  });
});
