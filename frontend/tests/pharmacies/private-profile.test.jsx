// @vitest-environment jsdom
import React from 'react';
import {afterEach,describe,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';

const client=vi.hoisted(()=>({profile:vi.fn(),updateProfile:vi.fn()}));
vi.mock('../../src/pharmacies/application-client.js',()=>({
  createPharmacyApplicationClient:()=>client,
}));
import {PrivatePharmacyProfile} from '../../src/pharmacies/PrivatePharmacyProfile.jsx';

const pharmacyId='11111111-1111-4111-8111-111111111111';
const profile={farmaciaId:pharmacyId,contacto:'Contacto TEST',direccion:'Calle TEST',
  distrito:'Lima',provincia:'Lima',version:3};
afterEach(()=>{cleanup();vi.resetAllMocks();});

describe('F02.5 perfil privado React',()=>{
  it('no consulta el perfil sin la capacidad explícita de lectura',()=>{
    render(<PrivatePharmacyProfile pharmacyId={pharmacyId} capabilities={[]}/>);
    expect(screen.queryByText('Perfil privado de la farmacia')).toBeNull();
    expect(client.profile).not.toHaveBeenCalled();
  });
  it('muestra datos propios sin permitir edición con solo lectura',async()=>{
    client.profile.mockResolvedValue(profile);
    render(<PrivatePharmacyProfile pharmacyId={pharmacyId}
      capabilities={['pharmacy.profile.read']}/>);
    expect(await screen.findByText('Contacto: Contacto TEST')).toBeTruthy();
    expect(screen.queryByRole('button',{name:'Guardar contacto'})).toBeNull();
    expect(client.profile).toHaveBeenCalledWith(pharmacyId);
  });
  it('envía únicamente contacto y versión para la farmacia seleccionada',async()=>{
    client.profile.mockResolvedValue(profile);
    client.updateProfile.mockResolvedValue({...profile,contacto:'Nuevo TEST',version:4});
    render(<PrivatePharmacyProfile pharmacyId={pharmacyId}
      capabilities={['pharmacy.profile.read','pharmacy.profile.write']}/>);
    fireEvent.change(await screen.findByLabelText('Contacto operativo'),
      {target:{value:'Nuevo TEST'}});
    fireEvent.click(screen.getByRole('button',{name:'Guardar contacto'}));
    await waitFor(()=>expect(client.updateProfile).toHaveBeenCalledWith(
      pharmacyId,'Nuevo TEST',3));
    expect(await screen.findByText('Contacto actualizado.')).toBeTruthy();
  });
});
