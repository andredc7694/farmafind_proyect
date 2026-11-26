import { LocationConflictError, LocationForbiddenError, LocationNotVisibleError,
  parsePlatformLocationDecision } from '../domain/pharmacy-location.js';
import type { LocationRepository, StoredLocationProposal } from './location-ports.js';
import type { SearchInvalidator } from '../../busqueda/contracts/search-invalidator.js';

/** Datos públicos que ve el revisor de plataforma (nunca identificadores de usuario). */
export interface PendingLocationView {
  readonly propuestaId:string; readonly farmaciaId:string; readonly farmaciaNombre:string;
  readonly direccionPublicable:string; readonly ciudad:string; readonly latitud:number; readonly longitud:number;
  readonly precisionMetros:number|null; readonly fuente:string; readonly evidenciaReferencia:string|null;
  readonly version:number; readonly propuestaAt:string;
}
export interface PlatformLocationRepository {
  /** Verdadero solo con rol de plataforma activo y concesión F07.1 activa (RLS en la base). */
  isReviewer():Promise<boolean>;
  /** La última propuesta pendiente de cada farmacia visible para el revisor. */
  listLatestPending(limit:number):Promise<PendingLocationView[]>;
  find(proposalId:string):Promise<StoredLocationProposal|null>;
  isLatestPending(proposal:StoredLocationProposal):Promise<boolean>;
  /** Repositorio F07 acotado a la farmacia de la propuesta (decidir, publicar, auditar). */
  forPharmacy(pharmacyId:string):LocationRepository;
}
export interface PlatformLocationUnitOfWork {
  run<T>(secret:string,work:(repository:PlatformLocationRepository,actorId:string)=>Promise<T>):Promise<T>;
}

/** F071-FR-005: revisión de ubicaciones por el administrador de plataforma (D-04 A: solo la última pendiente). */
export class PlatformLocationReview {
  constructor(private readonly transactions:PlatformLocationUnitOfWork,private readonly invalidator?:SearchInvalidator) {}

  list(secret:string):Promise<PendingLocationView[]> {
    return this.transactions.run(secret,async repository=>{
      if (!(await repository.isReviewer())) throw new LocationForbiddenError('Sin concesión de revisión');
      return repository.listLatestPending(100);
    });
  }

  async decide(secret:string,proposalId:string,raw:unknown) {
    const input=parsePlatformLocationDecision(raw);
    const outcome=await this.transactions.run(secret,async(repository,actorId)=>{
      if (!(await repository.isReviewer())) throw new LocationForbiddenError('Sin concesión de revisión');
      const proposal=await repository.find(proposalId);
      if (!proposal) throw new LocationNotVisibleError('Propuesta no visible');
      if (proposal.proposerId===actorId) throw new LocationForbiddenError('Revisión propia prohibida');
      if (proposal.status!=='PENDIENTE') throw new LocationConflictError('Propuesta ya decidida');
      if (proposal.version!==input.version) throw new LocationConflictError('Versión obsoleta');
      if (!(await repository.isLatestPending(proposal))) throw new LocationConflictError('Propuesta reemplazada');
      const local=repository.forPharmacy(proposal.pharmacyId);
      const target=input.decision==='APROBAR'?'PUBLICADA_VERIFICADA':'RECHAZADA';
      const decided=await local.decide(proposal.pharmacyId,proposal.id,actorId,target,proposal.version);
      if (!decided) throw new LocationConflictError('Versión obsoleta');
      if (target==='PUBLICADA_VERIFICADA' && !(await local.publish(decided)))
        throw new LocationConflictError('Ubicación pública cambió');
      await local.audit(proposal.pharmacyId,proposal.id,actorId,
        target==='PUBLICADA_VERIFICADA'?'APROBACION':'RECHAZO',input.evidenceConfirmed,input.reason);
      return {result:{propuestaId:decided.id,estado:target,version:decided.version},changed:target==='PUBLICADA_VERIFICADA'};
    });
    if (outcome.changed && this.invalidator) await this.invalidator.invalidate();
    return outcome.result;
  }
}
