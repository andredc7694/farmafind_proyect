import { Router, json } from 'express';
import type { NextFunction, Request, Response } from 'express';
import { authHttpSecurity, readSessionCookie, sendIdentityError } from '../../usuarios/contracts/http-security.js';
import type { AuthHttpOptions } from '../../usuarios/contracts/http-security.js';
import { OpeningHoursValidationError } from '../domain/opening-hours.js';
import { OpeningHoursConflictError, OpeningHoursForbiddenError } from '../application/manage-opening-hours.js';
import type { ManageOpeningHours, ReadPublicOpeningHours } from '../application/manage-opening-hours.js';

interface LiveSession { session(secret:string):Promise<{userId:string}> }
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function failure(error:unknown,response:Response):void {
  if (error instanceof OpeningHoursValidationError) sendIdentityError(response,422,'UNPROCESSABLE',error.message);
  else if (error instanceof OpeningHoursForbiddenError) sendIdentityError(response,403,'FORBIDDEN','Permiso insuficiente');
  else if (error instanceof OpeningHoursConflictError) sendIdentityError(response,409,'CONFLICT','El horario cambió; recarga e inténtalo de nuevo');
  else if (error instanceof Error && error.message==='No autorizado') sendIdentityError(response,401,'UNAUTHENTICATED','Sesión no válida');
  else sendIdentityError(response,500,'INTERNAL','No se pudo completar la solicitud');
}

/** F071-FR-008: horario privado (con versión) y lectura pública por lista de farmacias. */
export function createOpeningHoursRouter(identity:LiveSession,manage:ManageOpeningHours,
  publicHours:ReadPublicOpeningHours,options:AuthHttpOptions):Router {
  const router=Router();
  const security=authHttpSecurity(options);
  router.get('/farmacias-publicas/horarios',async(request,response)=>{
    try {
      response.set('Cache-Control','public, max-age=60');
      response.status(200).json(await publicHours.read(request.query.ids));
    } catch (error) {
      if (error instanceof RangeError) sendIdentityError(response,400,'BAD_REQUEST','Entrada no válida');
      else sendIdentityError(response,500,'INTERNAL','No se pudo completar la solicitud');
    }
  });
  const path='/farmacias/:farmaciaId/horario';
  router.use(path,(_request,response,next)=>{response.set('Cache-Control','no-store');next();});
  router.use(path,json({limit:'4kb'}));
  router.use(path,(_error:unknown,_request:Request,response:Response,_next:NextFunction)=>{
    sendIdentityError(response,400,'BAD_REQUEST','Entrada no válida');
  });
  async function session(request:Request,response:Response):Promise<string|null> {
    const secret=readSessionCookie(request,options);
    if(!secret){sendIdentityError(response,401,'UNAUTHENTICATED','Sesión no válida');return null;}
    try { const view=await identity.session(secret); if(!uuid.test(view.userId)) throw new Error(); return secret; }
    catch {sendIdentityError(response,401,'UNAUTHENTICATED','Sesión no válida');return null;}
  }
  router.get(path,async(request,response)=>{
    const secret=await session(request,response); if(!secret)return;
    const pharmacyId=String(request.params.farmaciaId);
    if(!uuid.test(pharmacyId)){sendIdentityError(response,400,'BAD_REQUEST','Entrada no válida');return;}
    try {response.status(200).json(await manage.read(secret,pharmacyId));}
    catch(error){failure(error,response);}
  });
  router.put(path,security.requireCsrf,async(request,response)=>{
    const secret=await session(request,response); if(!secret)return;
    const pharmacyId=String(request.params.farmaciaId);
    if(!uuid.test(pharmacyId)){sendIdentityError(response,400,'BAD_REQUEST','Entrada no válida');return;}
    try {response.status(200).json(await manage.replace(secret,pharmacyId,request.body));}
    catch(error){failure(error,response);}
  });
  return router;
}
