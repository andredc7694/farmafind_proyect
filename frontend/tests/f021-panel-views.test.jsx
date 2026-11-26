// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({ catalog: vi.fn(), inventory: vi.fn(), movements: vi.fn(), imports: vi.fn(),
  importStatus: vi.fn(), review: vi.fn(), profiles: vi.fn() }));
const staff = vi.hoisted(() => ({ list: vi.fn() }));
vi.mock('../src/inventory/inventory-client.js', () => ({ createInventoryClient: () => api }));
vi.mock('../src/identity/staff-client.js', () => ({ createStaffClient: () => staff }));
import { InventoryView } from '../src/inventory/InventoryView.jsx';
import { reasonLabel } from '../src/inventory/Movements.jsx';

const row = (i, extra = {}) => ({ id: `inv${i}`, medicamentoId: `med${i}`, nombre: `producto ${String(i).padStart(2, '0')}`,
  concentracion: '10 mg', presentacion: 'tabletas', clasificacion: 'venta libre', precioReferencial: 2.5,
  cantidadFisica: 20, cantidadComprometida: 0, ultimaRevision: '2026-11-25T10:00:00Z', ...extra });
const record = (id, estado, extra = {}) => ({ importacionId: id, estado, creadaEn: '2026-11-25T10:00:00Z', autorId: 'u1', porMi: true,
  filas: 3, listas: 2, pendientes: 1, conErrores: 0, agregados: 0, actualizados: 0, ...extra });

beforeEach(() => {
  cleanup(); vi.clearAllMocks();
  api.catalog.mockResolvedValue([]); api.inventory.mockResolvedValue([]); api.movements.mockResolvedValue([]);
  api.imports.mockResolvedValue([]); api.profiles.mockResolvedValue([]); staff.list.mockResolvedValue([]);
});
afterEach(cleanup);

describe('Inventario (solo lectura)', () => {
  it('muestra nombres legibles, busca, filtra, pagina, abre el detalle y deja la revisión en un botón secundario', async () => {
    api.inventory.mockResolvedValue([...Array.from({ length: 30 }, (_, i) => row(i)),
      row(30, { nombre: 'ácido fólico', cantidadFisica: 3, cantidadComprometida: 1 }), row(31, { nombre: 'zinc', cantidadFisica: 0 })]);
    const { container } = render(<InventoryView pharmacyId="alfa" section="inventario" capabilities={['inventory.read', 'inventory.write']} />);
    await screen.findByText('32 de 32 productos.', { exact: false });
    expect(container.querySelectorAll('tbody tr')).toHaveLength(25);
    expect(screen.getByText('Producto 00')).toBeTruthy();
    expect(container.textContent).not.toContain('med0');
    expect(screen.queryByRole('button', { name: 'Guardar revisión' })).toBeNull();
    expect(screen.queryByText('Importar inventario')).toBeNull();
    expect(api.imports).not.toHaveBeenCalled(); expect(api.movements).not.toHaveBeenCalled(); expect(api.catalog).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Stock bajo (1)' }));
    expect(screen.getByText('Ácido fólico')).toBeTruthy(); expect(container.querySelectorAll('tbody tr')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Sin stock (1)' }));
    expect(screen.getByText('Zinc')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Todos (32)' }));
    fireEvent.change(screen.getByLabelText('Buscar por nombre'), { target: { value: 'acido' } });
    expect(container.querySelectorAll('tbody tr')).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: 'Ver Ácido fólico 10 mg' }));
    expect(screen.getByText('2 (3 físicas menos 1 comprometidas)')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar precio o stock' }));
    expect(screen.getByLabelText('Medicamento').value).toBe('med30');
    expect(screen.getByLabelText('Cantidad física revisada').value).toBe('3');
  });

  it('sin permiso de escritura no ofrece la revisión manual', async () => {
    api.inventory.mockResolvedValue([row(1)]);
    render(<InventoryView pharmacyId="alfa" section="inventario" capabilities={['inventory.read']} />);
    await screen.findByText('Producto 01');
    expect(screen.queryByRole('button', { name: 'Revisión manual' })).toBeNull();
  });
});

describe('Importar', () => {
  it('deja solo elegir archivo: sin buscador de catálogo, existencias ni historial', async () => {
    render(<InventoryView pharmacyId="alfa" section="importar"
      capabilities={['inventory.read', 'inventory.import.preview', 'inventory.import.confirm']} />);
    expect(await screen.findByLabelText('Archivo CSV o XLSX')).toBeTruthy();
    expect(screen.queryByText('Buscar referencia del catálogo')).toBeNull();
    expect(screen.queryByText('Existencias propias')).toBeNull();
    expect(screen.queryByText('Historial de importaciones')).toBeNull();
    for (const call of [api.catalog, api.inventory, api.imports, api.movements]) expect(call).not.toHaveBeenCalled();
  });
});

describe('Historial', () => {
  it('muestra una tarjeta clara por importación, agrupa las vistas previas y abre qué cambió', async () => {
    api.imports.mockResolvedValue([record('a', 'CONFIRMADA', { porMi: false, autorId: 'u2', agregados: 1, actualizados: 1 }),
      record('b', 'RECHAZADA', { porMi: false, autorId: 'u9' }), record('c', 'VISTA_PREVIA'), record('d', 'EXPIRADA')]);
    staff.list.mockResolvedValue([{ userId: 'u2', displayName: 'Persona Ficticia', alias: 'pf' }]);
    api.importStatus.mockResolvedValue({ incidencias: [], cambios: [
      { nombre: 'zinc', concentracion: '10 mg', presentacion: 'tabletas', added: false, priceBeforeCents: 100, priceAfterCents: 150, quantityBefore: 4, quantityAfter: 9 },
      { nombre: 'ácido', concentracion: '5 mg', presentacion: 'jarabe', added: true, priceBeforeCents: 0, priceAfterCents: 300, quantityBefore: 0, quantityAfter: 2 },
      { nombre: 'igual', concentracion: '1 mg', presentacion: 'gotas', added: false, priceBeforeCents: 100, priceAfterCents: 100, quantityBefore: 1, quantityAfter: 1 }] });
    const { container } = render(<InventoryView pharmacyId="alfa" section="importaciones" capabilities={['inventory.history', 'membership.manage']} />);
    await screen.findByText('Confirmada');
    await screen.findByText('Hecha por: Persona Ficticia');
    expect(screen.getByText('Rechazada')).toBeTruthy();
    expect(screen.getByText('Hecha por: Otra persona de tu farmacia')).toBeTruthy();
    expect(screen.getByText(/Vistas previas sin confirmar: 2\. No guardaron nada/)).toBeTruthy();
    expect(container.querySelector('details').open).toBe(false);
    expect(container.querySelector('details').textContent).toContain('Solo vista previa, no se guardó');
    expect(container.textContent).not.toMatch(/CONFIRMADA|VISTA_PREVIA|EXPIRADA|RECHAZADA/);
    expect(container.textContent).toContain('Filas: 3 · Listas: 2 · Pendientes de catálogo: 1 · Con errores: 0 · Agregados: 1 · Actualizados: 1 · Sin cambios: 0');

    fireEvent.click(screen.getAllByRole('button', { name: 'Ver detalle' })[0]);
    const table = await screen.findByRole('table', { name: 'Qué cambió' });
    expect(api.importStatus).toHaveBeenCalledWith('alfa', 'a');
    expect(within(table).getByText('Actualizado')).toBeTruthy(); expect(within(table).getByText('Agregado')).toBeTruthy();
    expect(table.textContent).toContain('S/ 1.00S/ 1.5049');
    expect(table.textContent).not.toContain('Igual');
    expect(screen.getByText('1 producto venía con el mismo precio y stock: sin cambios.')).toBeTruthy();
  });

  it('los movimientos muestran producto y motivo legibles, nunca identificadores', async () => {
    api.movements.mockResolvedValue([{ id: 'm1', nombre: 'zinc', concentracion: '10 mg', motivo: 'Importación 3f2b8a10-0000-4000-8000-000000000001',
      cantidad_antes: 1, cantidad_despues: 5, precio_antes_centavos: '100', precio_despues_centavos: '200', occurred_at: '2026-11-25T10:00:00Z' }]);
    const { container } = render(<InventoryView pharmacyId="alfa" section="movimientos" capabilities={['inventory.history']} />);
    await waitFor(() => expect(screen.getByText('Importación de archivo')).toBeTruthy());
    expect(screen.getByText('Zinc, 10 mg')).toBeTruthy();
    expect(container.textContent).not.toContain('3f2b8a10');
    expect(reasonLabel('ENTREGA_RESERVA')).toBe('Entrega de una reserva');
    expect(reasonLabel('Conteo')).toBe('Revisión manual: Conteo');
  });

  it('sin inventory.history no muestra el historial aunque se pida la sección', async () => {
    render(<InventoryView pharmacyId="alfa" section="importaciones" capabilities={['inventory.read']} />);
    expect(await screen.findByText('No tienes acceso al inventario de esta farmacia.')).toBeTruthy();
  });
});
