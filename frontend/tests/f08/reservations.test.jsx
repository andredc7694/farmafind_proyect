// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PharmacyReservations } from '../../src/reservations/PharmacyReservations.jsx';

afterEach(cleanup);

function client(queue = []) {
  return { queue: vi.fn().mockResolvedValue(queue), settings: vi.fn().mockResolvedValue({ pickupWindowHours: 4 }),
    saveSettings: vi.fn().mockResolvedValue({ pickupWindowHours: 4 }),
    confirm: vi.fn().mockResolvedValue({}), shortage: vi.fn().mockResolvedValue({}),
    deliver: vi.fn().mockRejectedValue(new Error('Reserva vencida')) };
}

describe('reservas de farmacia F08', () => {
  it('no consulta la cola sin reservation.read aunque se conozca farmaciaId', () => {
    const api = client();
    render(<PharmacyReservations client={api} pharmacyId="alfa" capabilities={[]} />);
    expect(screen.getByText(/no está autorizada/)).toBeTruthy();
    expect(api.queue).not.toHaveBeenCalled();
  });

  it('separa lectura, configuración y transición según capacidades explícitas', async () => {
    const api = client([{ id: 'r1', state: 'PENDIENTE', quantity: 1, pickupExpiresAt: null }]);
    render(<PharmacyReservations client={api} pharmacyId="alfa" capabilities={['reservation.read']} />);
    expect(await screen.findByText('PENDIENTE')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Confirmar' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Guardar plazo' })).toBeNull();
  });

  it('muestra la denegación del servidor al intentar entregar una reserva vencida', async () => {
    const api = client([{ id: 'r2', state: 'CONFIRMADA', quantity: 1,
      pickupExpiresAt: '2020-01-01T00:00:00Z' }]);
    render(<PharmacyReservations client={api} pharmacyId="alfa"
      capabilities={['reservation.read', 'reservation.deliver']} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Entregar' }));
    await waitFor(() => expect(api.deliver).toHaveBeenCalledWith('alfa', 'r2'));
    expect(await screen.findByText(/La operación no se completó/)).toBeTruthy();
  });
});
