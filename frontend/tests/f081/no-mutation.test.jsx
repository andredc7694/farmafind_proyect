// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { PublicSearch } from '../../src/search/PublicSearch.jsx';
import { ChatBubble } from '../../src/assistant/ChatBubble.jsx';
import { createPublicSearchClient } from '../../src/search/search-client.js';
import { createConversationClient } from '../../src/assistant/conversation-client.js';

/**
 * F08.1: las sugerencias (de búsqueda, filtros, preguntas del chat, comparables) SOLO proponen. Se espía todo el tráfico de red
 * y se comprueba que ninguna interacción de sugerencia llama a una ruta de escritura sobre reservas, inventario, perfil o permisos.
 */
const writes = /\/(reservas|farmacias\/[^/]+\/(inventario|reservas|importaciones|staff)|me\/|pharmacies\/|platform|ubicacion)/;

let calls;
beforeEach(() => {
  calls = []; window.localStorage.clear();
  globalThis.fetch = vi.fn(async (url, init = {}) => {
    calls.push({ url: String(url), method: (init.method ?? 'GET').toUpperCase() });
    if (String(url).includes('/sugerencias')) return { ok: true, status: 200, json: async () => ({ suggestions: [{ text: 'paracetamol', kind: 'NOMBRE' }, { text: 'paracetamol 500 mg tabletas', kind: 'PRESENTACION' }] }) };
    if (String(url).includes('/busquedas')) return { ok: true, status: 200, json: async () => ({ consulta: 'paracetamol', ofertas: [], paginacion: { pagina: 1, tamano: 20, total: 0, totalPaginas: 1 }, aviso: 'Referencial.' }) };
    return { ok: true, status: 200, json: async () => ({ respuesta: 'Información referencial.', aviso: 'Referencial.', conversacionId: 'c1', fuentes: [] }) };
  });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('F08.1 las sugerencias solo proponen', () => {
  it('elegir sugerencias, filtros y comparables no escribe en reservas, inventario, perfil ni permisos', async () => {
    render(<PublicSearch client={createPublicSearchClient(globalThis.fetch)} />);
    fireEvent.change(screen.getByLabelText('Nombre comercial o principio activo'), { target: { value: 'para' } });
    await waitFor(() => expect(screen.getAllByRole('option').some(option => option.textContent.includes('paracetamol 500 mg'))).toBe(true));
    fireEvent.click(screen.getAllByRole('option').find(option => option.textContent.includes('paracetamol 500 mg')));
    expect(calls.filter(call => !call.url.includes('/sugerencias'))).toEqual([]); // elegir una sugerencia no busca ni escribe
    fireEvent.click(screen.getByLabelText(/Recordar estos filtros/));
    fireEvent.change(screen.getByLabelText('Orden'), { target: { value: 'precio_asc' } });
    expect(calls.filter(call => call.method !== 'GET')).toEqual([]);
    expect(calls.some(call => writes.test(call.url))).toBe(false);
  });

  it('las preguntas sugeridas del chat no envían nada hasta que la persona pulsa Enviar, y aun así solo consultan el asistente', async () => {
    render(<ChatBubble client={createConversationClient(globalThis.fetch)} path="/search" />);
    fireEvent.click(screen.getByRole('button', { name: /Preguntar a FarmaFind AI/ }));
    for (const button of screen.getAllByRole('button').filter(item => item.closest('.chat-suggestions'))) fireEvent.click(button);
    expect(calls).toEqual([]);
    fireEvent.submit(screen.getByRole('button', { name: 'Enviar' }).closest('form'));
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0]).toEqual({ url: '/api/v1/asistente/conversaciones', method: 'POST' });
    expect(calls.some(call => writes.test(call.url))).toBe(false);
  });

  it('el tráfico de la búsqueda y del chat nunca incluye cookies de sesión ni encabezados de CSRF', async () => {
    const inits = [];
    globalThis.fetch = vi.fn(async (url, init = {}) => { inits.push(init); return { ok: true, status: 200, json: async () => ({ suggestions: [] }) }; });
    await createPublicSearchClient(globalThis.fetch).suggest('para');
    await createConversationClient(globalThis.fetch).query('Ayuda', null).catch(() => undefined);
    for (const init of inits) { expect(init.credentials).toBeUndefined(); expect(JSON.stringify(init.headers ?? {})).not.toMatch(/csrf/i); }
  });
});
