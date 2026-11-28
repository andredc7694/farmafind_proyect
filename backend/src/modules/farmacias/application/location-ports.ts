import type { LocationProposalInput } from '../domain/pharmacy-location.js';

export interface StoredLocationProposal extends LocationProposalInput {
  readonly id:string; readonly pharmacyId:string; readonly proposerId:string;
  readonly reviewerId:string|null; readonly status:'PENDIENTE'|'PUBLICADA_VERIFICADA'|'RECHAZADA';
  readonly version:number; readonly basePublicVersion:number;
}
/** F07.1: lectura del estado e historial de la propia farmacia (RLS por GEO_LOCATION_PROPOSE). */
export interface LocationHistoryRow {
  readonly proposal:StoredLocationProposal; readonly proposedAt:string; readonly reviewedAt:string|null;
  readonly reason:string|null;
}
export interface PublicLocationState {
  readonly verified:boolean; readonly address:string; readonly city:string|null;
  readonly latitude:number|null; readonly longitude:number|null; readonly verifiedAt:string|null;
}
export interface LocationRepository {
  history?(pharmacyId:string,limit:number):Promise<LocationHistoryRow[]>;
  publicState?(pharmacyId:string):Promise<PublicLocationState|null>;
  publicVersion(pharmacyId:string):Promise<number|null>;
  insert(pharmacyId:string,actorId:string,input:LocationProposalInput,basePublicVersion:number):Promise<StoredLocationProposal>;
  /** F07.2 (FR-002): procesa de a uno los envíos de una farmacia dentro de la transacción. */
  lockProposals?(pharmacyId:string):Promise<void>;
  /** F07.2 (D-05 A): propuesta PENDIENTE idéntica del mismo autor en los últimos 10 s (o null). */
  findRecentIdentical?(pharmacyId:string,actorId:string,input:LocationProposalInput):Promise<StoredLocationProposal|null>;
  find(pharmacyId:string,proposalId:string):Promise<StoredLocationProposal|null>;
  decide(pharmacyId:string,proposalId:string,actorId:string,status:'PUBLICADA_VERIFICADA'|'RECHAZADA',version:number):Promise<StoredLocationProposal|null>;
  publish(proposal:StoredLocationProposal):Promise<boolean>;
  audit(pharmacyId:string,proposalId:string,actorId:string,action:'PROPUESTA'|'APROBACION'|'RECHAZO',
    evidenceConfirmed?:boolean,reason?:string|null):Promise<void>;
}
export interface AuthorizedLocationContext {
  readonly pharmacyId:string; readonly actorId:string;
  readonly capability:'GEO_LOCATION_PROPOSE'|'GEO_LOCATION_REVIEW';
}
export interface LocationUnitOfWork {
  run<T>(secret:string,pharmacyId:string,capability:AuthorizedLocationContext['capability'],
    work:(repository:LocationRepository,context:AuthorizedLocationContext)=>Promise<T>):Promise<T>;
}
