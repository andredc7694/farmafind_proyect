import express from 'express';
import {parseApplicationEvent} from './application-contract.js';
import {canonicalJson,fingerprint,verifySignature} from './signature.js';
import type {ApplicationEventRepository} from './application-repository.js';

export function createApplicationEventsRouter(repository:ApplicationEventRepository,secret:string,
  clock:{now():Date}={now:()=>new Date()}){
  const router=express.Router();
  router.post('/internal/v1/pharmacy-application-events',express.json({limit:'16kb'}),async(request,response)=>{
    const body=Buffer.from(canonicalJson(request.body));
    const eventId=request.header('X-FarmaFind-Event-Id')??'';
    if(!verifySignature({method:'POST',path:'/internal/v1/pharmacy-application-events',
      timestamp:request.header('X-FarmaFind-Timestamp')??'',eventId,body,
      signature:request.header('X-FarmaFind-Signature')??''},secret,clock.now()))
      return response.status(401).json({error:'Solicitud interna no autorizada'});
    let event;
    try{event=parseApplicationEvent(request.body);}
    catch{return response.status(422).json({error:'Contrato inválido'});}
    if(event.eventId!==eventId)return response.status(422).json({error:'Contrato inválido'});
    try{
      const result=await repository.accept(event,fingerprint(body),clock.now());
      if(result==='CONFLICT')return response.status(409).json({error:'Conflicto de identidad'});
      return response.status(result==='NEW'?202:200).json({status:result==='NEW'?'accepted':'already_processed'});
    }catch{return response.status(503).json({error:'Entrega local no disponible'});}
  });
  return router;
}
