// @vitest-environment jsdom
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({ catalog: vi.fn().mockResolvedValue([]), inventory: vi.fn().mockResolvedValue([]),
  movements: vi.fn().mockResolvedValue([]), imports: vi.fn().mockResolvedValue([]) }));
vi.mock('../../src/inventory/inventory-client.js', () => ({ createInventoryClient: () => api }));
import { InventoryView } from '../../src/inventory/InventoryView.jsx';

afterEach(cleanup);

describe('controles de inventario F08', () => {
  it('la sección Importar del panel (lectura + importación, sin escritura) muestra el formulario de importación', async () => {
    render(<InventoryView pharmacyId="alfa" capabilities={['inventory.read', 'inventory.import.preview', 'inventory.import.confirm']} />);
    expect(await screen.findByText('Importar inventario')).toBeTruthy();
    expect(screen.getByLabelText('Archivo CSV o XLSX')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Guardar revisión' })).toBeNull();
  });

  it('no presenta acciones privadas sin capacidad explícita aunque exista una farmacia en la URL', async () => {
    render(<InventoryView pharmacyId="alfa" capabilities={[]} />);
    expect(await screen.findByText('No tienes acceso al inventario de esta farmacia.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Guardar revisión' })).toBeNull();
  });

  it('presenta lectura, pero no escritura ni importación, con solo inventory.read', async () => {
    render(<InventoryView pharmacyId="alfa" capabilities={['inventory.read']} />);
    expect(await screen.findByText('Existencias propias')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Revisión manual' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Guardar revisión' })).toBeNull();
    expect(screen.queryByText('Importar inventario')).toBeNull();
  });
});
