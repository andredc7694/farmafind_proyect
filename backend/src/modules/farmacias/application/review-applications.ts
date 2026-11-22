import {randomUUID} from 'node:crypto';

export type ReviewAction='INICIAR_REVISION'|'OBSERVAR'|'RECHAZAR'|'APROBAR';
export interface ReviewSummary {id:string;estado:string;version:number;nombreComercial:string;solicitanteId:string}
export interface ReviewDetail extends ReviewSummary {
  contacto:string;direccion:string;departamento:string;provincia:string;distrito:string;
  representante:string;ruc:string|null;documentos:readonly unknown[];
}
export interface ReviewResult {solicitudId:string;estado:string;version:number;farmaciaId?:string}
export interface ReviewRepository {
  list(state:string|null,limit:number):Promise<readonly ReviewSummary[]>;
  detail(id:string):Promise<ReviewDetail|null>;
  decide(id:string,version:number,action:ReviewAction,reason:string,key:string|null,
    correlation:string):Promise<ReviewResult>;
}
export interface ReviewUnitOfWork {
  runReview<T>(secret:string,work:(repository:ReviewRepository)=>Promise<T>):Promise<T>;
}
export interface PublicationInvalidator { invalidate():Promise<void>; }
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const states=new Set(['BORRADOR','PENDIENTE','EN_REVISION','OBSERVADA','APROBADA','RECHAZADA','CANCELADA']);

export class ReviewApplications {
  constructor(private readonly unit:ReviewUnitOfWork,
    private readonly publication:PublicationInvalidator={invalidate:async()=>undefined}){}
  list(secret:string,state:string|null,limit:number){
    if((state!==null&&!states.has(state))||!Number.isSafeInteger(limit)||limit<1||limit>100)
      throw new Error('Entrada no válida');
    return this.unit.runReview(secret,repository=>repository.list(state,limit));
  }
  detail(secret:string,id:string){
    if(!uuid.test(id))throw new Error('Entrada no válida');
    return this.unit.runReview(secret,async repository=>{
      const item=await repository.detail(id);
      if(!item)throw new Error('No visible');
      return item;
    });
  }
  async decide(secret:string,id:string,input:{action:ReviewAction;version:number;reason:string;key:string|null}){
    if(!uuid.test(id)||!['INICIAR_REVISION','OBSERVAR','RECHAZAR','APROBAR'].includes(input.action)||
      !Number.isSafeInteger(input.version)||input.version<1||
      typeof input.reason!=='string'||input.reason.trim().length<8||input.reason.trim().length>500||
      ((input.action==='APROBAR'||input.action==='RECHAZAR')&&
        (!input.key||input.key.length<16||input.key.length>200)))throw new Error('Entrada no válida');
    const result=await this.unit.runReview(secret,repository=>repository.decide(id,input.version,input.action,
      input.reason.trim(),input.key,randomUUID()));
    if(input.action==='APROBAR'&&result.farmaciaId){
      // Commit is complete; Redis is derivative and may be unavailable.
      try{await this.publication.invalidate();}catch{ /* TTL bounds stale search results. */ }
    }
    return result;
  }
}
