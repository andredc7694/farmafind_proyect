// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { LocationReview } from '../../src/geolocation/LocationReview.jsx';

afterEach(cleanup);
const pending = { propuestaId: 'p1', farmaciaId: 'f1', farmaciaNombre: 'Farmacia Alfa', direccionPublicable: 'Jr. 28 de Julio 145', ciudad: 'ayacucho',
  latitud: -13.1631, longitud: -74.2244, precisionMetros: null, fuente: 'Dirección buscada', evidenciaReferencia: null, version: 1, propuestaAt: '2026-11-26T12:00:00.000Z' };
const row = (id, decision, decididoPor) => ({ propuestaId: id, farmaciaNombre: `Farmacia ${id}`, direccion: 'Av. Larco 345', ciudad: 'lima',
  latitud: -12.12, longitud: -77.03, decision, motivo: 'Coincide con la fachada', enviadaAt: '2026-11-25T10:00:00.000Z',
  decididaAt: '2026-11-25T12:00:00.000Z', decididoPor });

describe('F07.1 · «Revisar ubicaciones» con historial (FR-017, FR-018)', () => {
  it('formulario de decisión ordenado: cada campo con su etiqueta propia', async () => {
    render(<LocationReview client={{ list: vi.fn().mockResolvedValue([pending]), history: vi.fn(), decide: vi.fn() }} />);
    await screen.findByText('Farmacia Alfa');
    expect(screen.getByLabelText('Decisión').tagName).toBe('SELECT');
    expect(screen.getByLabelText('Comprobé la dirección y el punto').type).toBe('checkbox');
    expect(screen.getByLabelText('Motivo').tagName).toBe('INPUT');
    expect(screen.getByLabelText('Comprobé la dirección y el punto').closest('label').textContent).not.toContain('Motivo');
  });
  it('filtro «Aprobadas»: muestra los campos aprobados y pagina', async () => {
    const history = vi.fn(async (_estado, pagina) => ({ pagina, porPagina: 20, total: 25,
      filas: pagina === 1 ? [row('Uno', 'APROBADA', 'Tú'), row('Dos', 'APROBADA', 'Otro revisor de FarmaFind')] : [row('Tres', 'APROBADA', 'Tú')] }));
    render(<LocationReview client={{ list: vi.fn().mockResolvedValue([]), history, decide: vi.fn() }} />);
    await screen.findByText('No hay ubicaciones pendientes de revisión.');
    fireEvent.click(screen.getByRole('button', { name: 'Aprobadas' }));
    const card = (await screen.findByText('Farmacia Uno')).closest('li');
    for (const text of ['Av. Larco 345, lima', '-12.120000, -77.030000', 'Aprobada', 'Coincide con la fachada', 'Tú'])
      expect(within(card).getByText(text)).toBeTruthy();
    expect(screen.getByText('Otro revisor de FarmaFind')).toBeTruthy();
    expect(history).toHaveBeenCalledWith('APROBADA', 1);
    expect(screen.getByText('Página 1 de 2')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    expect(await screen.findByText('Farmacia Tres')).toBeTruthy();
    expect(history).toHaveBeenLastCalledWith('APROBADA', 2);
  });
  it('filtro «Rechazadas» vacío y sin permiso', async () => {
    const history = vi.fn().mockResolvedValue({ pagina: 1, porPagina: 20, total: 0, filas: [] });
    render(<LocationReview client={{ list: vi.fn().mockResolvedValue([]), history, decide: vi.fn() }} />);
    await screen.findByText('No hay ubicaciones pendientes de revisión.');
    fireEvent.click(screen.getByRole('button', { name: 'Rechazadas' }));
    expect(await screen.findByText('No hay propuestas rechazadas.')).toBeTruthy();
    cleanup();
    render(<LocationReview client={{ list: vi.fn().mockRejectedValue(Object.assign(new Error('x'), { status: 403 })), history, decide: vi.fn() }} />);
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('No tienes permiso'));
  });
});
