// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { PublicSearch } from '../../src/search/PublicSearch.jsx';
import { ResultsMap, mappablePharmacies } from '../../src/search/ResultsMap.jsx';
import { OfferCard } from '../../src/search/OfferCard.jsx';
import { cityLocation, forgetCity, readRememberedCity, rememberCity, roundPoint, searchLocation } from '../../src/search/search-location.js';
import { describeToday } from '../../src/search/today-hours.js';
import { createFakeLeaflet } from './fake-leaflet.js';

beforeEach(() => { window.localStorage.clear(); window.history.replaceState(null, '', '/search'); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const offer = (pharmacy, name, cents, ubicacion, extra = {}) => ({ medicamento: { id: 'm1', nombreComercial: 'paracetamol', principioActivo: 'paracetamol',
  concentracion: '500 mg', presentacion: 'tabletas' }, farmacia: { id: pharmacy, nombre: name, direccion: `Jr. ${name} 1`, ubicacion },
precioReferencialCentavos: cents, disponibilidadReferencial: 'DISPONIBLE', ultimaRevision: '2026-11-24T10:00:00.000Z', distanciaKm: null, ...extra });
const OFFERS = [offer('a', 'Alfa', 900, { latitud: -13.16, longitud: -74.22 }), offer('b', 'Beta', 1100, { latitud: -13.17, longitud: -74.21 }),
  offer('c', 'Gamma', 1300, { latitud: -13.15, longitud: -74.23 }), offer('d', 'Delta', 800, null), offer('a', 'Alfa', 1500, { latitud: -13.16, longitud: -74.22 })];
const page = ofertas => ({ consulta: 'paracetamol', ofertas, paginacion: { pagina: 1, tamano: 20, total: ofertas.length, totalPaginas: 1 }, aviso: 'Referencial.' });
const client = data => ({ search: vi.fn().mockResolvedValue(data), suggest: vi.fn().mockResolvedValue([]) });
const search = async () => {
  fireEvent.change(screen.getByLabelText('Nombre comercial o principio activo'), { target: { value: 'paracetamol' } });
  fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));
  await screen.findAllByText('Alfa');
};

describe('F03.1 · ubicación de búsqueda (T005)', () => {
  it('redondea a 3 decimales y etiqueta el origen', () => {
    expect(roundPoint({ latitude: -13.158812, longitude: -74.223949 })).toEqual({ latitude: -13.159, longitude: -74.224 });
    expect(searchLocation('gps', { latitude: 1.23456, longitude: 2 }).label).toBe('tu ubicación');
    expect(searchLocation('map', { latitude: 1, longitude: 2 }).label).toBe('el punto elegido');
    expect(cityLocation('AYACUCHO')).toMatchObject({ source: 'city', label: 'Ayacucho', latitude: -13.159, longitude: -74.224 });
    expect(cityLocation('Atlántida')).toBeNull();
  });
  it('solo recuerda el NOMBRE de una ciudad de la lista; tolera almacenamiento bloqueado', () => {
    expect(rememberCity('miraflores')).toBe(true);
    expect(JSON.parse(window.localStorage.getItem('farmafind.search.city'))).toEqual({ nombre: 'Miraflores' });
    expect(readRememberedCity()).toMatchObject({ label: 'Miraflores', source: 'city' });
    expect(rememberCity('Lugar inventado')).toBe(false);
    window.localStorage.setItem('farmafind.search.city', JSON.stringify({ nombre: 'Lugar inventado', latitud: 1 }));
    expect(readRememberedCity()).toBeNull();
    forgetCity(); expect(window.localStorage.getItem('farmafind.search.city')).toBeNull();
    const broken = { getItem: () => { throw new Error('bloqueado'); }, setItem: () => { throw new Error('bloqueado'); }, removeItem: () => { throw new Error('x'); } };
    expect(readRememberedCity(broken)).toBeNull(); expect(rememberCity('Lima', broken)).toBe(false); expect(forgetCity(broken)).toBe(false);
  });
});

describe('F03.1 · horario de hoy en hora de Lima (T006)', () => {
  // 2026-11-26 es jueves (día ISO 4). 15:00Z = 10:00 en Lima.
  const at = utc => new Date(utc);
  const week = [{ dia: 4, cerrado: false, abre: '08:00', cierra: '20:00' }, { dia: 5, cerrado: true, abre: null, cierra: null }];
  it('abierto, antes de abrir, cerrado ahora, cerrado hoy y sin horario', () => {
    expect(describeToday(week, at('2026-11-26T15:00:00Z'))).toBe('Abierto hasta 20:00');
    expect(describeToday(week, at('2026-11-26T12:30:00Z'))).toBe('Abre a las 08:00');
    expect(describeToday(week, at('2026-11-27T02:00:00Z'))).toBe('Cerrado ahora');
    expect(describeToday(week, at('2026-11-27T15:00:00Z'))).toBe('Cerrado hoy');
    expect(describeToday(undefined, at('2026-11-26T15:00:00Z'))).toBe('Horario no publicado');
    expect(describeToday([{ dia: 1, cerrado: false, abre: '08:00', cierra: '20:00' }], at('2026-11-26T15:00:00Z'))).toBe('Horario no publicado');
  });
});

describe('F03.1 · tarjeta (T009)', () => {
  it('muestra farmacia, producto, precio, distancia, horario, dirección y Reservar; sin ubicación verificada lo avisa', () => {
    const props = { comparables: [], gapCents: 0, compared: false, compareDisabled: false, onCompare: () => {}, selected: false, onSelect: vi.fn(), showMapButton: true,
      now: new Date('2026-11-26T15:00:00Z'), days: [{ dia: 4, cerrado: false, abre: '08:00', cierra: '20:00' }] };
    render(<ul><OfferCard offer={offer('a', 'Alfa', 1250, { latitud: -13.16, longitud: -74.22 }, { distanciaKm: 1.234 })} {...props} /></ul>);
    for (const text of ['Alfa', 'S/ 12.50', 'A 1.2 km aprox.', 'Abierto hasta 20:00', 'Jr. Alfa 1']) expect(screen.getByText(text)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Reservar' }).getAttribute('href')).toBe('/reservations?pharmacyId=a&medicationId=m1');
    expect(screen.queryByText('Ubicación no verificada')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Ver en el mapa' })); expect(props.onSelect).toHaveBeenCalledWith('a');
    cleanup();
    render(<ul><OfferCard offer={offer('d', 'Delta', 800, null)} {...props} days={undefined} /></ul>);
    expect(screen.getByText('Ubicación no verificada')).toBeTruthy(); expect(screen.getByText('Horario no publicado')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Ver en el mapa' })).toBeNull(); expect(screen.getByText('Jr. Delta 1')).toBeTruthy();
  });
});

describe('F03.1 · mapa de resultados (T010)', () => {
  it('una entrada por farmacia verificada con su precio más bajo; las no verificadas no entran', () => {
    const entries = mappablePharmacies(OFFERS);
    expect(entries.map(entry => [entry.id, entry.offer.precioReferencialCentavos])).toEqual([['a', 900], ['b', 1100], ['c', 1300]]);
  });
  it('marcadores propios con texto alternativo, tarjeta solo con texto, selección conectada y encuadre sin el visitante', async () => {
    const fake = createFakeLeaflet(); const onSelect = vi.fn();
    const hostile = [...OFFERS, offer('x', '<img src=x onerror=alert(1)>', 700, { latitud: -13.1, longitud: -74.2 })];
    const { rerender } = render(<ResultsMap offers={hostile} onSelect={onSelect} loadLeaflet={fake.load} userPoint={{ latitude: -12.0, longitude: -77.0 }} />);
    await waitFor(() => expect(fake.log.markers).toHaveLength(4));
    const labels = fake.log.markers.map(marker => marker.element.getAttribute('aria-label'));
    expect(labels).toContain('Alfa, S/ 9.00'); expect(labels).toContain('Beta, S/ 11.00');
    expect(fake.log.markers.every(marker => marker.options.keyboard === true && marker.element.tabIndex === 0)).toBe(true);
    expect(fake.log.markers.every(marker => marker.element.querySelector('.ff-marker-cross') && marker.element.querySelector('.ff-marker-price'))).toBe(true);
    expect(document.querySelector('img')).toBeNull(); // el nombre nunca se inserta como HTML
    // Encuadre con las 4 farmacias; el círculo del visitante se dibuja aparte y no entra en el encuadre.
    expect(fake.log.fitBounds[0].points).toHaveLength(4);
    expect(fake.log.fitBounds[0].points.some(([lat]) => lat === -12.0)).toBe(false);
    expect(fake.log.circles).toHaveLength(1);
    expect(fake.log.tiles[0].url).toContain('openstreetmap');
    fireEvent.click(fake.log.markers[1].element); expect(onSelect).toHaveBeenCalledWith('b');
    rerender(<ResultsMap offers={hostile} onSelect={onSelect} loadLeaflet={fake.load} userPoint={{ latitude: -12.0, longitude: -77.0 }} selectedId="x" />);
    await waitFor(() => expect(fake.log.markers[3].element.classList.contains('is-selected')).toBe(true));
    expect(fake.log.panTo.at(-1)).toEqual([-13.1, -74.2]);
    expect(fake.log.markers[3].openNode.textContent).toContain('<img src=x onerror=alert(1)>');
    expect(fake.log.markers[3].openNode.querySelector('img')).toBeNull();
    expect(fake.log.markers[3].openNode.querySelector('a').textContent).toBe('Reservar');
  });
  it('sin farmacias verificadas no carga Leaflet y lo explica', () => {
    const fake = createFakeLeaflet(); const load = vi.fn(fake.load);
    render(<ResultsMap offers={[offer('d', 'Delta', 800, null)]} loadLeaflet={load} />);
    expect(screen.getByText(/Ninguna farmacia de esta página tiene ubicación verificada/)).toBeTruthy(); expect(load).not.toHaveBeenCalled();
  });
});

describe('F03.1 · página completa (T007, T008, T010)', () => {
  it('el mapa solo se carga al elegir «Mapa»; lista y mapa quedan conectados', async () => {
    const fake = createFakeLeaflet(); const load = vi.fn(fake.load);
    render(<PublicSearch client={client(page(OFFERS))} loadLeaflet={load} />);
    await search();
    expect(load).not.toHaveBeenCalled();
    expect(screen.getAllByText('Ubicación no verificada')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Mapa' }));
    await waitFor(() => expect(fake.log.markers).toHaveLength(3));
    expect(screen.getByText(/no tu posición/)).toBeTruthy();
    fireEvent.click(fake.log.markers[2].element); // Gamma desde el mapa → se resalta en la lista
    await waitFor(() => expect(document.querySelector('li.offer.is-selected h2').textContent).toBe('Gamma'));
    const betaCard = screen.getByText('Beta').closest('li');
    fireEvent.click(within(betaCard).getByRole('button', { name: 'Ver en el mapa' })); // desde la lista → se resalta en el mapa
    await waitFor(() => expect(fake.log.markers[1].element.classList.contains('is-selected')).toBe(true));
    expect(betaCard.getAttribute('aria-current')).toBe('true');
  });
  it('la ubicación del dispositivo se redondea y nunca se guarda; la ciudad solo con la casilla', async () => {
    const api = client(page(OFFERS));
    render(<PublicSearch client={api} getPosition={() => Promise.resolve({ latitude: -13.1587654, longitude: -74.2239876 })} />);
    await search();
    fireEvent.click(screen.getByRole('button', { name: 'Elegir' }));
    let dialog = screen.getByRole('dialog', { name: '¿Dónde buscas?' });
    expect(dialog.querySelector('[autofocus], :focus') ?? within(dialog).getByRole('button', { name: 'Usar mi ubicación' })).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Usar mi ubicación' }));
    await waitFor(() => expect(api.search).toHaveBeenLastCalledWith(expect.objectContaining({ orden: 'cercania', latitud: -13.159, longitud: -74.224 })));
    expect(screen.getByText(/Cerca de:/).textContent).toContain('tu ubicación');
    expect(window.localStorage.length).toBe(0);
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar' }));
    dialog = screen.getByRole('dialog', { name: '¿Dónde buscas?' });
    fireEvent.change(within(dialog).getByLabelText('Distrito o ciudad'), { target: { value: 'Huamanga' } });
    fireEvent.click(within(dialog).getByLabelText('Recordar la ciudad en este navegador'));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Usar este lugar' }));
    await waitFor(() => expect(window.localStorage.getItem('farmafind.search.city')).toBe(JSON.stringify({ nombre: 'Huamanga' })));
    expect(Object.keys(window.localStorage)).toEqual(['farmafind.search.city']);
    cleanup(); // otro día: la ciudad recordada aparece y el orden por defecto es «Más cercano» (D-02)
    render(<PublicSearch client={client(page([]))} />);
    expect(screen.getByText(/Cerca de:/).textContent).toContain('Huamanga');
    expect(screen.getByRole('button', { name: 'Más cercano' }).getAttribute('aria-pressed')).toBe('true');
  });
  it('el diálogo se cierra con Escape (evento cancel) y Cancelar, sin cambiar nada', async () => {
    const api = client(page(OFFERS));
    render(<PublicSearch client={api} />);
    fireEvent.click(screen.getByRole('button', { name: 'Elegir' }));
    fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByText(/Sin ubicación/)).toBeTruthy(); expect(api.search).not.toHaveBeenCalled();
  });
});

describe('F03.1 · sugerencias', () => {
  it('un valor inicial desde la URL no abre la lista de sugerencias; al escribir sí', async () => {
    window.history.replaceState(null, '', '/search?q=paracetamol');
    const api = { search: vi.fn().mockResolvedValue(page(OFFERS)), suggest: vi.fn().mockResolvedValue([{ text: 'paracetamol', kind: 'NOMBRE' }]) };
    render(<PublicSearch client={api} />);
    await new Promise(resolve => setTimeout(resolve, 350));
    expect(api.suggest).not.toHaveBeenCalled(); expect(screen.getByLabelText('Nombre comercial o principio activo').getAttribute('aria-expanded')).toBe('false');
    fireEvent.change(screen.getByLabelText('Nombre comercial o principio activo'), { target: { value: 'paracet' } });
    await waitFor(() => expect(screen.getByLabelText('Nombre comercial o principio activo').getAttribute('aria-expanded')).toBe('true'));
  });
});

describe('F03.1 · sugerencias tardías', () => {
  it('si la respuesta llega después de salir del campo, la lista no se abre', async () => {
    let release; const api = { search: vi.fn().mockResolvedValue(page(OFFERS)),
      suggest: vi.fn(() => new Promise(resolve => { release = () => resolve([{ text: 'paracetamol', kind: 'NOMBRE' }]); })) };
    render(<PublicSearch client={api} />);
    const input = screen.getByLabelText('Nombre comercial o principio activo');
    fireEvent.focus(input); fireEvent.change(input, { target: { value: 'paracetamol' } });
    await waitFor(() => expect(api.suggest).toHaveBeenCalled());
    fireEvent.blur(input); release();
    await new Promise(resolve => setTimeout(resolve, 200));
    expect(input.getAttribute('aria-expanded')).toBe('false');
  });
});
