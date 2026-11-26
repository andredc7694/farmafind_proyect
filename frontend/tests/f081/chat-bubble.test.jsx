// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ChatBubble, sendsWithEnter } from '../../src/assistant/ChatBubble.jsx';
import { bubbleHiddenOn, SUGGESTIONS } from '../../src/assistant/chat-suggestions.js';
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
    for (const hidden of ['/bootstrap', '/admin/farmacias/solicitudes']) {
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
    expect(SUGGESTIONS.map(item => item.label)).toEqual(['Comparar precios de un medicamento', 'Buscar una farmacia cercana', '¿Qué información puedes darme?']);
    fireEvent.click(screen.getByRole('button', { name: SUGGESTIONS[0].label }));
    expect(screen.getByLabelText('Tu consulta').value).toBe('Compara el precio de '); expect(client.query).not.toHaveBeenCalled();
    expect(JSON.stringify(SUGGESTIONS)).not.toMatch(/dosis|diagnóstic|recet|tratamiento/i);
  });

  const openChat = client => { render(<ChatBubble client={client} path="/" />); fireEvent.click(screen.getByRole('button', { name: /Preguntar a FarmaFind AI/ })); return screen.getByLabelText('Tu consulta'); };

  it('Enter envía; Shift+Enter y la composición IME no envían', async () => {
    const client = makeClient();
    const field = openChat(client);
    fireEvent.change(field, { target: { value: 'Paracetamol' } });
    expect(fireEvent.keyDown(field, { key: 'Enter', shiftKey: true })).toBe(true); // no se cancela: salto de línea
    fireEvent.keyDown(field, { key: 'Enter', isComposing: true });
    fireEvent.keyDown(field, { key: 'Enter', keyCode: 229 });
    expect(client.query).not.toHaveBeenCalled();
    expect(fireEvent.keyDown(field, { key: 'Enter' })).toBe(false);
    await screen.findByRole('article', { name: 'Respuesta 1' });
    expect(client.query).toHaveBeenCalledWith('Paracetamol', null);
  });

  it('en pantalla táctil Enter hace salto de línea y se envía con el botón', async () => {
    expect(sendsWithEnter({ key: 'Enter' }, true)).toBe(false);
    expect(sendsWithEnter({ key: 'Enter' }, false)).toBe(true);
    window.matchMedia = vi.fn().mockReturnValue({ matches: true });
    try {
      const client = makeClient();
      const field = openChat(client);
      fireEvent.change(field, { target: { value: 'Aciclovir' } });
      expect(fireEvent.keyDown(field, { key: 'Enter' })).toBe(true);
      expect(client.query).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole('button', { name: 'Enviar' }));
      await waitFor(() => expect(client.query).toHaveBeenCalledWith('Aciclovir', null));
    } finally { delete window.matchMedia; }
  });

  it('chat: tu mensaje aparece enseguida con «escribiendo», un solo aviso de salud fijo y enlace al mapa cuando toca', async () => {
    let resolve;
    const client = makeClient({ query: vi.fn().mockImplementation(() => new Promise(done => { resolve = done; })) });
    const field = openChat(client);
    fireEvent.change(field, { target: { value: 'farmacia cercana' } }); fireEvent.keyDown(field, { key: 'Enter' });
    expect(screen.getByRole('status').textContent).toContain('El asistente está escribiendo');
    expect(screen.getByRole('log').textContent).toContain('farmacia cercana');
    expect(field.value).toBe('');
    resolve(answer({ respuesta: 'Usa «Ver farmacias en el mapa».', aviso: 'AVISO-REPETIDO', fuentes: [] }));
    await screen.findByRole('article', { name: 'Respuesta 1' });
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.getByRole('link', { name: 'Ver farmacias en el mapa' }).getAttribute('href')).toBe('/search/mapa');
    expect(screen.queryByText('AVISO-REPETIDO')).toBeNull();
    expect(screen.getAllByText(/No da diagnósticos, tratamientos ni dosis/)).toHaveLength(1);
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
