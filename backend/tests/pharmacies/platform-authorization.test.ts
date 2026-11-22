import {describe,expect,it,vi} from 'vitest';
import {PgPlatformReviewRepository} from '../../src/modules/farmacias/infrastructure/platform-review-repository.js';

const application='11111111-1111-4111-8111-111111111111';
const correlation='22222222-2222-4222-8222-222222222222';

function setup(allowed:readonly string[]){
  const query=vi.fn(async()=>({rows:[{activated_farmacia_id:application}]}));
  const requireCapability=vi.fn(async(code:string)=>{
    if(!allowed.includes(code))throw new Error('No autorizado');
  });
  const repository=new PgPlatformReviewRepository(
    {query} as never,{require:requireCapability} as never);
  return {repository,query,requireCapability};
}

describe('F02.5 permisos expresos de plataforma',()=>{
  it('niega aprobación si el administrador solo tiene permiso de decisión',async()=>{
    const {repository,query,requireCapability}=setup(['F025_APPLICATION_DECIDE']);
    await expect(repository.decide(application,1,'APROBAR','Motivo TEST válido',
      'idempotency-key-test',correlation)).rejects.toThrow('No autorizado');
    expect(requireCapability).toHaveBeenCalledWith('F025_PHARMACY_ACTIVATE');
    expect(query).not.toHaveBeenCalled();
  });
  it('requiere ambas capacidades antes de activar y no confiere inventario',async()=>{
    const {repository,query,requireCapability}=setup([
      'F025_APPLICATION_DECIDE','F025_PHARMACY_ACTIVATE']);
    await repository.decide(application,1,'APROBAR','Motivo TEST válido',
      'idempotency-key-test',correlation);
    expect(requireCapability.mock.calls.map(call=>call[0])).toEqual([
      'F025_APPLICATION_DECIDE','F025_PHARMACY_ACTIVATE']);
    expect(query).toHaveBeenCalledOnce();
    expect(query.mock.calls[0][0]).toContain('f025.activate_application');
  });
  it('niega rechazo y listado sin sus grants específicos antes de consultar SQL',async()=>{
    const {repository,query}=setup([]);
    await expect(repository.decide(application,1,'RECHAZAR','Motivo TEST válido',
      'idempotency-key-test',correlation)).rejects.toThrow('No autorizado');
    await expect(repository.list(null,20)).rejects.toThrow('No autorizado');
    expect(query).not.toHaveBeenCalled();
  });
});
