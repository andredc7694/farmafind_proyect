// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { LocationAdmin } from '../../src/geolocation/LocationAdmin.jsx';
import { createLocationAdminClient } from '../../src/geolocation/location-admin-client.js';

afterEach(cleanup);
const pharmacy='00000000-0000-4000-8000-000000000001';
describe('F07 vista administrativa con capacidades F01',()=>{
  it('oculta acciones sin farmacia o delegación',()=>{
    const view=render(<LocationAdmin pharmacyId={pharmacy} delegationCodes={[]} />);
    expect(view.container.textContent).toBe('');
    view.rerender(<LocationAdmin pharmacyId={null} delegationCodes={['GEO_LOCATION_REVIEW']} />);
    expect(view.container.textContent).toBe('');
  });
  it('separa propuesta de revisión y no concede capacidades desde el navegador',()=>{
    const view=render(<LocationAdmin pharmacyId={pharmacy} delegationCodes={['GEO_LOCATION_PROPOSE']} />);
    expect(screen.getByRole('button',{name:'Enviar propuesta'})).toBeTruthy();
    expect(screen.queryByRole('button',{name:'Registrar revisión'})).toBeNull();
    view.rerender(<LocationAdmin pharmacyId={pharmacy} delegationCodes={['GEO_LOCATION_REVIEW']} />);
    expect(screen.getByRole('button',{name:'Registrar revisión'})).toBeTruthy();
    expect(screen.queryByRole('button',{name:'Enviar propuesta'})).toBeNull();
  });
  it('envía sesión y CSRF solo al backend, sin guardar coordenadas en URL',async()=>{
    const fetch=vi.fn().mockResolvedValueOnce({ok:true,json:async()=>({csrfToken:'test-token'})})
      .mockResolvedValueOnce({ok:true,json:async()=>({id:'test',estado:'PENDIENTE'})});
    const client=createLocationAdminClient(fetch);
    await client.propose(pharmacy,{direccionPublicable:'Ficticia',latitud:-12,longitud:-77});
    expect(fetch.mock.calls[1][0]).toBe(`/api/v1/farmacias/${pharmacy}/ubicacion/propuestas`);
    expect(fetch.mock.calls[1][1]).toMatchObject({method:'POST',credentials:'same-origin',cache:'no-store'});
    expect(fetch.mock.calls[1][1].headers['X-CSRF-Token']).toBe('test-token');
    expect(fetch.mock.calls[1][0]).not.toContain('-12');
  });
});
