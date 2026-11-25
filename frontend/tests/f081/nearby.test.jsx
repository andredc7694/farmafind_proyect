// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NearbyPharmacies } from '../../src/geolocation/NearbyPharmacies.jsx';

afterEach(cleanup);
beforeEach(() => window.history.replaceState(null, '', '/mapa'));

const pharmacy = { farmaciaId: 'a', nombre: 'Farmacia Alfa', direccion: 'Av. Ficticia 100', ubicacionVerificada: true, latitud: -12.04, longitud: -77.03, ofertas: [] };
const result = { farmacias: [pharmacy], pagina: 1, aviso: 'Referencial.' };

describe('F08.1 farmacias cercanas sin mapa ni ubicación', () => {
  it('recibe el producto desde el enlace de la búsqueda y lo usa como filtro, sin pedir ubicación', async () => {
    window.history.replaceState(null, '', '/mapa?q=paracetamol');
    const getPosition = vi.fn(); const client = { searchCity: vi.fn().mockResolvedValue(result), searchNearby: vi.fn() };
    render(<NearbyPharmacies client={client} getPosition={getPosition} />);
    expect(screen.getByLabelText(/Producto público/).value).toBe('paracetamol');
    fireEvent.change(screen.getByLabelText('Ciudad'), { target: { value: 'Lima' } });
    fireEvent.click(screen.getByRole('button', { name: 'Buscar farmacias' }));
    await waitFor(() => expect(client.searchCity).toHaveBeenCalledWith({ city: 'Lima', term: 'paracetamol' }));
    expect(getPosition).not.toHaveBeenCalled(); expect(client.searchNearby).not.toHaveBeenCalled();
  });

  it('muestra la lista completa con dirección sin cargar el mapa; el mapa solo aparece tras un clic informado', async () => {
    const loadLeaflet = vi.fn().mockRejectedValue(new Error('no se usa en esta prueba'));
    render(<NearbyPharmacies client={{ searchCity: vi.fn().mockResolvedValue(result), searchNearby: vi.fn() }} getPosition={vi.fn()} loadLeaflet={loadLeaflet} />);
    fireEvent.change(screen.getByLabelText('Ciudad'), { target: { value: 'Lima' } });
    fireEvent.click(screen.getByRole('button', { name: 'Buscar farmacias' }));
    expect(await screen.findByText('Farmacia Alfa')).toBeTruthy(); expect(screen.getByText('Av. Ficticia 100')).toBeTruthy();
    expect(screen.getByText(/recibirá tu IP/)).toBeTruthy(); expect(loadLeaflet).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Cargar mapa de OpenStreetMap' }));
    await waitFor(() => expect(loadLeaflet).toHaveBeenCalledTimes(1));
    expect((await screen.findByRole('alert')).textContent).toContain('la lista y las direcciones siguen visibles');
    expect(screen.getByText('Farmacia Alfa')).toBeTruthy();
  });

  it('con la ubicación denegada se puede seguir por ciudad o por coordenadas escritas', async () => {
    const client = { searchCity: vi.fn(), searchNearby: vi.fn().mockResolvedValue(result) };
    render(<NearbyPharmacies client={client} getPosition={vi.fn().mockRejectedValue(new Error('denegada'))} />);
    fireEvent.click(screen.getByRole('button', { name: 'Usar mi ubicación una vez' }));
    expect(await screen.findByText(/introducir coordenadas manualmente/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Latitud manual (opcional)'), { target: { value: '-12.04' } });
    fireEvent.change(screen.getByLabelText('Longitud manual (opcional)'), { target: { value: '-77.03' } });
    fireEvent.click(screen.getByRole('button', { name: 'Buscar farmacias' }));
    await waitFor(() => expect(client.searchNearby).toHaveBeenCalledWith({ latitude: -12.04, longitude: -77.03, radiusKm: 10, term: undefined }));
  });
});
