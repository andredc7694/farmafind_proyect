// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConversationView } from '../../src/assistant/ConversationView.jsx';
import { ConversationClientError } from '../../src/assistant/conversation-client.js';

afterEach(cleanup);

describe('asistente informativo F08 (contrato 2.0)', () => {
  it('conserva respuestas públicas previas ante un error y sigue con el mismo contexto', async () => {
    const client = { query: vi.fn()
      .mockResolvedValueOnce({ respuesta: 'Respuesta pública TEST', aviso: 'Referencial', fuentes: [], contexto: { intencion: 'PRECIO', medicamento: 'paracetamol' } })
      .mockRejectedValueOnce(new ConversationClientError(503))
      .mockResolvedValueOnce({ respuesta: 'Nueva respuesta TEST', aviso: 'Referencial', fuentes: [], contexto: {} }) };
    render(<ConversationView client={client} />);
    const input = screen.getByLabelText('¿Qué información deseas consultar?');
    fireEvent.change(input, { target: { value: 'paracetamol' } });
    fireEvent.click(screen.getByRole('button', { name: 'Consultar' }));
    expect(await screen.findByText('Respuesta pública TEST')).toBeTruthy();
    fireEvent.change(input, { target: { value: '¿y en Carmen Alto?' } });
    fireEvent.click(screen.getByRole('button', { name: 'Consultar' }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('no está disponible'));
    expect(screen.getByText('Respuesta pública TEST')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Consultar' }));
    expect(await screen.findByText('Nueva respuesta TEST')).toBeTruthy();
    expect(client.query.mock.calls[1][1]).toEqual({ intencion: 'PRECIO', medicamento: 'paracetamol' });
    expect(client.query.mock.calls[2][1]).toEqual({ intencion: 'PRECIO', medicamento: 'paracetamol' });
  });
});
