// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NearbyPharmacies } from '../../src/geolocation/NearbyPharmacies.jsx';
import { LocationAdmin } from '../../src/geolocation/LocationAdmin.jsx';

afterEach(cleanup);

const empty = { farmacias: [], aviso: 'Sin resultados públicos.' };

describe('geolocalización TEST en F08', () => {
  it('mantiene la lista disponible sin permiso ni teselas externas', async () => {
    const client = { searchCity: vi.fn().mockResolvedValue(empty), searchNearby: vi.fn() };
    const getPosition = vi.fn().mockRejectedValue(new Error('denegado'));
    const loadLeaflet = vi.fn();
    render(<NearbyPharmacies client={client} getPosition={getPosition} loadLeaflet={loadLeaflet} />);
    expect(screen.getByText(/únicamente en el entorno TEST\/DEMO/)).toBeTruthy();
    expect(getPosition).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Usar mi ubicación una vez' }));
    await screen.findByText(/No se obtuvo permiso/);
    fireEvent.change(screen.getByLabelText('Ciudad'), { target: { value: 'Lima' } });
    fireEvent.click(screen.getByRole('button', { name: 'Buscar farmacias' }));
    await waitFor(() => expect(client.searchCity).toHaveBeenCalledWith({ city: 'Lima', term: undefined }));
    expect(screen.getByText('No hay farmacias públicas para esta consulta.')).toBeTruthy();
    expect(loadLeaflet).not.toHaveBeenCalled();
  });

  it('no ofrece acciones administrativas sin farmacia activa y capacidad explícita', () => {
    const { rerender } = render(<LocationAdmin pharmacyId="alfa" delegationCodes={[]} />);
    expect(screen.queryByRole('button', { name: 'Enviar propuesta' })).toBeNull();
    rerender(<LocationAdmin pharmacyId="alfa" delegationCodes={['GEO_LOCATION_PROPOSE']} />);
    expect(screen.getByRole('button', { name: 'Enviar propuesta' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Registrar revisión' })).toBeNull();
    rerender(<LocationAdmin pharmacyId={null} delegationCodes={['GEO_LOCATION_REVIEW']} />);
    expect(screen.queryByRole('button', { name: 'Registrar revisión' })).toBeNull();
  });

  it('anuncia denegación del backend sin presentar la operación como completada', async () => {
    const client = { propose: vi.fn().mockRejectedValue(new Error('No tienes permiso para esta operación')) };
    render(<LocationAdmin pharmacyId="alfa" delegationCodes={['GEO_LOCATION_PROPOSE']} client={client} />);
    expect(screen.getByText(/únicamente en el entorno TEST\/DEMO/)).toBeTruthy();
    for (const [name, value] of Object.entries({
      'Dirección pública': 'Calle ficticia', 'Ciudad o distrito': 'Lima', Latitud: '-12', Longitud: '-77',
      'Referencia para encontrar la farmacia (opcional)': 'REF-TEST', // F07.1: la fuente se rellena sola
    })) fireEvent.change(screen.getByLabelText(name), { target: { value } });
    fireEvent.click(screen.getByLabelText(/Confirmo que la dirección pública y el punto/)); // F08.1: confirmación explícita de la dirección
    fireEvent.click(screen.getByRole('button', { name: 'Enviar propuesta' }));
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'No tienes permiso para esta operación');
    expect(screen.queryByText(/Propuesta registrada/)).toBeNull();
    expect(client.propose).toHaveBeenCalledOnce();
  });
});
