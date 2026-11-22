import {describe,expect,it,vi} from 'vitest';
import {ReviewApplications,type ReviewRepository,type ReviewUnitOfWork} from '../../src/modules/farmacias/application/review-applications.js';

const id='11111111-1111-4111-8111-111111111111';
const input=(action:'APROBAR'|'RECHAZAR')=>({action,version:1,reason:'Motivo ficticio TEST',
  key:'idempotency-key-test-0001'});

function setup(rollback=false){
  const order:string[]=[];
  const repository={decide:vi.fn(async()=>{
    order.push('sql');
    return {solicitudId:id,estado:'APROBADA',version:2,farmaciaId:id};
  })} as unknown as ReviewRepository;
  const unit:ReviewUnitOfWork={runReview:async(_secret,work)=>{
    const result=await work(repository);
    if(rollback)throw new Error('Rollback TEST');
    order.push('commit');
    return result;
  }};
  const publication={invalidate:vi.fn(async()=>{order.push('invalidate');})};
  return {service:new ReviewApplications(unit,publication),publication,order};
}

describe('F02.5 proyeccion publica y cache F03',()=>{
  it('invalida solo despues de confirmar la activacion',async()=>{
    const {service,publication,order}=setup();
    await service.decide('session-test',id,input('APROBAR'));
    expect(order).toEqual(['sql','commit','invalidate']);
    expect(publication.invalidate).toHaveBeenCalledOnce();
  });
  it('no invalida si la transaccion falla o la decision es rechazo',async()=>{
    const failed=setup(true);
    await expect(failed.service.decide('session-test',id,input('APROBAR'))).rejects.toThrow('Rollback TEST');
    expect(failed.publication.invalidate).not.toHaveBeenCalled();
    const rejected=setup();
    await rejected.service.decide('session-test',id,input('RECHAZAR'));
    expect(rejected.publication.invalidate).not.toHaveBeenCalled();
  });
  it('Redis indisponible no revierte una aprobacion ya confirmada',async()=>{
    const {service,publication}=setup();
    publication.invalidate.mockRejectedValueOnce(new Error('Redis TEST indisponible'));
    await expect(service.decide('session-test',id,input('APROBAR')))
      .resolves.toMatchObject({estado:'APROBADA',farmaciaId:id});
  });
});
