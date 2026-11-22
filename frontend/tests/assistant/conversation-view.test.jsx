// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConversationView } from '../../src/assistant/ConversationView.jsx';
import { ConversationClientError } from '../../src/assistant/conversation-client.js';

afterEach(cleanup);

describe('vista conversacional F06.1', () => {
  it('reinicia el identificador vencido para permitir una nueva conversación', async () => {
    const query = vi.fn().mockResolvedValueOnce({ respuesta: 'Primera.', aviso: 'Educativo.', fuentes: [], conversacionId: 'vencido' })
      .mockRejectedValueOnce(new ConversationClientError(422))
      .mockResolvedValueOnce({ respuesta: 'Nueva.', aviso: 'Educativo.', fuentes: [], conversacionId: 'nuevo' });
    render(<ConversationView client={{ query, discard: vi.fn() }} />);
    const box = screen.getByLabelText('¿Qué información deseas consultar?');
    for (const value of ['Ayuda', 'Seguimiento', 'Nueva consulta']) {
      fireEvent.change(box, { target: { value } });
      fireEvent.click(screen.getByRole('button', { name: 'Consultar' }));
      if (value === 'Seguimiento') await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('venció'));
      else await waitFor(() => expect(screen.getByText(value === 'Ayuda' ? 'Primera.' : 'Nueva.')).toBeTruthy());
    }
    expect(query).toHaveBeenNthCalledWith(2, 'Seguimiento', 'vencido');
    expect(query).toHaveBeenNthCalledWith(3, 'Nueva consulta', null);
  });
  it('muestra respuesta educativa, cita y seguimiento', async () => {
    const query = vi.fn().mockResolvedValueOnce({ respuesta: 'Contenido ficticio.', aviso: 'Educativo.',
      fuentes: [{ titulo: 'Ficha TEST', referencia: 'test://ficha/uno', revisadoEl: '2026-11-17' }], conversacionId: 'id-uno' })
      .mockResolvedValueOnce({ respuesta: 'Advertencia ficticia.', aviso: 'Educativo.', fuentes: [], conversacionId: 'id-uno' });
    render(<ConversationView client={{ query, discard: vi.fn() }} />);
    const box = screen.getByLabelText('¿Qué información deseas consultar?');
    fireEvent.change(box, { target: { value: 'Ficha de Producto Ficticio Alfa' } });
    fireEvent.click(screen.getByRole('button', { name: 'Consultar' }));
    await waitFor(() => expect(screen.getByText('Contenido ficticio.')).toBeTruthy());
    expect(screen.getByText(/Ficha TEST/)).toBeTruthy();
    fireEvent.change(box, { target: { value: '¿y sus advertencias?' } });
    fireEvent.click(screen.getByRole('button', { name: 'Consultar' }));
    await waitFor(() => expect(query).toHaveBeenCalledWith('¿y sus advertencias?', 'id-uno'));
  });
  it('presenta rechazo clínico específico y permite borrar', async () => {
    const discard = vi.fn().mockResolvedValue(undefined);
    const query = vi.fn().mockResolvedValue({ respuesta: 'No puedo indicar dosis.', aviso: 'Educativo.', fuentes: [] });
    render(<ConversationView client={{ query, discard }} />);
    fireEvent.change(screen.getByLabelText('¿Qué información deseas consultar?'), { target: { value: 'Dosis para mí' } });
    fireEvent.click(screen.getByRole('button', { name: 'Consultar' }));
    await waitFor(() => expect(screen.getByText('No puedo indicar dosis.')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Descartar conversación' }));
    await waitFor(() => expect(screen.queryByText('No puedo indicar dosis.')).toBeNull());
    expect(discard).toHaveBeenCalledWith(null);
  });
  it('ofrece búsqueda pública ante error', async () => {
    render(<ConversationView client={{ query: vi.fn().mockRejectedValue(new Error('Servicio no disponible.')),
      discard: vi.fn() }} />);
    fireEvent.change(screen.getByLabelText('¿Qué información deseas consultar?'), { target: { value: 'Busca algo' } });
    fireEvent.click(screen.getByRole('button', { name: 'Consultar' }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Servicio no disponible.'));
    expect(screen.getByRole('link', { name: 'Ir a búsqueda pública' }).getAttribute('href')).toBe('/search');
  });
  it('muestra abstención educativa sin inventar fuente', async () => {
    const query = vi.fn().mockResolvedValue({ estado: 'ABSTENCION', respuesta: 'No dispongo de una fuente revisada.',
      aviso: 'Información educativa.', fuentes: [] });
    render(<ConversationView client={{ query, discard: vi.fn() }} />);
    fireEvent.change(screen.getByLabelText('¿Qué información deseas consultar?'), { target: { value: 'Molestia ficticia' } });
    fireEvent.click(screen.getByRole('button', { name: 'Consultar' }));
    await waitFor(() => expect(screen.getByText('No dispongo de una fuente revisada.')).toBeTruthy());
    expect(screen.queryByRole('heading', { name: 'Fuentes' })).toBeNull();
  });
  it('muestra oferta pública con aviso referencial y fecha recibidos', async () => {
    const query = vi.fn().mockResolvedValue({ estado: 'BUSQUEDA_PUBLICA',
      respuesta: 'Producto TEST; Farmacia TEST; precio referencial 1234 céntimos; revisado 2026-11-17.',
      aviso: 'Precio y disponibilidad referenciales.', fuentes: [{ tipo: 'OFERTA_PUBLICA',
        titulo: 'Producto TEST', referencia: 'farmafind://oferta/TEST', revisadoEl: '2026-11-17' }] });
    render(<ConversationView client={{ query, discard: vi.fn() }} />);
    fireEvent.change(screen.getByLabelText('¿Qué información deseas consultar?'), { target: { value: 'Busca Producto TEST' } });
    fireEvent.click(screen.getByRole('button', { name: 'Consultar' }));
    await waitFor(() => expect(screen.getByText(/precio referencial 1234/)).toBeTruthy());
    expect(screen.getByText('Precio y disponibilidad referenciales.')).toBeTruthy();
    expect(screen.getByText(/farmafind:\/\/oferta\/TEST/)).toBeTruthy();
  });
  it.each(['Has realizado demasiadas consultas.', 'La conversación venció.'])
  ('muestra error recuperable de cuota o expiración: %s', async message => {
    const query = vi.fn().mockRejectedValue(new Error(message));
    render(<ConversationView client={{ query, discard: vi.fn() }} />);
    fireEvent.change(screen.getByLabelText('¿Qué información deseas consultar?'), { target: { value: 'Ayuda' } });
    fireEvent.click(screen.getByRole('button', { name: 'Consultar' }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain(message));
  });
  it('indica espera y deshabilita envíos duplicados', async () => {
    let finish;
    const query = vi.fn().mockReturnValue(new Promise(resolve => { finish = resolve; }));
    render(<ConversationView client={{ query, discard: vi.fn() }} />);
    fireEvent.change(screen.getByLabelText('¿Qué información deseas consultar?'), { target: { value: 'Ayuda' } });
    fireEvent.click(screen.getByRole('button', { name: 'Consultar' }));
    expect(screen.getByRole('status').textContent).toContain('Procesando');
    expect(screen.getByRole('button', { name: 'Consultando…' }).disabled).toBe(true);
    finish({ estado: 'AYUDA', respuesta: 'Ayuda.', aviso: 'Educativo.', fuentes: [] });
    await waitFor(() => expect(screen.getByText('Ayuda.')).toBeTruthy());
  });
});
