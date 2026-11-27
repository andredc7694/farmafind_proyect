import { Router, json } from 'express';
import type { NextFunction, Request, Response } from 'express';
import { authHttpSecurity, readSessionCookie, sendIdentityError } from '../../usuarios/contracts/http-security.js';
import type { AuthHttpOptions } from '../../usuarios/contracts/http-security.js';
import { LocationConflictError, LocationForbiddenError, LocationNotVisibleError,
  LocationValidationError } from '../domain/pharmacy-location.js';
import type { PlatformLocationReview } from '../application/platform-location-review.js';

interface LiveSession { session(secret:string):Promise<{userId:string}> }
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function failure(error:unknown,response:Response):void {
  if(error instanceof LocationValidationError) sendIdentityError(response,400,'BAD_REQUEST','Entrada no válida');
  else if(error instanceof LocationForbiddenError) sendIdentityError(response,403,'FORBIDDEN','Permiso insuficiente');
  else if(error instanceof LocationNotVisibleError) sendIdentityError(response,404,'NOT_VISIBLE','Recurso no visible');
  else if(error instanceof LocationConflictError) sendIdentityError(response,409,'CONFLICT','Operación no disponible');
  else if(error instanceof Error && error.message==='No autorizado')
    sendIdentityError(response,401,'UNAUTHENTICATED','Sesión no válida');
  else sendIdentityError(response,500,'INTERNAL','No se pudo completar la solicitud');
}

/** F071-FR-005: revisión de ubicaciones por el administrador de plataforma (solo datos públicos). */
export function createPlatformLocationsRouter(identity:LiveSession,review:PlatformLocationReview,
  options:AuthHttpOptions):Router {
  const router=Router();
  const security=authHttpSecurity(options);
  router.use('/platform/location-proposals',(_request,response,next)=>{response.set('Cache-Control','no-store');next();});
  router.use('/platform/location-proposals',json({limit:'4kb'}));
  router.use('/platform/location-proposals',(_error:unknown,_request:Request,response:Response,_next:NextFunction)=>{
    sendIdentityError(response,400,'BAD_REQUEST','Entrada no válida');
  });
  async function session(request:Request,response:Response):Promise<string|null> {
    const secret=readSessionCookie(request,options);
    if(!secret){sendIdentityError(response,401,'UNAUTHENTICATED','Sesión no válida');return null;}
    try { const view=await identity.session(secret); if(!uuid.test(view.userId)) throw new Error(); return secret; }
    catch {sendIdentityError(response,401,'UNAUTHENTICATED','Sesión no válida');return null;}
  }
  router.get('/platform/location-proposals',async(request,response)=>{
    const secret=await session(request,response); if(!secret)return;
    try {response.status(200).json(await review.list(secret));}
    catch(error){failure(error,response);}
  });
  router.get('/platform/location-proposals/historial',async(request,response)=>{
    const secret=await session(request,response); if(!secret)return;
    try {response.status(200).json(await review.history(secret,request.query.estado,request.query.pagina));}
    catch(error){failure(error,response);}
  });
  router.post('/platform/location-proposals/:propuestaId/decision',security.requireCsrf,async(request,response)=>{
    const secret=await session(request,response); if(!secret)return;
    const proposalId=String(request.params.propuestaId);
    if(!uuid.test(proposalId)){sendIdentityError(response,400,'BAD_REQUEST','Entrada no válida');return;}
    try {response.status(200).json(await review.decide(secret,proposalId,request.body));}
    catch(error){failure(error,response);}
  });
  return router;
}
