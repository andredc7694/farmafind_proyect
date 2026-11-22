import { Router,json } from 'express';
import type { Request,Response,NextFunction } from 'express';
import { authHttpSecurity,readSessionCookie,sendIdentityError,type AuthHttpOptions } from '../../usuarios/contracts/http-security.js';

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
interface CustomerServices {
  create:{execute(secret:string,input:{pharmacyId:string;medicationId:string;quantity:number;idempotencyKey:string}):Promise<{reservation:unknown;replay:boolean}>};
  own:{list(secret:string):Promise<unknown>;detail(secret:string,id:string):Promise<unknown|null>};
  cancel:{execute(secret:string,id:string,key:string):Promise<unknown>};
}
function key(request:Request){const value=request.get('Idempotency-Key');return value&&value.length>=8&&value.length<=128?value:null;}
function fail(response:Response,error:unknown){const message=error instanceof Error?error.message:'';if(message.includes('disponibilidad')||message.includes('Transicion')||message.includes('vencida')||message.includes('Idempotencia'))sendIdentityError(response,409,'CONFLICT','Operacion en conflicto');else sendIdentityError(response,404,'NOT_VISIBLE','Recurso no visible');}

export function createCustomerReservationsRouter(services:CustomerServices,options:AuthHttpOptions):Router {
  const router=Router();const security=authHttpSecurity(options);router.use((_q,r,n)=>{r.set('Cache-Control','no-store');n();});router.use(json({limit:'8kb'}));
  router.use((_e:unknown,_q:Request,r:Response,_n:NextFunction)=>sendIdentityError(r,400,'BAD_REQUEST','Entrada no valida'));
  const secret=(q:Request,r:Response)=>{const value=readSessionCookie(q,options);if(!value)sendIdentityError(r,401,'UNAUTHENTICATED','Sesion no valida');return value;};
  router.post('/reservas',security.requireCsrf,async(q,r)=>{const session=secret(q,r),idem=key(q);if(!session)return;const body=q.body as Record<string,unknown>;
    if(!idem||!body||!uuid.test(String(body.pharmacyId))||!uuid.test(String(body.medicationId))||!Number.isInteger(body.quantity)||(body.quantity as number)<1){sendIdentityError(r,422,'INVALID_INPUT','Entrada no valida');return;}
    try{const result=await services.create.execute(session,{pharmacyId:String(body.pharmacyId),medicationId:String(body.medicationId),quantity:body.quantity as number,idempotencyKey:idem});r.status(result.replay?200:201).json(result.reservation);}catch(e){fail(r,e);}});
  router.get('/reservas',async(q,r)=>{const session=secret(q,r);if(!session)return;try{r.json(await services.own.list(session));}catch(e){fail(r,e);}});
  router.get('/reservas/:reservationId',async(q,r)=>{const session=secret(q,r);if(!session)return;const id=q.params.reservationId;if(typeof id!=='string'||!uuid.test(id)){fail(r,null);return;}try{const value=await services.own.detail(session,id);if(!value){fail(r,null);return;}r.json(value);}catch(e){fail(r,e);}});
  router.post('/reservas/:reservationId/cancelar',security.requireCsrf,async(q,r)=>{const session=secret(q,r),idem=key(q),id=q.params.reservationId;if(!session)return;if(!idem||typeof id!=='string'||!uuid.test(id)){sendIdentityError(r,422,'INVALID_INPUT','Entrada no valida');return;}try{r.json(await services.cancel.execute(session,id,idem));}catch(e){fail(r,e);}});
  return router;
}
