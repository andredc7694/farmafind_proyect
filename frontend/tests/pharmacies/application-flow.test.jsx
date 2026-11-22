// @vitest-environment jsdom
import React from 'react';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,describe,expect,it,vi} from 'vitest';

const application=vi.hoisted(()=>({
  own:vi.fn(async()=>[]),one:vi.fn(),create:vi.fn(),edit:vi.fn(async()=>({})),
  submit:vi.fn(async()=>({})),cancel:vi.fn(async()=>({})),
}));
vi.mock('../../src/pharmacies/application-client.js',()=>({
  createPharmacyApplicationClient:()=>application,
}));
vi.mock('../../src/identity/session-client.js',()=>({
  createSessionClient:()=>({session:vi.fn(async()=>({email:'cliente@example.invalid'}))}),
}));
import {PharmacyApplication} from '../../src/pharmacies/PharmacyApplication.jsx';

const draft={id:'11111111-1111-4111-8111-111111111111',estado:'BORRADOR',version:2,
  nombreComercial:'Farmacia TEST',contacto:'Contacto TEST',direccion:'Calle TEST 1',
  departamento:'Lima',provincia:'Lima',distrito:'Lima',representante:'Persona TEST'};

afterEach(()=>{cleanup();vi.resetAllMocks();});

describe('F02.5 solicitud desde React',()=>{
  it('distingue fallo de carga de una lista vacía',async()=>{
    application.own.mockRejectedValueOnce(new Error('API no disponible'));
    render(<PharmacyApplication/>);
    expect(await screen.findByText(/No se pudieron cargar tus solicitudes/)).toBeTruthy();
    expect(screen.queryByText('Aún no tienes solicitudes.')).toBeNull();
  });
  it('edita solo un borrador propio y envía su versión al backend',async()=>{
    application.own.mockResolvedValue([draft]);
    application.one.mockResolvedValue(draft);
    render(<PharmacyApplication/>);
    fireEvent.click(await screen.findByRole('button',{name:'Editar'}));
    expect(await screen.findByDisplayValue('Farmacia TEST')).toBeTruthy();
    fireEvent.change(screen.getByDisplayValue('Farmacia TEST'),
      {target:{value:'Farmacia TEST corregida'}});
    fireEvent.click(screen.getByRole('button',{name:'Guardar cambios'}));
    await waitFor(()=>expect(application.edit).toHaveBeenCalledWith(
      draft.id,2,expect.objectContaining({nombreComercial:'Farmacia TEST corregida'})));
  });
  it('permite reenviar la versión observada sin activar una farmacia',async()=>{
    application.own.mockResolvedValue([{...draft,estado:'OBSERVADA',version:4}]);
    render(<PharmacyApplication/>);
    fireEvent.click(await screen.findByRole('button',{name:'Enviar solicitud'}));
    await waitFor(()=>expect(application.submit).toHaveBeenCalledWith(draft.id,4));
  });
  it('ofrece cancelar durante revisión conforme a FR-005',async()=>{
    application.own.mockResolvedValue([{...draft,estado:'EN_REVISION',version:3}]);
    render(<PharmacyApplication/>);
    fireEvent.click(await screen.findByRole('button',{name:'Cancelar'}));
    await waitFor(()=>expect(application.cancel).toHaveBeenCalledWith(draft.id,3));
  });
});
