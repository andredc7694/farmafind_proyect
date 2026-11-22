// @vitest-environment jsdom
import React from 'react';
import {cleanup,render,screen} from '@testing-library/react';
import {afterEach,describe,expect,it,vi} from 'vitest';

vi.mock('../../src/identity/session-client.js',()=>({
  createSessionClient:()=>({
    session:vi.fn(async()=>({email:'cliente@example.invalid'})),
    memberships:vi.fn(async()=>[]),
  }),
}));

import {IdentityApp} from '../../src/identity/IdentityApp.jsx';

afterEach(()=>{cleanup();window.history.replaceState({},'', '/');});

describe('F02.5 retorno al formulario tras autenticación',()=>{
  it('ofrece volver solamente a la ruta interna autorizada',async()=>{
    window.history.replaceState({},'', '/identity?return=%2Ffarmacias%2Fsolicitar');
    render(<IdentityApp/>);
    const link=await screen.findByRole('link',{name:'Continuar con la solicitud de farmacia'});
    expect(link.getAttribute('href')).toBe('/farmacias/solicitar');
  });
  it('ignora una URL externa manipulada',async()=>{
    window.history.replaceState({},'', '/identity?return=https%3A%2F%2Fexample.invalid');
    render(<IdentityApp/>);
    await screen.findByText('Sesión activa');
    expect(screen.queryByRole('link',{name:'Continuar con la solicitud de farmacia'})).toBeNull();
  });
});
