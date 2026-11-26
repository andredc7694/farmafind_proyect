// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';

const summary = vi.hoisted(() => ({ reservations: vi.fn(), inventory: vi.fn() }));
vi.mock('../../src/pharmacies/summary-client.js', () => ({ createSummaryClient: () => summary }));
vi.mock('../../src/inventory/InventoryView.jsx', () => ({ InventoryView: ({ pharmacyId, capabilities }) => <div data-testid="inventory" data-pharmacy={pharmacyId} data-caps={capabilities.join(',')} /> }));
vi.mock('../../src/identity/StaffAdmin.jsx', () => ({ StaffAdmin: ({ pharmacyId }) => <div data-testid="staff" data-pharmacy={pharmacyId} /> }));
vi.mock('../../src/geolocation/LocationAdmin.jsx', () => ({ LocationAdmin: ({ pharmacyId }) => <div data-testid="location" data-pharmacy={pharmacyId} /> }));
vi.mock('../../src/reservations/PharmacyReservations.jsx', () => ({ PharmacyReservations: props =>
  <div data-testid="reservations" data-pharmacy={props.pharmacyId} data-tab={props.initialTab ?? 'queue'} data-settings={String(props.showSettings)} /> }));
import { PharmacyPanel } from '../../src/pharmacies/PharmacyPanel.jsx';

afterEach(() => { cleanup(); vi.clearAllMocks(); });

const ownerCodes = ['membership.manage', 'inventory.read', 'inventory.write', 'inventory.import.preview', 'inventory.import.confirm',
  'reservation.read', 'reservation.accept', 'reservation.deliver', 'reservation.settings', 'GEO_LOCATION_PROPOSE'];
const alfa = { pharmacyId: 'alfa', pharmacyName: 'Farmacia Alfa', roleCode: 'DUENO', delegationCodes: ownerCodes };
const beta = { pharmacyId: 'beta', pharmacyName: 'Farmacia Beta', roleCode: 'TRABAJADOR', delegationCodes: ['reservation.read', 'reservation.accept'] };
const clients = (memberships, session = { userId: 'u' }) => ({ sessionClient: { session: vi.fn().mockResolvedValue(session), memberships: vi.fn().mockResolvedValue(memberships) },
  reservationsClient: { settings: vi.fn().mockResolvedValue({ pickupWindowHours: 4 }), saveSettings: vi.fn().mockResolvedValue({}) } });
const navLabels = () => within(screen.getByRole('navigation', { name: 'Secciones de la farmacia' })).getAllByRole('button').map(button => button.textContent);

describe('F08.1 panel de farmacia', () => {
  it('sin sesión invita a iniciar sesión y sin tareas lo explica', async () => {
    const anonymous = clients([], null);
    render(<PharmacyPanel {...anonymous} />);
    expect((await screen.findByRole('status')).textContent).toContain('Inicia sesión');
    cleanup();
    render(<PharmacyPanel {...clients([{ pharmacyId: 'x', pharmacyName: 'X', delegationCodes: [] }])} />);
    expect((await screen.findByRole('status')).textContent).toContain('no tiene tareas');
  });

  it('el propietario ve las ocho secciones en el orden de la spec y empieza por el Resumen', async () => {
    summary.reservations.mockResolvedValue({ pending: 3, confirmed: 2, expiringSoon: 1 }); summary.inventory.mockResolvedValue({ products: 9, withoutStock: 4 });
    render(<PharmacyPanel {...clients([alfa])} />);
    await screen.findByText('Resumen de la farmacia');
    expect(navLabels()).toEqual(['Resumen', 'Farmacia y ubicación', 'Inventario', 'Importar', 'Reservas', 'Historial', 'Personal', 'Configuración']);
    expect(await screen.findByText('Pendientes de responder')).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy(); expect(screen.getByText('4')).toBeTruthy();
  });

  it('el trabajador ve solo sus tareas y el Resumen pide solo la lectura que su permiso permite', async () => {
    summary.reservations.mockResolvedValue({ pending: 1, confirmed: 0, expiringSoon: 0 });
    render(<PharmacyPanel {...clients([beta])} />);
    await screen.findByText('Resumen de la farmacia');
    expect(navLabels()).toEqual(['Resumen', 'Reservas', 'Historial']);
    expect(summary.reservations).toHaveBeenCalledWith('beta'); expect(summary.inventory).not.toHaveBeenCalled();
    expect(screen.queryByText('Inventario')).toBeNull(); expect(screen.queryByText('Productos en inventario')).toBeNull();
  });

  it('si el servidor deniega una lectura lo dice sin inventar cifras', async () => {
    summary.reservations.mockRejectedValue(Object.assign(new Error('x'), { status: 403 })); summary.inventory.mockResolvedValue({ products: 1, withoutStock: 0 });
    render(<PharmacyPanel {...clients([alfa])} />);
    expect((await screen.findByRole('alert')).textContent).toContain('No tienes autorización');
    expect(screen.queryByText('Pendientes de responder')).toBeNull(); expect(await screen.findByText('Productos en inventario')).toBeTruthy();
  });

  it('cada sección monta su componente con la farmacia activa; Inventario e Importar reparten las capacidades', async () => {
    summary.reservations.mockResolvedValue({ pending: 0, confirmed: 0, expiringSoon: 0 }); summary.inventory.mockResolvedValue({ products: 0, withoutStock: 0 });
    render(<PharmacyPanel {...clients([alfa])} />);
    await screen.findByText('Resumen de la farmacia');
    fireEvent.click(screen.getByRole('button', { name: 'Inventario' }));
    expect(screen.getByTestId('inventory').getAttribute('data-caps')).not.toContain('inventory.import');
    expect(screen.getByTestId('inventory').getAttribute('data-caps')).toContain('inventory.write');
    fireEvent.click(screen.getByRole('button', { name: 'Importar' }));
    expect(screen.getByTestId('inventory').getAttribute('data-caps')).toBe('inventory.read,inventory.import.preview,inventory.import.confirm'); // la vista exige inventory.read para mostrar el formulario de importación
    fireEvent.click(screen.getByRole('button', { name: 'Reservas' }));
    expect(screen.getByTestId('reservations').getAttribute('data-tab')).toBe('queue'); expect(screen.getByTestId('reservations').getAttribute('data-settings')).toBe('false');
    fireEvent.click(screen.getByRole('button', { name: 'Historial' }));
    expect(screen.getByTestId('reservations').getAttribute('data-tab')).toBe('history');
    fireEvent.click(screen.getByRole('button', { name: 'Personal' })); expect(screen.getByTestId('staff').getAttribute('data-pharmacy')).toBe('alfa');
    fireEvent.click(screen.getByRole('button', { name: 'Farmacia y ubicación' })); expect(screen.getByTestId('location').getAttribute('data-pharmacy')).toBe('alfa');
    fireEvent.click(screen.getByRole('button', { name: 'Configuración' })); expect(await screen.findByLabelText(/Plazo de recogida/)).toBeTruthy();
  });

  it('al cambiar de farmacia se descartan los datos de la anterior y se recalculan las secciones', async () => {
    summary.reservations.mockResolvedValue({ pending: 7, confirmed: 0, expiringSoon: 0 }); summary.inventory.mockResolvedValue({ products: 1, withoutStock: 0 });
    render(<PharmacyPanel {...clients([alfa, beta])} />);
    await screen.findByText('Resumen de la farmacia');
    expect(navLabels()).toHaveLength(8);
    summary.reservations.mockResolvedValue({ pending: 1, confirmed: 0, expiringSoon: 0 });
    fireEvent.click(screen.getByRole('button', { name: 'Farmacia Beta' }));
    await waitFor(() => expect(navLabels()).toEqual(['Resumen', 'Reservas', 'Historial']));
    await waitFor(() => expect(summary.reservations).toHaveBeenLastCalledWith('beta'));
    expect(screen.queryByText('7')).toBeNull();
  });

  it('si se revoca un permiso, la siguiente comprobación quita la sección sin recargar la página', async () => {
    summary.reservations.mockResolvedValue({ pending: 0, confirmed: 0, expiringSoon: 0 }); summary.inventory.mockResolvedValue({ products: 0, withoutStock: 0 });
    const c = clients([alfa]);
    render(<PharmacyPanel {...c} />);
    await screen.findByText('Resumen de la farmacia');
    expect(navLabels()).toContain('Personal');
    c.sessionClient.memberships.mockResolvedValue([{ ...alfa, delegationCodes: ownerCodes.filter(code => code !== 'membership.manage') }]);
    await act(async () => { window.dispatchEvent(new Event('focus')); });
    await waitFor(() => expect(navLabels()).not.toContain('Personal'));
  });
});
