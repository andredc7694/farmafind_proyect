// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConversationView } from '../../src/assistant/ConversationView.jsx';
import { ConversationClientError } from '../../src/assistant/conversation-client.js';

afterEach(cleanup);

describe('asistente informativo F08', () => {
  it('conserva respuestas públicas previas y reinicia el contexto cuando la conversación vence', async () => {
    const client = { query: vi.fn()
      .mockResolvedValueOnce({ respuesta: 'Respuesta pública TEST', aviso: 'Referencial', fuentes: [], conversacionId: 'c1' })
      .mockRejectedValueOnce(new ConversationClientError(422))
      .mockResolvedValueOnce({ respuesta: 'Nueva respuesta TEST', aviso: 'Referencial', fuentes: [], conversacionId: 'c2' }),
    discard: vi.fn() };
    render(<ConversationView client={client} />);
    const input = screen.getByLabelText('¿Qué información deseas consultar?');
    fireEvent.change(input, { target: { value: '¿Cómo busco medicamentos?' } });
    fireEvent.click(screen.getByRole('button', { name: 'Consultar' }));
    expect(await screen.findByText('Respuesta pública TEST')).toBeTruthy();
    fireEvent.change(input, { target: { value: '¿Qué muestran las farmacias?' } });
    fireEvent.click(screen.getByRole('button', { name: 'Consultar' }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('conversación venció'));
    expect(screen.getByText('Respuesta pública TEST')).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toContain('conversación venció');
    expect(client.query.mock.calls[1][1]).toBe('c1');
    fireEvent.change(input, { target: { value: 'Nueva consulta' } });
    fireEvent.click(screen.getByRole('button', { name: 'Consultar' }));
    expect(await screen.findByText('Nueva respuesta TEST')).toBeTruthy();
    expect(client.query.mock.calls[2][1]).toBeNull();
  });
});
