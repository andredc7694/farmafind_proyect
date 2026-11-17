import { randomUUID } from 'node:crypto';
import { json, Router, type NextFunction, type Request, type Response } from 'express';
import type { QueryAssistant } from '../application/query-assistant.js';
import { AssistantError, parseAssistantRequest } from '../domain/assistant-contract.js';
import { InMemoryAssistantRateLimit, type AssistantRateLimit } from './rate-limit.js';

function failure(response: Response,status:number,code:string,message:string,correlationId:string) {
  return response.status(status).json({code,message,correlationId});
}
export function createAssistantRouter(service: QueryAssistant, limit: AssistantRateLimit = new InMemoryAssistantRateLimit()): Router {
  const router=Router();
  router.use((request,response,next)=>{
    response.set('Cache-Control','no-store');
    const result=limit.allow(request.ip || 'local');
    if (!result.allowed) return failure(response.set('Retry-After',String(result.retryAfter)),429,'RATE_LIMITED','Demasiadas consultas; intenta nuevamente.',randomUUID());
    next();
  });
  router.use(json({limit:'4kb',strict:true}));
  router.post('/asistente/consultar',async(request,response)=>{
    const correlationId=randomUUID();
    try { return response.status(200).json(await service.execute(parseAssistantRequest(request.body),correlationId)); }
    catch(error) {
      if (error instanceof AssistantError) {
        const status=error.code==='INVALID_REQUEST'?400:error.code==='INVALID_INTENT'?422:503;
        return failure(response,status,error.code,error.message,correlationId);
      }
      return failure(response,503,'ASSISTANT_UNAVAILABLE','El asistente no está disponible temporalmente.',correlationId);
    }
  });
  router.use((error: unknown,_request:Request,response:Response,next:NextFunction)=>{
    const candidate=error as {type?:string};
    if (candidate?.type==='entity.too.large') return failure(response,413,'PAYLOAD_TOO_LARGE','El cuerpo supera el límite permitido.',randomUUID());
    if (error instanceof SyntaxError) return failure(response,400,'INVALID_JSON','El cuerpo JSON no es válido.',randomUUID());
    next(error);
  });
  return router;
}
