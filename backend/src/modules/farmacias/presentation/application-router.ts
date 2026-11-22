import {Router,json} from 'express';
import type {NextFunction,Request,Response} from 'express';
import type {ManageApplications} from '../application/manage-applications.js';
import {authHttpSecurity,readSessionCookie,sendIdentityError} from '../../usuarios/contracts/http-security.js';
import type {AuthHttpOptions} from '../../usuarios/contracts/http-security.js';

interface LiveSession {session(secret:string):Promise<unknown>}
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function failure(error:unknown,response:Response){
  const code=(error as {code?:string})?.code;
  const message=error instanceof Error?error.message:'';
  if(message==='Entrada no válida'||code==='22023')
    sendIdentityError(response,400,'BAD_REQUEST','Entrada no válida');
  else if(message==='No autorizado')
    sendIdentityError(response,401,'UNAUTHENTICATED','Sesión no válida');
  else if(message==='No visible'||code==='42501')
    sendIdentityError(response,404,'NOT_VISIBLE','Recurso no visible');
  else if(code==='23505'||code==='40001'||message==='Conflicto')
    sendIdentityError(response,409,'CONFLICT','Operación no disponible');
  else sendIdentityError(response,500,'INTERNAL','No se pudo completar la solicitud');
}

/** Public registration is never privileged: it creates only a draft application. */
export function createPharmacyApplicationRouter(identity:LiveSession,management:ManageApplications,
  options:AuthHttpOptions):Router{
  const router=Router();
  const security=authHttpSecurity(options);
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
  router.post('/pharmacy-applications',security.requireCsrf,async(request,response)=>{
    const value=await secret(request,response);if(!value)return;
    try{response.status(201).json(await management.create(value,request.body));}
    catch(error){failure(error,response);}
  });
  router.get('/pharmacy-applications/me',async(request,response)=>{
    const value=await secret(request,response);if(!value)return;
    try{response.status(200).json(await management.list(value));}
    catch(error){failure(error,response);}
  });
  router.get('/pharmacy-applications/:applicationId',async(request,response)=>{
    const value=await secret(request,response);if(!value)return;
    try{response.status(200).json(await management.get(value,String(request.params.applicationId)));}
    catch(error){failure(error,response);}
  });
  router.patch('/pharmacy-applications/:applicationId',security.requireCsrf,async(request,response)=>{
    const value=await secret(request,response);if(!value)return;
    const body=request.body as unknown;
    if(!body||typeof body!=='object'||Array.isArray(body)||!('version' in body)||
      typeof body.version!=='number'||!Number.isSafeInteger(body.version)){
      sendIdentityError(response,400,'BAD_REQUEST','Entrada no válida');return;
    }
    const {version,...fields}=body;
    try{response.status(200).json(await management.edit(value,String(request.params.applicationId),version,fields));}
    catch(error){failure(error,response);}
  });
  for(const action of ['submit','cancel'] as const){
    router.post(`/pharmacy-applications/:applicationId/${action}`,security.requireCsrf,
      async(request,response)=>{
        const value=await secret(request,response);if(!value)return;
        const id=String(request.params.applicationId);
        const body=request.body as unknown;
        if(!uuid.test(id)||!body||typeof body!=='object'||Array.isArray(body)||
          Object.keys(body).length!==1||!('version' in body)||
          !Number.isSafeInteger(body.version)||Number(body.version)<1||
          (action==='submit'&&!/^.{16,200}$/.test(request.get('Idempotency-Key')??''))){
          sendIdentityError(response,400,'BAD_REQUEST','Entrada no válida');return;
        }
        try{
          const before=await management.get(value,id);
          const command=action==='cancel'?'CANCELAR':before.estado==='OBSERVADA'?'REENVIAR':'ENVIAR';
          response.status(200).json(await management.change(value,id,Number(body.version),command));
        }catch(error){failure(error,response);}
      });
  }
  return router;
}
