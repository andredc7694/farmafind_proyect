import express from 'express';import {parseEvent} from './contract.js';import {canonicalJson,fingerprint,verifySignature} from './signature.js';import type {ProcessEvent} from './process-event.js';
export function createEventsRouter(processor:ProcessEvent,secret:string,clock:{now():Date}={now:()=>new Date()}){
  const router=express.Router();router.post('/internal/v1/events',express.json({limit:'16kb'}),async(request,response)=>{
    const canonicalBody=Buffer.from(canonicalJson(request.body));const eventId=request.header('X-FarmaFind-Event-Id')??'',timestamp=request.header('X-FarmaFind-Timestamp')??'',signature=request.header('X-FarmaFind-Signature')??'';
    if(!verifySignature({method:'POST',path:'/internal/v1/events',timestamp,eventId,body:canonicalBody,signature},secret,clock.now()))return response.status(401).json({error:'Solicitud interna no autorizada'});
    try{const event=parseEvent(request.body);if(event.eventId!==eventId)return response.status(422).json({error:'Contrato invalido'});const result=await processor.execute(event,fingerprint(canonicalBody));if(result==='CONFLICT')return response.status(409).json({error:'Conflicto de identidad'});return response.status(result==='NEW'?202:200).json({status:result==='NEW'?'accepted':'already_processed'});}catch{return response.status(422).json({error:'Contrato invalido'});}
  });return router;
}
