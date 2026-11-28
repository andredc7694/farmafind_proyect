// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConversationView } from '../../src/assistant/ConversationView.jsx';
import { ConversationClientError } from '../../src/assistant/conversation-client.js';

afterEach(cleanup);

describe('vista conversacional F06.1', () => {
  it('envía el contexto que devolvió el servidor (no un identificador) y lo borra al descartar', async () => {
    const query = vi.fn().mockResolvedValueOnce({ respuesta: 'Contenido ficticio.', aviso: 'Educativo.',
      fuentes: [{ titulo: 'Ficha TEST', referencia: 'test://ficha/uno', revisadoEl: '2026-11-17' }], contexto: { medicamento: 'Producto Ficticio Alfa' } })
      .mockResolvedValueOnce({ respuesta: 'Advertencia ficticia.', aviso: 'Educativo.', fuentes: [], contexto: { medicamento: 'Producto Ficticio Alfa' } })
      .mockResolvedValueOnce({ respuesta: 'Otra.', aviso: 'Educativo.', fuentes: [], contexto: {} });
    render(<ConversationView client={{ query }} />);
    const box = screen.getByLabelText('¿Qué información deseas consultar?');
    fireEvent.change(box, { target: { value: 'Ficha de Producto Ficticio Alfa' } });
    fireEvent.click(screen.getByRole('button', { name: 'Consultar' }));
    await waitFor(() => expect(screen.getByText('Contenido ficticio.')).toBeTruthy());
    expect(screen.getByText(/Ficha TEST/)).toBeTruthy();
    expect(query).toHaveBeenNthCalledWith(1, 'Ficha de Producto Ficticio Alfa', {});
    fireEvent.change(box, { target: { value: '¿y sus advertencias?' } });
    fireEvent.click(screen.getByRole('button', { name: 'Consultar' }));
    await waitFor(() => expect(query).toHaveBeenNthCalledWith(2, '¿y sus advertencias?', { medicamento: 'Producto Ficticio Alfa' }));
    await waitFor(() => expect(screen.getByText('Advertencia ficticia.')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Descartar conversación' }));
    expect(screen.queryByText('Advertencia ficticia.')).toBeNull();
    fireEvent.change(box, { target: { value: 'Ayuda' } });
    fireEvent.click(screen.getByRole('button', { name: 'Consultar' }));
    await waitFor(() => expect(query).toHaveBeenNthCalledWith(3, 'Ayuda', {}));
  });
  it('muestra tarjetas de la respuesta 2.0 con enlace a reservar', async () => {
    const query = vi.fn().mockResolvedValue({ estado: 'BUSQUEDA_PUBLICA', respuesta: 'Precios referenciales.', aviso: 'Educativo.', fuentes: [], contexto: {},
      tarjetas: [{ farmacia: { id: 'f1', nombre: 'Farmacia TEST', direccion: 'Jr. TEST' }, producto: { id: 'm1', nombre: 'Producto TEST', concentracion: '500 mg', presentacion: 'caja x 10 tabletas' },
        precioCentavos: 1234, distanciaKm: null, horarioHoy: null, reservarUrl: '/reservations?pharmacyId=f1&medicationId=m1' }] });
    render(<ConversationView client={{ query }} />);
    fireEvent.change(screen.getByLabelText('¿Qué información deseas consultar?'), { target: { value: 'Producto TEST' } });
    fireEvent.click(screen.getByRole('button', { name: 'Consultar' }));
    await waitFor(() => expect(screen.getByText('S/ 12.34')).toBeTruthy());
    expect(screen.getByRole('link', { name: /Reservar Producto TEST en Farmacia TEST/ }).getAttribute('href')).toBe('/reservations?pharmacyId=f1&medicationId=m1');
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
    render(<ConversationView client={{ query }} />);
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
    render(<ConversationView client={{ query }} />);
    fireEvent.change(screen.getByLabelText('¿Qué información deseas consultar?'), { target: { value: 'Busca Producto TEST' } });
    fireEvent.click(screen.getByRole('button', { name: 'Consultar' }));
    await waitFor(() => expect(screen.getByText(/precio referencial 1234/)).toBeTruthy());
    expect(screen.getByText('Precio y disponibilidad referenciales.')).toBeTruthy();
    expect(screen.getByText(/farmafind:\/\/oferta\/TEST/)).toBeTruthy();
  });
  it.each(['Has realizado demasiadas consultas.', 'La conversación venció.'])
  ('muestra error recuperable de cuota o expiración: %s', async message => {
    const query = vi.fn().mockRejectedValue(new Error(message));
    render(<ConversationView client={{ query }} />);
    fireEvent.change(screen.getByLabelText('¿Qué información deseas consultar?'), { target: { value: 'Ayuda' } });
    fireEvent.click(screen.getByRole('button', { name: 'Consultar' }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain(message));
  });
  it('indica espera y deshabilita envíos duplicados', async () => {
    let finish;
    const query = vi.fn().mockReturnValue(new Promise(resolve => { finish = resolve; }));
    render(<ConversationView client={{ query }} />);
    fireEvent.change(screen.getByLabelText('¿Qué información deseas consultar?'), { target: { value: 'Ayuda' } });
    fireEvent.click(screen.getByRole('button', { name: 'Consultar' }));
    expect(screen.getByRole('status').textContent).toContain('Procesando');
    expect(screen.getByRole('button', { name: 'Consultando…' }).disabled).toBe(true);
    finish({ estado: 'AYUDA', respuesta: 'Ayuda.', aviso: 'Educativo.', fuentes: [] });
    await waitFor(() => expect(screen.getByText('Ayuda.')).toBeTruthy());
  });
});
