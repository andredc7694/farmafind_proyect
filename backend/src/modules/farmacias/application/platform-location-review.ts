import { LocationConflictError, LocationForbiddenError, LocationNotVisibleError, LocationValidationError,
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
  /** F07.2: la propuesta más reciente de cada farmacia, solo si sigue pendiente (sin ninguna más nueva). */
  listLatestPending(limit:number):Promise<PendingLocationView[]>;
  find(proposalId:string):Promise<StoredLocationProposal|null>;
  isLatestPending(proposal:StoredLocationProposal):Promise<boolean>;
  /** Repositorio F07 acotado a la farmacia de la propuesta (decidir, publicar, auditar). */
  forPharmacy(pharmacyId:string):LocationRepository;
  /** F071-FR-017: historial (RLS 007 + 009); sin identificadores de usuario. */
  listHistory?(status:HistoryStatus,actorId:string,limit:number,offset:number):Promise<{total:number;rows:LocationHistoryView[]}>;
}

export type HistoryStatus='PENDIENTE'|'PUBLICADA_VERIFICADA'|'RECHAZADA'|'REEMPLAZADA';
/** Fila del historial: solo datos de ubicación y decisión (FR-017). */
export interface LocationHistoryView {
  readonly propuestaId:string; readonly farmaciaNombre:string; readonly direccion:string; readonly ciudad:string;
  readonly latitud:number; readonly longitud:number; readonly decision:'PENDIENTE'|'APROBADA'|'RECHAZADA'|'REEMPLAZADA';
  readonly motivo:string|null; readonly enviadaAt:string; readonly decididaAt:string|null;
  readonly decididoPor:'Tú'|'Otro revisor de FarmaFind'|null;
}
export const HISTORY_PAGE_SIZE=20;
const historyFilter:Record<string,HistoryStatus>={PENDIENTE:'PENDIENTE',APROBADA:'PUBLICADA_VERIFICADA',RECHAZADA:'RECHAZADA',
  REEMPLAZADA:'REEMPLAZADA'};
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

  /** F071-FR-017: historial con filtro y paginación (20 por página, de la más reciente a la más antigua). */
  async history(secret:string,rawStatus:unknown,rawPage:unknown) {
    const status=historyFilter[String(rawStatus ?? 'PENDIENTE')];
    const page=rawPage===undefined ? 1 : Number(rawPage);
    if (!status || !Number.isSafeInteger(page) || page<1 || page>1000) throw new LocationValidationError('Filtro inválido');
    return this.transactions.run(secret,async(repository,actorId)=>{
      if (!(await repository.isReviewer()) || !repository.listHistory) throw new LocationForbiddenError('Sin concesión de revisión');
      const result=await repository.listHistory(status,actorId,HISTORY_PAGE_SIZE,(page-1)*HISTORY_PAGE_SIZE);
      return {pagina:page,porPagina:HISTORY_PAGE_SIZE,total:result.total,filas:result.rows};
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
