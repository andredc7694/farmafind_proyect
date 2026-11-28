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

  it('mantiene «Filtros» plegable, muestra ofertas comparables y el interruptor Lista | Mapa (F03.1 reemplaza el enlace)', async () => {
    const api = client(page([offer('m1', 'a', 'Alfa', 1200), offer('m1', 'b', 'Beta', 1000)]));
    render(<PublicSearch client={api} />);
    expect(document.querySelectorAll('details.search-filter-panel').length).toBe(1);
    await search();
    expect(await screen.findByText(/S\/ 2\.00 más que el más bajo/)).toBeTruthy();
    expect(screen.getByText(/También en: Beta \(S\/ 10\.00\)/)).toBeTruthy();
    expect(screen.getByText('Es el precio más bajo de esta página.', { exact: false })).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Ver farmacias en el mapa' })).toBeNull();
    const toggle = screen.getByRole('group', { name: 'Vista de resultados' });
    expect(within(toggle).getByRole('button', { name: 'Lista' }).getAttribute('aria-pressed')).toBe('true');
    expect(within(toggle).getByRole('button', { name: 'Mapa' }).getAttribute('aria-pressed')).toBe('false');
    expect(api.search).toHaveBeenCalledWith(expect.objectContaining({ q: 'paracetamol', orden: 'precio_asc' }));
  });

  it('el vacío es honesto y no inventa ofertas', async () => {
    render(<PublicSearch client={client(page([]))} />); await search('inexistente');
    expect(await screen.findByText('Sin ofertas publicadas')).toBeTruthy(); expect(document.querySelectorAll('.offer')).toHaveLength(0);
  });

  it('el estado de filtros queda en la URL y se restaura al volver', async () => {
    const api = client(page([offer('m1', 'a', 'Alfa', 1200)]));
    render(<PublicSearch client={api} />);
    fireEvent.change(screen.getByLabelText(/Precio mínimo/), { target: { value: '5' } });
    fireEvent.change(screen.getByLabelText('Otros órdenes'), { target: { value: 'precio_desc' } });
    await search();
    await screen.findByText('Alfa');
    expect(window.location.search).toBe('?q=paracetamol&min=5&orden=precio_desc');
    cleanup();
    render(<PublicSearch client={client(page([]))} />);
    expect(screen.getByLabelText('Nombre comercial o principio activo').value).toBe('paracetamol');
    expect(screen.getByLabelText(/Precio mínimo/).value).toBe('5'); expect(screen.getByLabelText('Otros órdenes').value).toBe('precio_desc');
  });

  it('recordar filtros exige marcar la casilla y guarda solo precio y orden', async () => {
    render(<PublicSearch client={client(page([offer('m1', 'a', 'Alfa', 1200)]))} />);
    fireEvent.change(screen.getByLabelText(/Precio máximo/), { target: { value: '30' } });
    await search(); await screen.findByText('Alfa');
    expect(window.localStorage.getItem('ff-filters')).toBeNull();
    fireEvent.click(screen.getByLabelText(/Recordar estos filtros/));
    await search(); await waitFor(() => expect(window.localStorage.getItem('ff-filters')).not.toBeNull());
    expect(JSON.parse(window.localStorage.getItem('ff-filters'))).toEqual({ minimum: '', maximum: '30', order: 'precio_asc' });
    fireEvent.click(screen.getByLabelText(/Recordar estos filtros/)); expect(window.localStorage.getItem('ff-filters')).toBeNull();
  });

  it('F03.1: sin campos de coordenadas; «Más cercano» sin ubicación abre «¿Dónde buscas?», la ciudad ordena por cercanía y se puede quitar', async () => {
    const api = client(page([offer('m1', 'a', 'Alfa', 1200)]));
    render(<PublicSearch client={api} />);
    expect(screen.queryByLabelText('Latitud')).toBeNull(); expect(screen.queryByLabelText('Longitud')).toBeNull();
    expect(screen.getByText(/Sin ubicación/)).toBeTruthy();
    await search(); await screen.findByText('Alfa');
    expect(api.search).toHaveBeenLastCalledWith(expect.objectContaining({ orden: 'precio_asc', latitud: undefined }));
    fireEvent.click(screen.getByRole('button', { name: 'Más cercano' }));
    const dialog = screen.getByRole('dialog', { name: '¿Dónde buscas?' });
    fireEvent.change(within(dialog).getByLabelText('Distrito o ciudad'), { target: { value: 'Atlantida' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Usar este lugar' }));
    expect(within(dialog).getByRole('alert').textContent).toContain('No encontramos ese distrito');
    fireEvent.change(within(dialog).getByLabelText('Distrito o ciudad'), { target: { value: 'ayacucho' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Usar este lugar' }));
    await waitFor(() => expect(api.search).toHaveBeenLastCalledWith(expect.objectContaining({ orden: 'cercania', latitud: -13.16, longitud: -74.225 })));
    expect(screen.getByText(/Cerca de:/).textContent).toContain('Ayacucho');
    expect(screen.getByRole('button', { name: 'Más cercano' }).getAttribute('aria-pressed')).toBe('true');
    expect(window.location.search).not.toContain('-13'); expect(window.localStorage.length).toBe(0); // sin la casilla, nada se guarda
    fireEvent.click(screen.getByRole('button', { name: 'Quitar' }));
    expect(screen.getByText(/Sin ubicación/)).toBeTruthy();
    await waitFor(() => expect(api.search).toHaveBeenLastCalledWith(expect.objectContaining({ orden: 'precio_asc', latitud: undefined })));
  });

  it('si la ubicación del dispositivo se niega, la búsqueda sigue disponible con un mensaje claro', async () => {
    render(<PublicSearch client={client(page([]))} getPosition={() => Promise.reject(new Error('denegado'))} />);
    fireEvent.click(screen.getByRole('button', { name: 'Elegir' }));
    const dialog = screen.getByRole('dialog', { name: '¿Dónde buscas?' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Usar mi ubicación' }));
    expect((await within(dialog).findByRole('alert')).textContent).toContain('permiso denegado');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('dialog')).toBeNull();
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
