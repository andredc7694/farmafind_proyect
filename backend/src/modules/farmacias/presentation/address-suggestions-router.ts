import { Router, json } from 'express';
import type { NextFunction, Request, Response } from 'express';
import { authHttpSecurity, readSessionCookie, sendIdentityError } from '../../usuarios/contracts/http-security.js';
import type { AuthHttpOptions } from '../../usuarios/contracts/http-security.js';
import { LocationForbiddenError, LocationValidationError } from '../domain/pharmacy-location.js';
import { AddressSuggestionsBusyError, AddressSuggestionsDisabledError } from '../application/address-suggestions.js';
import type { AddressSuggestions } from '../application/address-suggestions.js';

interface LiveSession { session(secret:string):Promise<{userId:string}> }
interface ProposeAuthorizer { authorizePropose(secret:string,pharmacyId:string):Promise<void> }
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * F071-FR-013/014/016: sugerencias por POST (la dirección nunca va en la URL), con sesión, CSRF y
 * GEO_LOCATION_PROPOSE en esa farmacia. Sin registros de lo consultado.
 */
export function createAddressSuggestionsRouter(identity:LiveSession,authorizer:ProposeAuthorizer,
  suggestions:AddressSuggestions,options:AuthHttpOptions):Router {
  const router=Router();
  const security=authHttpSecurity(options);
  const path='/farmacias/:farmaciaId/ubicacion/sugerencias';
  router.use(path,(_request,response,next)=>{response.set('Cache-Control','no-store');next();});
  router.use(path,json({limit:'2kb'}));
  router.use(path,(_error:unknown,_request:Request,response:Response,_next:NextFunction)=>{
    sendIdentityError(response,400,'BAD_REQUEST','Entrada no válida');
  });
  async function guard(request:Request,response:Response):Promise<boolean> {
    const secret=readSessionCookie(request,options);
    const pharmacyId=String(request.params.farmaciaId);
    if(!secret){sendIdentityError(response,401,'UNAUTHENTICATED','Sesión no válida');return false;}
    if(!uuid.test(pharmacyId)){sendIdentityError(response,400,'BAD_REQUEST','Entrada no válida');return false;}
    try { const view=await identity.session(secret); if(!uuid.test(view.userId)) throw new Error(); }
    catch {sendIdentityError(response,401,'UNAUTHENTICATED','Sesión no válida');return false;}
    if(!suggestions.enabled){sendIdentityError(response,503,'UNAVAILABLE','Búsqueda de direcciones no disponible');return false;}
    try { await authorizer.authorizePropose(secret,pharmacyId); return true; }
    catch {sendIdentityError(response,403,'FORBIDDEN','Permiso insuficiente');return false;}
  }
  function failure(error:unknown,response:Response):void {
    if(error instanceof LocationValidationError) sendIdentityError(response,400,'BAD_REQUEST','Entrada no válida');
    else if(error instanceof LocationForbiddenError) sendIdentityError(response,403,'FORBIDDEN','Permiso insuficiente');
    else if(error instanceof AddressSuggestionsDisabledError) sendIdentityError(response,503,'UNAVAILABLE','Búsqueda de direcciones no disponible');
    else if(error instanceof AddressSuggestionsBusyError) sendIdentityError(response,429,'RATE_LIMITED','Espera un momento e inténtalo de nuevo');
    else sendIdentityError(response,500,'INTERNAL','No se pudo completar la solicitud');
  }
  router.post(`${path}/buscar`,security.requireCsrf,async(request,response)=>{
    if(!(await guard(request,response)))return;
    try {response.status(200).json({resultado:await suggestions.search(request.body)});}
    catch(error){failure(error,response);}
  });
  router.post(`${path}/inversa`,security.requireCsrf,async(request,response)=>{
    if(!(await guard(request,response)))return;
    try {response.status(200).json({resultado:await suggestions.reverse(request.body)});}
    catch(error){failure(error,response);}
  });
  return router;
}
