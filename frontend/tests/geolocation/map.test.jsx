// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { NearbyPharmacies } from '../../src/geolocation/NearbyPharmacies.jsx';
import { PharmacyMap } from '../../src/geolocation/PharmacyMap.jsx';
import { PharmacyDirections } from '../../src/geolocation/PharmacyDirections.jsx';

afterEach(cleanup);
const pharmacies=[
  {farmaciaId:'alfa',nombre:'Farmacia Alfa',direccion:'Av. Ficticia 100',ubicacionVerificada:true,
    latitud:-12.04,longitud:-77.03,ofertas:[]},
  {farmaciaId:'beta',nombre:'Farmacia Beta',direccion:'Calle Demo 200',ubicacionVerificada:true,
    latitud:-12.05,longitud:-77.04,ofertas:[]},
  {farmaciaId:'legacy',nombre:'Farmacia Legacy',direccion:'Dirección textual',ubicacionVerificada:false,ofertas:[]},
];
const response={farmacias:pharmacies,pagina:1,aviso:'Precio y disponibilidad referenciales; confirma existencias con la farmacia.'};

describe('F07 mapa informado y alternativa textual',()=>{
  it('no carga Leaflet ni teselas hasta un clic informado',async()=>{
    const loadLeaflet=vi.fn().mockRejectedValue(new Error('tiles unavailable'));
    const client={searchCity:vi.fn().mockResolvedValue(response),searchNearby:vi.fn()};
    render(<NearbyPharmacies client={client} loadLeaflet={loadLeaflet} />);
    fireEvent.change(screen.getByLabelText('Ciudad'),{target:{value:'Lima'}});
    fireEvent.click(screen.getByRole('button',{name:'Buscar farmacias'}));
    await screen.findByText('Farmacia Alfa');
    expect(loadLeaflet).not.toHaveBeenCalled();
    expect(screen.getByText(/proveedor recibirá tu IP/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button',{name:'Cargar mapa de OpenStreetMap'}));
    await waitFor(()=>expect(loadLeaflet).toHaveBeenCalledOnce());
    expect((await screen.findByRole('alert')).textContent).toContain('lista y las direcciones siguen visibles');
    expect(screen.getByText('Farmacia Alfa')).toBeTruthy();
    expect(screen.getByText('Dirección textual')).toBeTruthy();
  });
  it('crea marcadores solo para ubicaciones verificadas y atribución visible',async()=>{
    const circleMarker=vi.fn(()=>({addTo(){return this;},bindPopup(){return this;}}));
    const fake={map:vi.fn(()=>({setView(){return this;},remove(){}})),
      tileLayer:vi.fn(()=>({on(){return this;},addTo(){return this;}})),circleMarker};
    const view=render(<PharmacyMap pharmacies={pharmacies} loadLeaflet={async()=>fake} />);
    await waitFor(()=>expect(circleMarker).toHaveBeenCalledTimes(2));
    expect(view.container.textContent).toContain('OpenStreetMap contributors');
    expect(fake.map.mock.calls[0][0]).toBeTruthy();
    expect(fake.tileLayer.mock.calls[0][0]).toBe('https://tile.openstreetmap.org/{z}/{x}/{y}.png');
  });
  it('enlace de indicaciones contiene solo destino público y no origen personal',()=>{
    const html=renderToStaticMarkup(<PharmacyDirections pharmacy={pharmacies[0]} />);
    expect(html).toContain('mlat=-12.04'); expect(html).toContain('mlon=-77.03');
    expect(html).not.toContain('origin=');
    expect(renderToStaticMarkup(<PharmacyDirections pharmacy={pharmacies[2]} />)).not.toContain('href=');
  });
});
