// @vitest-environment jsdom
import React, { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { SuggestBox } from '../../src/search/SuggestBox.jsx';
import { PublicSearch } from '../../src/search/PublicSearch.jsx';

beforeEach(() => { window.localStorage.clear(); window.history.replaceState(null, '', '/search'); });
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });

function Harness({ suggest, delayMs = 0 }) {
  const [value, setValue] = useState('');
  return <SuggestBox label="Medicamento" value={value} onChange={setValue} suggest={suggest} delayMs={delayMs} />;
}
const typed = (text) => fireEvent.change(screen.getByLabelText('Medicamento'), { target: { value: text } });

describe('F08.1 campo con sugerencias (teclado y lectores de pantalla)', () => {
  it('expone el patrón combobox, navega con flechas, elige con Enter y cierra con Escape sin ejecutar nada', async () => {
    const suggest = vi.fn().mockResolvedValue([{ text: 'paracetamol', kind: 'NOMBRE' }, { text: 'paracetamol 500 mg tabletas', kind: 'PRESENTACION' }]);
    render(<Harness suggest={suggest} />);
    const input = screen.getByRole('combobox');
    expect(input.getAttribute('aria-expanded')).toBe('false'); expect(input.getAttribute('aria-autocomplete')).toBe('list');
    typed('para');
    await waitFor(() => expect(input.getAttribute('aria-expanded')).toBe('true'));
    expect(screen.getAllByRole('option')).toHaveLength(2);
    expect(await screen.findByText('2 sugerencias disponibles')).toBeTruthy();
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(input.getAttribute('aria-activedescendant')).toBe(screen.getAllByRole('option')[0].id);
    fireEvent.keyDown(input, { key: 'ArrowDown' }); fireEvent.keyDown(input, { key: 'ArrowUp' });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(input.value).toBe('paracetamol 500 mg tabletas'); expect(input.getAttribute('aria-expanded')).toBe('false');
    typed('ibup'); await waitFor(() => expect(input.getAttribute('aria-expanded')).toBe('true'));
    fireEvent.keyDown(input, { key: 'Escape' }); expect(input.getAttribute('aria-expanded')).toBe('false');
    expect(input.value).toBe('ibup');
  });

  it('no pide sugerencias con menos de 2 letras y descarta respuestas viejas', async () => {
    let resolveFirst; const first = new Promise(resolve => { resolveFirst = resolve; });
    const suggest = vi.fn().mockImplementationOnce(() => first).mockResolvedValue([{ text: 'nueva', kind: 'NOMBRE' }]);
    render(<Harness suggest={suggest} />);
    typed('p'); await new Promise(resolve => setTimeout(resolve, 20)); expect(suggest).not.toHaveBeenCalled();
    typed('pa'); await waitFor(() => expect(suggest).toHaveBeenCalledTimes(1));
    typed('par'); await waitFor(() => expect(suggest).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(1));
    await act(async () => { resolveFirst([{ text: 'vieja', kind: 'NOMBRE' }]); await first; });
    expect(screen.getAllByRole('option').map(option => option.textContent)[0]).toContain('nueva'); expect(screen.queryByText(/vieja/)).toBeNull();
  });

  it('si las sugerencias fallan el campo sigue funcionando como un campo de texto normal', async () => {
    render(<Harness suggest={vi.fn().mockRejectedValue(new Error('503'))} />);
    typed('para'); await new Promise(resolve => setTimeout(resolve, 30));
    expect(screen.getByRole('combobox').getAttribute('aria-expanded')).toBe('false'); expect(screen.getByRole('combobox').value).toBe('para');
  });
});

describe('F08.1 búsqueda unificada', () => {
  const offer = (medication, pharmacy, name, cents) => ({ medicamento: { id: medication, nombreComercial: 'Paracetamol', principioActivo: 'activo', concentracion: '500 mg', presentacion: 'tabletas' },
    farmacia: { id: pharmacy, nombre: name, direccion: `Dirección ${name}` }, precioReferencialCentavos: cents, disponibilidadReferencial: 'DISPONIBLE', ultimaRevision: '2026-11-24T10:00:00.000Z', distanciaKm: null });
  const page = ofertas => ({ consulta: 'paracetamol', ofertas, paginacion: { pagina: 1, tamano: 20, total: ofertas.length, totalPaginas: 1 }, aviso: 'Precio y disponibilidad referenciales.' });
  const client = (data, extra = {}) => ({ search: vi.fn().mockResolvedValue(data), suggest: vi.fn().mockResolvedValue([]), ...extra });
  const search = async (text = 'paracetamol') => { fireEvent.change(screen.getByLabelText('Nombre comercial o principio activo'), { target: { value: text } }); fireEvent.click(screen.getByRole('button', { name: 'Buscar' })); };

  it('mantiene los filtros plegables y muestra ofertas comparables con la diferencia de precio y el enlace al mapa', async () => {
    const api = client(page([offer('m1', 'a', 'Alfa', 1200), offer('m1', 'b', 'Beta', 1000)]));
    render(<PublicSearch client={api} />);
    expect(document.querySelectorAll('details.search-filter-panel').length).toBe(2);
    await search();
    expect(await screen.findByText(/S\/ 2\.00 más que el más bajo/)).toBeTruthy();
    expect(screen.getByText(/También en: Beta \(S\/ 10\.00\)/)).toBeTruthy();
    expect(screen.getByText('Es el precio más bajo de esta página.', { exact: false })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Ver farmacias en el mapa' }).getAttribute('href')).toBe('/mapa?q=paracetamol');
    expect(api.search).toHaveBeenCalledWith(expect.objectContaining({ q: 'paracetamol', orden: 'relevancia' }));
  });

  it('el vacío es honesto y no inventa ofertas', async () => {
    render(<PublicSearch client={client(page([]))} />); await search('inexistente');
    expect(await screen.findByText('Sin ofertas publicadas')).toBeTruthy(); expect(document.querySelectorAll('.offer')).toHaveLength(0);
  });

  it('el estado de filtros queda en la URL y se restaura al volver', async () => {
    const api = client(page([offer('m1', 'a', 'Alfa', 1200)]));
    render(<PublicSearch client={api} />);
    fireEvent.change(screen.getByLabelText(/Precio mínimo/), { target: { value: '5' } });
    fireEvent.change(screen.getByLabelText('Orden'), { target: { value: 'precio_asc' } });
    await search();
    await screen.findByText('Alfa');
    expect(window.location.search).toBe('?q=paracetamol&min=5&orden=precio_asc');
    cleanup();
    render(<PublicSearch client={client(page([]))} />);
    expect(screen.getByLabelText('Nombre comercial o principio activo').value).toBe('paracetamol');
    expect(screen.getByLabelText(/Precio mínimo/).value).toBe('5'); expect(screen.getByLabelText('Orden').value).toBe('precio_asc');
  });

  it('recordar filtros exige marcar la casilla y guarda solo precio y orden', async () => {
    render(<PublicSearch client={client(page([offer('m1', 'a', 'Alfa', 1200)]))} />);
    fireEvent.change(screen.getByLabelText(/Precio máximo/), { target: { value: '30' } });
    await search(); await screen.findByText('Alfa');
    expect(window.localStorage.getItem('ff-filters')).toBeNull();
    fireEvent.click(screen.getByLabelText(/Recordar estos filtros/));
    await search(); await waitFor(() => expect(window.localStorage.getItem('ff-filters')).not.toBeNull());
    expect(JSON.parse(window.localStorage.getItem('ff-filters'))).toEqual({ minimum: '', maximum: '30', order: 'relevancia' });
    fireEvent.click(screen.getByLabelText(/Recordar estos filtros/)); expect(window.localStorage.getItem('ff-filters')).toBeNull();
  });

  it('sin ubicación la lista es completa; la ubicación manual válida habilita «Cercanía» y se puede borrar; una inválida se rechaza', async () => {
    const api = client(page([offer('m1', 'a', 'Alfa', 1200)]));
    render(<PublicSearch client={api} />);
    expect(screen.getByRole('option', { name: 'Cercanía' }).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Latitud'), { target: { value: '120' } }); fireEvent.change(screen.getByLabelText('Longitud'), { target: { value: '-77' } });
    fireEvent.click(screen.getByRole('button', { name: 'Usar esta ubicación' }));
    expect(screen.getByRole('alert').textContent).toContain('latitud entre -90 y 90');
    fireEvent.change(screen.getByLabelText('Latitud'), { target: { value: '-12.05' } });
    fireEvent.click(screen.getByRole('button', { name: 'Usar esta ubicación' }));
    expect(screen.getByRole('option', { name: 'Cercanía' }).disabled).toBe(false);
    fireEvent.change(screen.getByLabelText('Orden'), { target: { value: 'cercania' } });
    await search();
    await waitFor(() => expect(api.search).toHaveBeenCalledWith(expect.objectContaining({ orden: 'cercania', latitud: -12.05, longitud: -77 })));
    expect(window.location.search).not.toContain('-12'); expect(window.localStorage.length).toBe(0); // la ubicación nunca se guarda ni va a la URL
    fireEvent.click(screen.getByRole('button', { name: 'Borrar ubicación' }));
    expect(screen.getByRole('option', { name: 'Cercanía' }).disabled).toBe(true); expect(screen.getByLabelText('Orden').value).toBe('relevancia');
  });

  it('si la ubicación del dispositivo se niega, la búsqueda sigue disponible con un mensaje claro', async () => {
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: { getCurrentPosition: (_ok, fail) => fail(new Error('denegado')) } });
    render(<PublicSearch client={client(page([]))} />);
    fireEvent.click(screen.getByRole('button', { name: 'Usar mi ubicación' }));
    expect(screen.getByRole('alert').textContent).toContain('puedes buscar sin ella');
    expect(screen.getByRole('button', { name: 'Buscar' }).disabled).toBe(false);
  });

  it('un error de la API muestra un mensaje claro y las sugerencias (propuestas) no cambian la búsqueda hasta confirmar', async () => {
    const api = client(page([]), { search: vi.fn().mockRejectedValue(new Error('La búsqueda no está disponible temporalmente.')), suggest: vi.fn().mockResolvedValue([{ text: 'paracetamol', kind: 'NOMBRE' }]) });
    render(<PublicSearch client={api} />);
    fireEvent.change(screen.getByLabelText('Nombre comercial o principio activo'), { target: { value: 'para' } });
    await waitFor(() => expect(within(screen.getByRole('listbox', { hidden: true })).getAllByRole('option')).toHaveLength(1));
    expect(api.search).not.toHaveBeenCalled(); // elegir o ver una sugerencia no ejecuta la búsqueda
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));
    expect((await screen.findByRole('alert')).textContent).toContain('no está disponible');
  });
});
