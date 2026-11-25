// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ChatBubble } from '../../src/assistant/ChatBubble.jsx';
import { bubbleHiddenOn, suggestedQuestions } from '../../src/assistant/chat-suggestions.js';
import { ConversationClientError } from '../../src/assistant/conversation-client.js';

afterEach(() => { cleanup(); document.body.removeAttribute('data-chat'); });

const answer = (extra = {}) => ({ respuesta: 'Hay 2 ofertas públicas referenciales.', aviso: 'Información referencial.', conversacionId: 'c1',
  fuentes: [{ titulo: 'Ofertas públicas F03', referencia: 'f03:paracetamol', revisadoEl: '2026-11-24' }], ...extra });
const makeClient = overrides => ({ query: vi.fn().mockResolvedValue(answer()), discard: vi.fn().mockResolvedValue(undefined), ...overrides });

describe('F08.1 burbuja de chat flotante', () => {
  it('empieza minimizada, no toma el foco ni consulta nada y no aparece en las pantallas donde sobra', () => {
    const client = makeClient();
    render(<ChatBubble client={client} path="/search" />);
    expect(screen.getByRole('button', { name: /Preguntar a FarmaFind AI/ }).getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('dialog')).toBeNull(); expect(client.query).not.toHaveBeenCalled();
    cleanup();
    for (const hidden of ['/assistant/conversation', '/assistant', '/bootstrap', '/admin/farmacias/solicitudes']) {
      const { container } = render(<ChatBubble client={client} path={hidden} />); expect(container.firstChild).toBeNull(); expect(bubbleHiddenOn(hidden)).toBe(true); cleanup();
    }
  });

  it('al abrir enfoca el campo, marca el cuerpo para que el contenido se desplace y Escape minimiza devolviendo el foco', async () => {
    render(<ChatBubble client={makeClient()} path="/" />);
    fireEvent.click(screen.getByRole('button', { name: /Preguntar a FarmaFind AI/ }));
    const dialog = screen.getByRole('dialog'); expect(dialog.getAttribute('aria-modal')).toBe('false');
    expect(document.activeElement).toBe(screen.getByLabelText('Tu consulta'));
    expect(document.body.getAttribute('data-chat')).toBe('open');
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull(); expect(document.body.getAttribute('data-chat')).toBe('closed');
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: /Preguntar a FarmaFind AI/ })));
  });

  it('las preguntas sugeridas solo rellenan el campo; enviar es una acción de la persona', () => {
    const client = makeClient();
    render(<ChatBubble client={client} path="/search" />);
    fireEvent.click(screen.getByRole('button', { name: /Preguntar a FarmaFind AI/ }));
    const first = suggestedQuestions('/search')[0];
    fireEvent.click(screen.getByRole('button', { name: first }));
    expect(screen.getByLabelText('Tu consulta').value).toBe(first); expect(client.query).not.toHaveBeenCalled();
    expect(suggestedQuestions('/search').length).toBeLessThanOrEqual(4);
    expect(suggestedQuestions('/').join(' ')).not.toMatch(/dosis|diagnóstic|recet|tratamiento/i);
  });

  it('muestra la respuesta con sus fuentes y fecha, conserva la conversación al minimizar y la descarta a pedido', async () => {
    const client = makeClient();
    render(<ChatBubble client={client} path="/search" />);
    fireEvent.click(screen.getByRole('button', { name: /Preguntar a FarmaFind AI/ }));
    fireEvent.change(screen.getByLabelText('Tu consulta'), { target: { value: 'Compara paracetamol' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Enviar' }).closest('form'));
    const article = await screen.findByRole('article', { name: 'Respuesta 1' });
    expect(within(article).getByText(/revisado 2026-11-24/)).toBeTruthy();
    expect(client.query).toHaveBeenCalledWith('Compara paracetamol', null);
    fireEvent.click(screen.getByRole('button', { name: 'Minimizar el asistente' }));
    fireEvent.click(screen.getByRole('button', { name: /Preguntar a FarmaFind AI \(1\)/ }));
    expect(screen.getByRole('article', { name: 'Respuesta 1' })).toBeTruthy(); // contexto conservado
    fireEvent.change(screen.getByLabelText('Tu consulta'), { target: { value: 'seguimiento' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Enviar' }).closest('form'));
    await waitFor(() => expect(client.query).toHaveBeenLastCalledWith('seguimiento', 'c1'));
    fireEvent.click(screen.getByRole('button', { name: 'Descartar conversación' }));
    await waitFor(() => expect(screen.queryByRole('article')).toBeNull()); expect(client.discard).toHaveBeenCalledWith('c1');
  });

  it('un error del asistente se muestra con un camino alternativo y una conversación vencida se reinicia', async () => {
    const client = makeClient({ query: vi.fn().mockRejectedValueOnce(new ConversationClientError(422)).mockRejectedValueOnce(new ConversationClientError(503)).mockResolvedValue(answer()) });
    render(<ChatBubble client={client} path="/" />);
    fireEvent.click(screen.getByRole('button', { name: /Preguntar a FarmaFind AI/ }));
    const send = text => { fireEvent.change(screen.getByLabelText('Tu consulta'), { target: { value: text } }); fireEvent.submit(screen.getByRole('button', { name: 'Enviar' }).closest('form')); };
    send('uno'); expect((await screen.findByRole('alert')).textContent).toContain('venció');
    send('dos'); await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('no está disponible'));
    expect(screen.getByRole('link', { name: 'Ir a búsqueda pública' }).getAttribute('href')).toBe('/search');
    send('tres'); await screen.findByRole('article', { name: 'Respuesta 1' });
    expect(client.query).toHaveBeenLastCalledWith('tres', null);
  });
});
