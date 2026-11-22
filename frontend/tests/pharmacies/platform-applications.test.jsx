// @vitest-environment jsdom
import React from 'react';
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,describe,expect,it,vi} from 'vitest';

const client=vi.hoisted(()=>({
  listForReview:vi.fn(async()=>[{id:'synthetic-id',nombreComercial:'Farmacia TEST',estado:'PENDIENTE'}]),
  detailForReview:vi.fn(async()=>({id:'synthetic-id',nombreComercial:'Farmacia TEST',
    estado:'PENDIENTE',version:1,contacto:'TEST',direccion:'Calle TEST',distrito:'Lima'})),
  decide:vi.fn(async()=>({})),
}));
vi.mock('../../src/pharmacies/application-client.js',()=>({
  createPharmacyApplicationClient:()=>client,
}));
import {PlatformApplications} from '../../src/pharmacies/PlatformApplications.jsx';

afterEach(()=>{cleanup();vi.clearAllMocks();});

describe('F02.5 panel de revisión TEST',()=>{
  it('distingue lista vacía de carga inicial',async()=>{
    client.listForReview.mockResolvedValueOnce([]);
    render(<PlatformApplications/>);
    expect(await screen.findByText('No hay solicitudes visibles.')).toBeTruthy();
    expect(screen.queryByText(/Cargando solicitudes/)).toBeNull();
  });
  it('muestra denegación sin presentarla como lista vacía',async()=>{
    client.listForReview.mockRejectedValueOnce(new Error('No tienes permiso para esta operación.'));
    render(<PlatformApplications/>);
    expect(await screen.findByText(/no tiene permiso para revisar solicitudes/)).toBeTruthy();
    expect(screen.queryByText('No hay solicitudes visibles.')).toBeNull();
  });
  it('muestra solo la transición permitida para una solicitud PENDIENTE',async()=>{
    render(<PlatformApplications/>);
    fireEvent.click(await screen.findByRole('button',{name:/Farmacia TEST/}));
    expect(await screen.findByRole('button',{name:'INICIAR REVISION'})).toBeTruthy();
    expect(screen.queryByRole('button',{name:'APROBAR'})).toBeNull();
    expect(screen.queryByRole('button',{name:'RECHAZAR'})).toBeNull();
  });
  it('no ofrece decisiones para una solicitud terminal',async()=>{
    client.detailForReview.mockResolvedValueOnce({id:'synthetic-id',nombreComercial:'Farmacia TEST',
      estado:'APROBADA',version:3,contacto:'TEST',direccion:'Calle TEST',distrito:'Lima'});
    render(<PlatformApplications/>);
    fireEvent.click(await screen.findByRole('button',{name:/Farmacia TEST/}));
    expect(await screen.findByText(/no admite nuevas decisiones/)).toBeTruthy();
    expect(screen.queryByRole('button',{name:'APROBAR'})).toBeNull();
  });
});
