// @vitest-environment jsdom
import React from 'react';
import {cleanup,render,screen,waitFor} from '@testing-library/react';
import {afterEach,describe,expect,it,vi} from 'vitest';

const state=vi.hoisted(()=>({
  session:vi.fn(),memberships:vi.fn(),canReview:vi.fn(),
}));
vi.mock('../../src/identity/session-client.js',()=>({
  createSessionClient:()=>({session:state.session,memberships:state.memberships}),
}));
vi.mock('../../src/pharmacies/application-client.js',()=>({
  createPharmacyApplicationClient:()=>({canReview:state.canReview}),
}));
import {AppShell} from '../../src/app/AppShell.jsx';

afterEach(()=>{cleanup();vi.clearAllMocks();});

describe('F02.5 navegación de plataforma',()=>{
  it('muestra el acceso cuando la API autoriza consultar solicitudes',async()=>{
    state.session.mockResolvedValue({id:'reviewer'});
    state.memberships.mockResolvedValue([]);
    state.canReview.mockResolvedValue([]);
    render(<AppShell path="/identity"><p>Cuenta</p></AppShell>);
    expect((await screen.findByRole('link',{name:'Revisar solicitudes'})).getAttribute('href'))
      .toBe('/admin/farmacias/solicitudes');
  });
  it('no muestra el acceso a una cuenta normal denegada por la API',async()=>{
    state.session.mockResolvedValue({id:'ordinary'});
    state.memberships.mockResolvedValue([]);
    state.canReview.mockRejectedValue(new Error('No tienes permiso'));
    render(<AppShell path="/identity"><p>Cuenta</p></AppShell>);
    await waitFor(()=>expect(state.canReview).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('link',{name:'Revisar solicitudes'})).toBeNull();
  });
  it('no consulta el panel si no existe sesión',async()=>{
    state.session.mockResolvedValue(null);
    render(<AppShell path="/identity"><p>Cuenta</p></AppShell>);
    await waitFor(()=>expect(state.session).toHaveBeenCalledTimes(1));
    expect(state.canReview).not.toHaveBeenCalled();
    expect(screen.queryByRole('link',{name:'Revisar solicitudes'})).toBeNull();
  });
});
