import { randomUUID } from 'node:crypto';
import express, { Router } from 'express';
import type { ErrorRequestHandler } from 'express';
import type { ListNearbyPharmacies } from '../application/list-nearby-pharmacies.js';
import { GeolocationQueryError, parseCityQuery, parseProximityQuery } from '../domain/geolocation-query.js';
import { InMemoryPublicRateLimit, type PublicRateLimit } from './public-rate-limit.js';

function failure(code:string,message:string) { return {code,message,correlationId:randomUUID()}; }

export function createGeolocationRouter(list:ListNearbyPharmacies,
  rateLimit:PublicRateLimit=new InMemoryPublicRateLimit()):Router {
  const router=Router();
  router.use('/geolocalizacion',(_request,response,next)=>{ response.set('Cache-Control','no-store'); next(); });
  function allowed(key:string,response:express.Response):boolean {
    const limit=rateLimit.allow(key);
    if (limit.allowed) return true;
    response.status(429).set('Retry-After',String(limit.retryAfter))
      .json(failure('RATE_LIMITED','Demasiadas consultas; intenta nuevamente.'));
    return false;
  }
  router.get('/geolocalizacion/farmacias',async (request,response)=>{
    if (!allowed(request.ip || 'local',response)) return;
    try { response.json(await list.execute(parseCityQuery(request.query))); }
    catch(error) {
      if (error instanceof GeolocationQueryError)
        response.status(400).json(failure(error.code,error.message));
      else response.status(503).json(failure('SOURCE_UNAVAILABLE','La consulta no está disponible temporalmente.'));
    }
  });
  router.post('/geolocalizacion/consultas',express.json({limit:'4kb',strict:true}),async (request,response)=>{
    if (!allowed(request.ip || 'local',response)) return;
    try {
      if (Object.keys(request.query).length>0) throw new GeolocationQueryError('La ubicación no puede ir en la URL');
      response.json(await list.execute(parseProximityQuery(request.body)));
    } catch(error) {
      if (error instanceof GeolocationQueryError)
        response.status(400).json(failure(error.code,error.message));
      else response.status(503).json(failure('SOURCE_UNAVAILABLE','La consulta no está disponible temporalmente.'));
    }
  });
  const parseError:ErrorRequestHandler=(error,_request,response,next)=>{
    if (response.headersSent) return next(error);
    response.status(400).json(failure('INVALID_GEOLOCATION_QUERY','Solicitud JSON inválida.'));
  };
  router.use('/geolocalizacion/consultas',parseError);
  return router;
}
