import { Router, json } from 'express';
import type { NextFunction, Request, Response } from 'express';
import { authHttpSecurity, readSessionCookie, sendIdentityError } from '../../usuarios/contracts/http-security.js';
import type { AuthHttpOptions } from '../../usuarios/contracts/http-security.js';
import { LocationConflictError, LocationForbiddenError, LocationNotVisibleError,
  LocationValidationError } from '../domain/pharmacy-location.js';
import type { ManagePharmacyLocation } from '../application/manage-pharmacy-location.js';

interface LiveSession { session(secret:string):Promise<{userId:string}> }
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function failure(error:unknown,response:Response):void {
  if(error instanceof LocationValidationError) sendIdentityError(response,400,'BAD_REQUEST','Entrada no válida');
  else if(error instanceof LocationForbiddenError || (error instanceof Error && error.message==='Permiso insuficiente'))
    sendIdentityError(response,403,'FORBIDDEN','Permiso insuficiente');
  else if(error instanceof LocationNotVisibleError || (error instanceof Error && error.message==='No visible'))
    sendIdentityError(response,404,'NOT_VISIBLE','Recurso no visible');
  else if(error instanceof LocationConflictError || (error instanceof Error && error.message==='Conflicto'))
    sendIdentityError(response,409,'CONFLICT','Operación no disponible');
  else if(error instanceof Error && error.message==='No autorizado')
    sendIdentityError(response,401,'UNAUTHENTICATED','Sesión no válida');
  else sendIdentityError(response,500,'INTERNAL','No se pudo completar la solicitud');
}

/** F07 private writes remain available only in the isolated TEST composition. */
export function createLocationRouter(identity:LiveSession, management:ManagePharmacyLocation,
  options:AuthHttpOptions):Router {
  const router=Router();
  const security=authHttpSecurity(options);
  router.use((_request,response,next)=>{response.set('Cache-Control','no-store');next();});
  router.use(json({limit:'8kb'}));
  router.use((_error:unknown,_request:Request,response:Response,_next:NextFunction)=>{
    sendIdentityError(response,400,'BAD_REQUEST','Entrada no válida');
  });
  async function session(request:Request,response:Response):Promise<string|null> {
    const secret=readSessionCookie(request,options);
    if(!secret){sendIdentityError(response,401,'UNAUTHENTICATED','Sesión no válida');return null;}
    try { const view=await identity.session(secret); if(!uuid.test(view.userId)) throw new Error(); return secret; }
    catch {sendIdentityError(response,401,'UNAUTHENTICATED','Sesión no válida');return null;}
  }
  router.get('/farmacias/:farmaciaId/ubicacion',async(request,response)=>{
    const secret=await session(request,response); if(!secret)return;
    const pharmacyId=String(request.params.farmaciaId);
    if(!uuid.test(pharmacyId)){sendIdentityError(response,400,'BAD_REQUEST','Entrada no válida');return;}
    try {response.status(200).json(await management.status(secret,pharmacyId));}
    catch(error){failure(error,response);}
  });
  router.post('/farmacias/:farmaciaId/ubicacion/propuestas',security.requireCsrf,async(request,response)=>{
    const secret=await session(request,response); if(!secret)return;
    const pharmacyId=String(request.params.farmaciaId);
    if(!uuid.test(pharmacyId)){sendIdentityError(response,400,'BAD_REQUEST','Entrada no válida');return;}
    try {response.status(201).json(await management.propose(secret,pharmacyId,request.body));}
    catch(error){failure(error,response);}
  });
  router.post('/farmacias/:farmaciaId/ubicacion/propuestas/:propuestaId/revision',security.requireCsrf,
    async(request,response)=>{
      const secret=await session(request,response); if(!secret)return;
      const pharmacyId=String(request.params.farmaciaId);
      const proposalId=String(request.params.propuestaId);
      if(!uuid.test(pharmacyId)||!uuid.test(proposalId)){
        sendIdentityError(response,400,'BAD_REQUEST','Entrada no válida');return;
      }
      try {response.status(200).json(await management.review(secret,pharmacyId,proposalId,request.body));}
      catch(error){failure(error,response);}
    });
  return router;
}
