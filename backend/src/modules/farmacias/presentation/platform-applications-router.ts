import {Router,json} from 'express';
import type {NextFunction,Request,Response} from 'express';
import type {ReviewApplications,ReviewAction} from '../application/review-applications.js';
import {authHttpSecurity,readSessionCookie,sendIdentityError} from '../../usuarios/contracts/http-security.js';
import type {AuthHttpOptions} from '../../usuarios/contracts/http-security.js';

interface LiveSession {session(secret:string):Promise<unknown>}
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function failure(error:unknown,response:Response){
  const code=(error as {code?:string})?.code;
  const message=error instanceof Error?error.message:'';
  if(message==='Entrada no válida'||code==='22023')
    sendIdentityError(response,400,'BAD_REQUEST','Entrada no válida');
  else if(message==='No autorizado'||code==='42501')
    sendIdentityError(response,403,'FORBIDDEN','Permiso insuficiente');
  else if(message==='No visible')
    sendIdentityError(response,404,'NOT_VISIBLE','Recurso no visible');
  else if(message==='Conflicto'||['23505','23514','40001'].includes(code??''))
    sendIdentityError(response,409,'CONFLICT','Operación no disponible');
  else sendIdentityError(response,500,'INTERNAL','No se pudo completar la solicitud');
}

export function createPlatformApplicationsRouter(identity:LiveSession,review:ReviewApplications,
  options:AuthHttpOptions):Router{
  const router=Router();const security=authHttpSecurity(options);
  router.use((_request,response,next)=>{response.set('Cache-Control','no-store');next();});
  router.use(json({limit:'8kb'}));
  router.use((_error:unknown,_request:Request,response:Response,_next:NextFunction)=>
    sendIdentityError(response,400,'BAD_REQUEST','Entrada no válida'));
  async function secret(request:Request,response:Response){
    const value=readSessionCookie(request,options);
    if(!value){sendIdentityError(response,401,'UNAUTHENTICATED','Sesión no válida');return null;}
    try{await identity.session(value);return value;}
    catch{sendIdentityError(response,401,'UNAUTHENTICATED','Sesión no válida');return null;}
  }
  router.get('/platform/pharmacy-applications',async(request,response)=>{
    const value=await secret(request,response);if(!value)return;
    const state=typeof request.query.estado==='string'?request.query.estado:null;
    const limit=request.query.limit===undefined?20:Number(request.query.limit);
    if(!Number.isSafeInteger(limit)||limit<1||limit>100){
      sendIdentityError(response,400,'BAD_REQUEST','Entrada no válida');return;
    }
    try{response.status(200).json(await review.list(value,state,limit));}
    catch(error){failure(error,response);}
  });
  router.get('/platform/pharmacy-applications/:applicationId',async(request,response)=>{
    const value=await secret(request,response);if(!value)return;
    try{response.status(200).json(await review.detail(value,String(request.params.applicationId)));}
    catch(error){failure(error,response);}
  });
  router.post('/platform/pharmacy-applications/:applicationId/decisions',security.requireCsrf,
    async(request,response)=>{
      const value=await secret(request,response);if(!value)return;
      const id=String(request.params.applicationId);
      const body=request.body as unknown;
      if(!uuid.test(id)||!body||typeof body!=='object'||Array.isArray(body)||
        Object.keys(body).length!==3||!('accion' in body)||!('version' in body)||
        !('motivo' in body)||typeof body.accion!=='string'||
        !['INICIAR_REVISION','OBSERVAR','RECHAZAR','APROBAR'].includes(body.accion)||
        typeof body.version!=='number'||!Number.isSafeInteger(body.version)||
        typeof body.motivo!=='string'){
        sendIdentityError(response,400,'BAD_REQUEST','Entrada no válida');return;
      }
      try{response.status(200).json(await review.decide(value,id,{
        action:body.accion as ReviewAction,version:body.version,reason:body.motivo,
        key:request.get('Idempotency-Key')??null,
      }));}
      catch(error){failure(error,response);}
    });
  return router;
}
