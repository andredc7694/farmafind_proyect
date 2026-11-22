import {Router,json} from 'express';
import type {Request,Response,NextFunction} from 'express';
import {authHttpSecurity,readSessionCookie,sendIdentityError} from '../../usuarios/contracts/http-security.js';
import type {AuthHttpOptions} from '../../usuarios/contracts/http-security.js';
import type {ManagePharmacyProfile} from '../application/manage-pharmacy-profile.js';

function failure(error:unknown,response:Response){
  const code=(error as {code?:string})?.code;
  const message=error instanceof Error?error.message:'';
  if(message==='Entrada no válida'||code==='22023')sendIdentityError(response,400,'BAD_REQUEST','Entrada no válida');
  else if(message==='No autorizado')sendIdentityError(response,401,'UNAUTHENTICATED','Sesión no válida');
  else if(message==='No visible'||code==='42501')sendIdentityError(response,404,'NOT_VISIBLE','Recurso no visible');
  else if(message==='Conflicto'||code==='40001')sendIdentityError(response,409,'CONFLICT','Versión en conflicto');
  else sendIdentityError(response,500,'INTERNAL','No se pudo completar la solicitud');
}
export function createPharmacyProfileRouter(manage:ManagePharmacyProfile,options:AuthHttpOptions):Router{
  const router=Router(),security=authHttpSecurity(options);
  router.use((_request,response,next)=>{response.set('Cache-Control','no-store');next();});
  router.use(json({limit:'2kb'}));
  router.use((_error:unknown,_request:Request,response:Response,_next:NextFunction)=>
    sendIdentityError(response,400,'BAD_REQUEST','Entrada no válida'));
  router.get('/farmacias/:farmaciaId/perfil',async(request,response)=>{
    const secret=readSessionCookie(request,options);
    if(!secret)return sendIdentityError(response,401,'UNAUTHENTICATED','Sesión no válida');
    try{return response.status(200).json(await manage.get(secret,String(request.params.farmaciaId)));}
    catch(error){failure(error,response);}
  });
  router.patch('/farmacias/:farmaciaId/perfil',security.requireCsrf,async(request,response)=>{
    const secret=readSessionCookie(request,options);
    if(!secret)return sendIdentityError(response,401,'UNAUTHENTICATED','Sesión no válida');
    const body=request.body as unknown;
    if(!body||typeof body!=='object'||Array.isArray(body)||
      Object.keys(body).sort().join(',')!=='contacto,version')
      return sendIdentityError(response,400,'BAD_REQUEST','Entrada no válida');
    const fields=body as {contacto:unknown;version:unknown};
    if(typeof fields.contacto!=='string'||!Number.isSafeInteger(fields.version))
      return sendIdentityError(response,400,'BAD_REQUEST','Entrada no válida');
    try{return response.status(200).json(await manage.updateContact(secret,
      String(request.params.farmaciaId),fields.contacto,Number(fields.version)));}
    catch(error){failure(error,response);}
  });
  return router;
}
