// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NearbyPharmacies } from '../../src/geolocation/NearbyPharmacies.jsx';
import { createGeolocationClient } from '../../src/geolocation/geolocation-client.js';

afterEach(cleanup);
const empty={farmacias:[],pagina:1,aviso:'Precio y disponibilidad referenciales; confirma existencias con la farmacia.'};

describe('F07 navegador: consentimiento y alternativa accesible',()=>{
  it('no solicita permiso al cargar y busca por ciudad tras denegación',async()=>{
    const getPosition=vi.fn().mockRejectedValue(new Error('denied'));
    const client={searchCity:vi.fn().mockResolvedValue(empty),searchNearby:vi.fn()};
    render(<NearbyPharmacies client={client} getPosition={getPosition} />);
    expect(getPosition).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button',{name:'Usar mi ubicación una vez'}));
    await screen.findByText(/No se obtuvo permiso/);
    fireEvent.change(screen.getByLabelText('Ciudad'),{target:{value:'Lima'}});
    fireEvent.click(screen.getByRole('button',{name:'Buscar farmacias'}));
    await waitFor(()=>expect(client.searchCity).toHaveBeenCalledWith({city:'Lima',term:undefined}));
    expect(client.searchNearby).not.toHaveBeenCalled();
    expect(await screen.findByText('No hay farmacias públicas para esta consulta.')).toBeTruthy();
  });
  it('permiso concedido usa POST y revocación local borra la posición',async()=>{
    const getPosition=vi.fn().mockResolvedValueOnce({latitude:-12.04,longitude:-77.03})
      .mockRejectedValueOnce(new Error('revoked'));
    const client={searchCity:vi.fn().mockResolvedValue(empty),searchNearby:vi.fn().mockResolvedValue(empty)};
    render(<NearbyPharmacies client={client} getPosition={getPosition} />);
    fireEvent.click(screen.getByRole('button',{name:'Usar mi ubicación una vez'}));
    await screen.findByText(/Ubicación temporal disponible/);
    fireEvent.click(screen.getByRole('button',{name:'Buscar farmacias'}));
    await waitFor(()=>expect(client.searchNearby).toHaveBeenCalledWith({latitude:-12.04,longitude:-77.03,radiusKm:10,term:undefined}));
    fireEvent.click(screen.getByRole('button',{name:'Borrar mi ubicación'}));
    expect(screen.queryByText('No hay farmacias públicas para esta consulta.')).toBeNull();
    fireEvent.click(screen.getByRole('button',{name:'Usar mi ubicación una vez'}));
    await screen.findByText(/No se obtuvo permiso/);
    fireEvent.change(screen.getByLabelText('Ciudad'),{target:{value:'Lima'}});
    fireEvent.click(screen.getByRole('button',{name:'Buscar farmacias'}));
    await waitFor(()=>expect(client.searchCity).toHaveBeenCalledOnce());
  });
  it('coordenadas manuales permiten buscar sin geolocalización del dispositivo',async()=>{
    const client={searchCity:vi.fn(),searchNearby:vi.fn().mockResolvedValue(empty)};
    const getPosition=vi.fn();
    render(<NearbyPharmacies client={client} getPosition={getPosition} />);
    fireEvent.change(screen.getByLabelText('Latitud manual (opcional)'),{target:{value:'-12'}});
    fireEvent.change(screen.getByLabelText('Longitud manual (opcional)'),{target:{value:'-77'}});
    fireEvent.click(screen.getByRole('button',{name:'Buscar farmacias'}));
    await waitFor(()=>expect(client.searchNearby).toHaveBeenCalledWith({latitude:-12,longitude:-77,radiusKm:10,term:undefined}));
    expect(getPosition).not.toHaveBeenCalled();
  });
});

describe('F07 cliente: privacidad de coordenadas',()=>{
  it('GET solo envía ciudad y POST transporta coordenadas exclusivamente en el cuerpo',async()=>{
    const fetcher=vi.fn().mockResolvedValue({ok:true,json:async()=>empty});
    const client=createGeolocationClient(fetcher);
    await client.searchCity({city:'lima'});
    await client.searchNearby({latitude:-12.04,longitude:-77.03,radiusKm:2});
    expect(fetcher.mock.calls[0][0]).toContain('ciudad=lima');
    expect(fetcher.mock.calls[0][0]).not.toContain('latitud');
    expect(fetcher.mock.calls[1][0]).toBe('/api/v1/geolocalizacion/consultas');
    expect(fetcher.mock.calls[1][1]).toMatchObject({method:'POST',cache:'no-store',credentials:'omit'});
    expect(JSON.parse(fetcher.mock.calls[1][1].body)).toMatchObject({latitud:-12.04,longitud:-77.03});
    await expect(client.searchCity({city:'-12.04,-77.03'})).rejects.toThrow();
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
