// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { EmptyState, ConfirmDialog } from '../../src/design/Primitives.jsx';
import { CreateReservation } from '../../src/reservations/CreateReservation.jsx';

afterEach(cleanup);

describe('semántica y controles accesibles F08', () => {
  it('conserva etiquetas en la solicitud de reserva y bloquea envío sin farmacia', () => {
    const { rerender } = render(<CreateReservation pharmacyId={null} onCreate={() => {}} busy={false} />);
    expect(screen.getByLabelText('Identificador del medicamento')).toBeTruthy();
    expect(screen.getByLabelText('Cantidad')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Solicitar reserva' }).disabled).toBe(true);
    rerender(<CreateReservation pharmacyId="alfa" onCreate={() => {}} busy />);
    expect(screen.getByRole('button', { name: 'Procesando solicitud…' }).disabled).toBe(true);
  });

  it('el estado vacío contiene encabezado y explicación visible', () => {
    render(<EmptyState title="Sin resultados">Prueba con otra búsqueda.</EmptyState>);
    expect(screen.getByRole('heading', { name: 'Sin resultados' })).toBeTruthy();
    expect(screen.getByText('Prueba con otra búsqueda.')).toBeTruthy();
  });

  it('el diálogo de confirmación identifica la acción y permite cancelar', () => {
    let cancelled = false;
    render(<ConfirmDialog open title="Confirmar cambio" onCancel={() => { cancelled = true; }} onConfirm={() => {}} />);
    expect(screen.getByRole('dialog')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Volver' }));
    expect(cancelled).toBe(true);
  });
});
