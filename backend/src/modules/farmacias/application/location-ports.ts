import type { LocationProposalInput } from '../domain/pharmacy-location.js';

export interface StoredLocationProposal extends LocationProposalInput {
  readonly id:string; readonly pharmacyId:string; readonly proposerId:string;
  readonly reviewerId:string|null; readonly status:'PENDIENTE'|'PUBLICADA_VERIFICADA'|'RECHAZADA';
  readonly version:number; readonly basePublicVersion:number;
}
export interface LocationRepository {
  publicVersion(pharmacyId:string):Promise<number|null>;
  insert(pharmacyId:string,actorId:string,input:LocationProposalInput,basePublicVersion:number):Promise<StoredLocationProposal>;
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
