// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ChatBubble, sendsWithEnter } from '../../src/assistant/ChatBubble.jsx';
import { bubbleHiddenOn, MINIMIZED_KEY, QUICK_QUESTIONS } from '../../src/assistant/chat-suggestions.js';
import { ConversationClientError } from '../../src/assistant/conversation-client.js';
import { publishSearchContext } from '../../src/search/search-context.js';

beforeEach(() => { window.sessionStorage.clear(); window.localStorage.clear(); publishSearchContext({}); });
afterEach(() => { cleanup(); document.body.removeAttribute('data-chat'); });

const answer = (extra = {}) => ({ version: '2.0', estado: 'BUSQUEDA_PUBLICA', respuesta: 'Hay 2 ofertas públicas referenciales.', aviso: 'Información referencial.',
  contexto: { intencion: 'PRECIO', medicamento: 'paracetamol' },
  fuentes: [{ titulo: 'Ofertas públicas F03', referencia: 'f03:paracetamol', revisadoEl: '2026-11-24' }], ...extra });
const card = (id, extra = {}) => ({ farmacia: { id: `f${id}`, nombre: `Farmacia ${id}`, direccion: `Jr. ${id}` },
  producto: { id: `m${id}`, nombre: 'Ibuprofeno', concentracion: '400 mg', presentacion: 'caja x 10 tabletas' },
  precioCentavos: 100 + id, distanciaKm: id / 10, horarioHoy: 'Abierto hasta 20:00', reservarUrl: `/reservations?pharmacyId=f${id}&medicationId=m${id}`, ...extra });
const makeClient = overrides => ({ query: vi.fn().mockResolvedValue(answer()), ...overrides });
const toggle = () => screen.getByRole('button', { name: /Preguntar a FarmaFind AI/ });
const openChat = (client, path = '/') => { render(<ChatBubble client={client} path={path} />); fireEvent.click(toggle()); return screen.getByLabelText('Tu consulta'); };
const send = text => { fireEvent.change(screen.getByLabelText('Tu consulta'), { target: { value: text } }); fireEvent.submit(screen.getByRole('button', { name: 'Enviar' }).closest('form')); };

describe('F06.2 asistente en panel (antes burbuja F08.1)', () => {
  it('empieza minimizado, no consulta nada y no aparece en las pantallas donde sobra', () => {
    const client = makeClient();
    render(<ChatBubble client={client} path="/search" />);
    expect(toggle().getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('dialog')).toBeNull(); expect(client.query).not.toHaveBeenCalled();
    cleanup();
    for (const hidden of ['/bootstrap', '/admin/farmacias/solicitudes']) {
      const { container } = render(<ChatBubble client={client} path={hidden} />); expect(container.firstChild).toBeNull(); expect(bubbleHiddenOn(hidden)).toBe(true); cleanup();
    }
  });

  it('al abrir enfoca el campo y marca el cuerpo; «Minimizar» y Escape lo cierran con un clic y se recuerda en la visita', async () => {
    openChat(makeClient());
    const dialog = screen.getByRole('dialog'); expect(dialog.getAttribute('aria-modal')).toBe('false');
    expect(document.activeElement).toBe(screen.getByLabelText('Tu consulta'));
    expect(document.body.getAttribute('data-chat')).toBe('open');
    expect(window.sessionStorage.getItem(MINIMIZED_KEY)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Minimizar el asistente' }));
    expect(screen.queryByRole('dialog')).toBeNull(); expect(document.body.getAttribute('data-chat')).toBe('closed');
    expect(window.sessionStorage.getItem(MINIMIZED_KEY)).toBe('1');
    await waitFor(() => expect(document.activeElement).toBe(toggle()));
    fireEvent.click(toggle());
    expect(window.sessionStorage.getItem(MINIMIZED_KEY)).toBeNull();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(window.sessionStorage.getItem(MINIMIZED_KEY)).toBe('1');
  });

  it('preguntas rápidas: las que necesitan nombre rellenan y enfocan; las completas se envían (D-10)', async () => {
    const client = makeClient();
    openChat(client, '/search');
    expect(QUICK_QUESTIONS.length).toBeGreaterThanOrEqual(4);
    fireEvent.click(screen.getByRole('button', { name: '¿Dónde está más barato…?' }));
    expect(screen.getByLabelText('Tu consulta').value).toBe('¿Dónde está más barato '); expect(client.query).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '¿Qué farmacia está abierta ahora?' }));
    await waitFor(() => expect(client.query).toHaveBeenCalledWith('¿Qué farmacia está abierta ahora?', {}));
    expect(JSON.stringify(QUICK_QUESTIONS)).not.toMatch(/dosis|diagnóstic|recet|tratamiento|genéric/i);
  });

  it('Enter envía; Shift+Enter y la composición IME no envían', async () => {
    const client = makeClient();
    const field = openChat(client);
    fireEvent.change(field, { target: { value: 'Paracetamol' } });
    expect(fireEvent.keyDown(field, { key: 'Enter', shiftKey: true })).toBe(true);
    fireEvent.keyDown(field, { key: 'Enter', isComposing: true });
    fireEvent.keyDown(field, { key: 'Enter', keyCode: 229 });
    expect(client.query).not.toHaveBeenCalled();
    expect(fireEvent.keyDown(field, { key: 'Enter' })).toBe(false);
    await screen.findByRole('article', { name: 'Respuesta 1' });
    expect(client.query).toHaveBeenCalledWith('Paracetamol', {});
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
      await waitFor(() => expect(client.query).toHaveBeenCalledWith('Aciclovir', {}));
    } finally { delete window.matchMedia; }
  });

  it('tu mensaje aparece con «escribiendo», un solo aviso de salud fijo y enlace al mapa cuando toca', async () => {
    let resolve;
    const client = makeClient({ query: vi.fn().mockImplementation(() => new Promise(done => { resolve = done; })) });
    const field = openChat(client);
    fireEvent.change(field, { target: { value: 'farmacia cercana' } }); fireEvent.keyDown(field, { key: 'Enter' });
    expect(screen.getByRole('status').textContent).toContain('El asistente está escribiendo');
    expect(screen.getByRole('log').textContent).toContain('farmacia cercana');
    expect(screen.getByRole('log').getAttribute('aria-live')).toBe('polite');
    expect(field.value).toBe('');
    await act(async () => resolve(answer({ estado: 'AYUDA', respuesta: 'Usa «Ver farmacias en el mapa».', aviso: 'AVISO-REPETIDO', fuentes: [] })));
    await screen.findByRole('article', { name: 'Respuesta 1' });
    expect(screen.getByRole('link', { name: 'Ver farmacias en el mapa' }).getAttribute('href')).toBe('/search/mapa');
    expect(screen.queryByText('AVISO-REPETIDO')).toBeNull();
    expect(screen.getAllByText(/No da diagnósticos, tratamientos ni dosis/)).toHaveLength(1);
  });

  it('tarjetas, «¿Cuál buscas?», «¿Quisiste decir…?» y «Ver todas»; cada botón envía con el contexto devuelto', async () => {
    const client = makeClient({ query: vi.fn()
      .mockResolvedValueOnce(answer({ estado: 'ACLARACION', respuesta: '¿Cuál buscas?', fuentes: [], contexto: { intencion: 'PRECIO', medicamento: 'ibuprofeno' },
        opciones: [{ texto: 'Ibuprofeno 400 mg · tableta', consulta: 'ibuprofeno 400 mg tableta' }, { texto: 'Ibuprofeno 600 mg · tableta', consulta: 'ibuprofeno 600 mg tableta' }],
        verTodas: { texto: 'Ver todas en Buscar medicamentos', url: '/search?q=ibuprofeno' } }))
      .mockResolvedValueOnce(answer({ respuesta: 'Precios referenciales.', contexto: { intencion: 'PRECIO', medicamento: 'ibuprofeno', concentracion: '400 mg', forma: 'tableta' },
        tarjetas: [card(1), card(2, { etiqueta: 'Mismo principio activo y concentración' }), card(3)] }))
      .mockResolvedValueOnce(answer({ estado: 'ABSTENCION', respuesta: 'No encontré «ibuprofemo».', contexto: { intencion: 'PRECIO' }, fuentes: [],
        sugerencia: { texto: '¿Quisiste decir ibuprofeno?', consulta: 'ibuprofeno' } }))
      .mockResolvedValue(answer()) });
    openChat(client);
    send('¿En qué farmacia el ibuprofeno está más barato?');
    const first = await screen.findByRole('article', { name: 'Respuesta 1' });
    expect(within(first).getByRole('link', { name: 'Ver todas en Buscar medicamentos' }).getAttribute('href')).toBe('/search?q=ibuprofeno');
    fireEvent.click(within(first).getByRole('button', { name: 'Ibuprofeno 400 mg · tableta' }));
    await waitFor(() => expect(client.query).toHaveBeenLastCalledWith('ibuprofeno 400 mg tableta', { intencion: 'PRECIO', medicamento: 'ibuprofeno' }));
    const second = await screen.findByRole('article', { name: 'Respuesta 2' });
    const items = within(within(second).getByRole('list', { name: 'Resultados' })).getAllByRole('listitem');
    expect(items).toHaveLength(3);
    expect(items[0].textContent).toContain('S/ 1.01'); expect(items[0].textContent).toContain('Abierto hasta 20:00'); expect(items[0].textContent).toMatch(/0[.,]1 km/);
    expect(items[1].textContent).toContain('Mismo principio activo y concentración');
    expect(within(items[0]).getByRole('link', { name: 'Reservar Ibuprofeno en Farmacia 1' }).getAttribute('href')).toBe('/reservations?pharmacyId=f1&medicationId=m1');
    send('ibuprofemo');
    const third = await screen.findByRole('article', { name: 'Respuesta 3' });
    fireEvent.click(within(third).getByRole('button', { name: '¿Quisiste decir ibuprofeno?' }));
    await waitFor(() => expect(client.query).toHaveBeenLastCalledWith('ibuprofeno', { intencion: 'PRECIO' }));
  });

  it('emergencia: bloque destacado con llamada (tel:) y fuente, nunca con tarjetas ni botones', async () => {
    const emergencia = { mensaje: 'Si puede ser una emergencia, llama gratis al SAMU 106 (Minsa). Bomberos: 116. Policía: 105.',
      numeros: [{ servicio: 'SAMU (Minsa)', numero: '106' }, { servicio: 'Bomberos', numero: '116' }, { servicio: 'Policía', numero: '105' }],
      fuentes: [{ titulo: 'gob.pe · SAMU 106', url: 'https://www.gob.pe/1013-solicitar-atencion-medica-en-caso-de-emergencia-samu' }], verificadoEl: '2026-11-27' };
    openChat(makeClient({ query: vi.fn().mockResolvedValue(answer({ estado: 'URGENCIA', respuesta: emergencia.mensaje, contexto: {}, fuentes: [], emergencia,
      tarjetas: [card(1)], opciones: [{ texto: 'X', consulta: 'x' }] })) }));
    send('tengo dolor de pecho');
    const article = await screen.findByRole('article', { name: 'Respuesta 1' });
    const block = within(article).getByRole('region', { name: 'Emergencia' });
    expect(within(block).getAllByRole('link').filter(link => link.getAttribute('href').startsWith('tel:')).map(link => link.getAttribute('href'))).toEqual(['tel:106', 'tel:116', 'tel:105']);
    expect(block.textContent).toContain('verificado el 2026-11-27');
    expect(within(article).queryByRole('list', { name: 'Resultados' })).toBeNull();
    expect(within(article).queryByRole('button', { name: 'X' })).toBeNull();
  });

  it('memoria solo en la pestaña: nada de la conversación queda en el navegador; «Nueva conversación» la borra', async () => {
    const client = makeClient();
    openChat(client);
    send('Compara paracetamol');
    await screen.findByRole('article', { name: 'Respuesta 1' });
    fireEvent.click(screen.getByRole('button', { name: 'Minimizar el asistente' }));
    fireEvent.click(screen.getByRole('button', { name: /Preguntar a FarmaFind AI \(1\)/ }));
    expect(screen.getByRole('article', { name: 'Respuesta 1' })).toBeTruthy(); // minimizar no borra
    send('seguimiento');
    await waitFor(() => expect(client.query).toHaveBeenLastCalledWith('seguimiento', { intencion: 'PRECIO', medicamento: 'paracetamol' }));
    const stored = JSON.stringify({ ...window.sessionStorage }) + JSON.stringify({ ...window.localStorage });
    expect(stored).not.toMatch(/paracetamol|seguimiento|Compara/);
    fireEvent.click(screen.getByRole('button', { name: 'Nueva conversación' }));
    expect(screen.queryByRole('article')).toBeNull();
    send('otra');
    await waitFor(() => expect(client.query).toHaveBeenLastCalledWith('otra', {}));
  });

  it('contexto de pantalla: en «Buscar medicamentos» propone «el más barato cerca de ti» con el distrito elegido', async () => {
    publishSearchContext({ term: 'ibuprofeno', place: { label: 'Carmen Alto', latitude: -13.1794, longitude: -74.2206, source: 'city' } });
    const client = makeClient();
    render(<ChatBubble client={client} path="/search" />);
    expect(toggle().textContent).toContain('¿Quieres ver el más barato cerca de ti?');
    fireEvent.click(toggle());
    fireEvent.click(screen.getByRole('button', { name: '¿Quieres ver el más barato cerca de ti?' }));
    await waitFor(() => expect(client.query).toHaveBeenCalledWith('ibuprofeno cerca', { distrito: 'Carmen Alto' }));
    cleanup();
    window.sessionStorage.setItem(MINIMIZED_KEY, '1');
    render(<ChatBubble client={makeClient()} path="/search" />);
    expect(toggle().textContent).not.toContain('¿Quieres ver'); // minimizado en esta visita: no insiste
  });

  it('un error se muestra con un camino alternativo y no se pierde lo escrito', async () => {
    const client = makeClient({ query: vi.fn().mockRejectedValueOnce(new ConversationClientError(503)).mockResolvedValue(answer()) });
    openChat(client);
    send('uno'); await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('no está disponible'));
    expect(screen.getByRole('link', { name: 'Ir a búsqueda pública' }).getAttribute('href')).toBe('/search');
    expect(screen.getByLabelText('Tu consulta').value).toBe('uno');
    send('dos'); await screen.findByRole('article', { name: 'Respuesta 1' });
  });
});
