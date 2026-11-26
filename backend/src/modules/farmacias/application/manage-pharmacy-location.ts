import { LocationConflictError, LocationForbiddenError, LocationNotVisibleError,
  parseLocationProposal, parseLocationReview } from '../domain/pharmacy-location.js';
import type { LocationUnitOfWork } from './location-ports.js';
import { buildLocationStatus } from './location-status.js';
import type { SearchInvalidator } from '../../busqueda/contracts/search-invalidator.js';

export class ManagePharmacyLocation {
  constructor(private readonly transactions:LocationUnitOfWork,private readonly invalidator?:SearchInvalidator) {}

  async propose(secret:string,pharmacyId:string,raw:unknown) {
    const input=parseLocationProposal(raw);
    return this.transactions.run(secret,pharmacyId,'GEO_LOCATION_PROPOSE',async(repository,context)=>{
      const base=await repository.publicVersion(pharmacyId);
      if (base===null) throw new LocationNotVisibleError('Farmacia no visible');
      const proposal=await repository.insert(pharmacyId,context.actorId,input,base);
      await repository.audit(pharmacyId,proposal.id,context.actorId,'PROPUESTA');
      return {id:proposal.id,estado:proposal.status,version:proposal.version};
    });
  }

  /** F071-FR-013: comprueba que el actor puede proponer en esa farmacia (sin escribir nada). */
  async authorizePropose(secret:string,pharmacyId:string):Promise<void> {
    await this.transactions.run(secret,pharmacyId,'GEO_LOCATION_PROPOSE',async()=>undefined);
  }

  /** F071-FR-006: estado e historial de la propia farmacia (quien puede proponer). */
  status(secret:string,pharmacyId:string) {
    return this.transactions.run(secret,pharmacyId,'GEO_LOCATION_PROPOSE',async(repository,context)=>{
      if (!repository.history || !repository.publicState) throw new LocationNotVisibleError('Historial no disponible');
      const [history,published]=await Promise.all([repository.history(pharmacyId,50),repository.publicState(pharmacyId)]);
      return buildLocationStatus(history,published,context.actorId);
    });
  }

  async review(secret:string,pharmacyId:string,proposalId:string,raw:unknown) {
    const review=parseLocationReview(raw);
    const outcome=await this.transactions.run(secret,pharmacyId,'GEO_LOCATION_REVIEW',async(repository,context)=>{
      const proposal=await repository.find(pharmacyId,proposalId);
      if (!proposal) throw new LocationNotVisibleError('Propuesta no visible');
      if (proposal.proposerId===context.actorId) throw new LocationForbiddenError('Revisión propia prohibida');
      const target=review.decision==='APROBAR'?'PUBLICADA_VERIFICADA':'RECHAZADA';
      if (proposal.status!== 'PENDIENTE') {
        if (proposal.status===target) return {result:{id:proposal.id,estado:target,version:proposal.version},changed:false};
        throw new LocationConflictError('Decisión incompatible');
      }
      const decided=await repository.decide(pharmacyId,proposalId,context.actorId,target,proposal.version);
      if (!decided) throw new LocationConflictError('Versión obsoleta');
      if (target==='PUBLICADA_VERIFICADA' && !(await repository.publish(decided)))
        throw new LocationConflictError('Ubicación pública cambió');
      await repository.audit(pharmacyId,proposalId,context.actorId,
        target==='PUBLICADA_VERIFICADA'?'APROBACION':'RECHAZO',review.evidenceConfirmed,review.reason);
      return {result:{id:decided.id,estado:target,version:decided.version},changed:target==='PUBLICADA_VERIFICADA'};
    });
    if (outcome.changed && this.invalidator) await this.invalidator.invalidate();
    return outcome.result;
  }
}
