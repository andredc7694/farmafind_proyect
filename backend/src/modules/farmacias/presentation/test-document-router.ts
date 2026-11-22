import busboy from 'busboy';
import {Router} from 'express';
import type {Request} from 'express';
import {authHttpSecurity,readSessionCookie,sendIdentityError} from '../../usuarios/contracts/http-security.js';
import type {AuthHttpOptions} from '../../usuarios/contracts/http-security.js';
import {TestDocumentService} from '../infrastructure/test-document-service.js';

const maxBytes=5*1024*1024;
class UploadError extends Error{}
function readSyntheticUpload(request:Request):Promise<{bytes:Buffer;type:string}>{
  const contentType=request.get('Content-Type')??'';
  if(contentType.length>200||!/^multipart\/form-data;\s*boundary=/i.test(contentType))
    throw new UploadError();
  return new Promise((resolve,reject)=>{
    let failed=false,seen=false,type='';const chunks:Buffer[]=[];
    let parser:ReturnType<typeof busboy>;
    try{parser=busboy({headers:request.headers,limits:{fileSize:maxBytes,
      files:1,fields:1,parts:2,headerPairs:20}});}
    catch{reject(new UploadError());return;}
    parser.on('file',(name,stream,info)=>{
      if(name!=='archivo'||seen)failed=true;
      seen=true;type=info.mimeType;
      stream.on('data',(chunk:Buffer)=>chunks.push(chunk));
      stream.on('limit',()=>{failed=true;});stream.on('error',()=>{failed=true;});
    });
    parser.on('field',()=>{failed=true;});
    for(const event of ['filesLimit','fieldsLimit','partsLimit','error'] as const)
      parser.on(event,()=>{failed=true;});
    request.on('aborted',()=>reject(new UploadError()));
    parser.on('close',()=>{
      if(failed||!seen){reject(new UploadError());return;}
      resolve({bytes:Buffer.concat(chunks),type});
    });
    request.pipe(parser);
  });
}

/** TEST-only private document routes; no public or direct filesystem URLs. */
export function createTestDocumentRouter(documents:TestDocumentService,options:AuthHttpOptions):Router{
  const router=Router();const security=authHttpSecurity(options);
  router.use((_request,response,next)=>{response.set('Cache-Control','no-store');next();});
  router.post('/pharmacy-applications/:applicationId/documents',security.requireCsrf,
    async(request,response)=>{
      const secret=readSessionCookie(request,options);
      if(!secret){sendIdentityError(response,401,'UNAUTHENTICATED','Sesión no válida');return;}
      try{
        const id=String(request.params.applicationId);
        await documents.authorizeUpload(secret,id);
        const upload=await readSyntheticUpload(request);
        response.status(201).json(await documents.upload(secret,id,upload.bytes,upload.type));
      }catch(error){
        const invalid=error instanceof UploadError||
          (error instanceof Error&&error.message==='Archivo inválido');
        sendIdentityError(response,invalid?400:404,invalid?'BAD_REQUEST':'NOT_VISIBLE',
          invalid?'Archivo no válido':'Recurso no visible');
      }
    });
  router.get('/platform/pharmacy-applications/:applicationId/documents/:documentId',
    async(request,response)=>{
      const secret=readSessionCookie(request,options);
      if(!secret){sendIdentityError(response,401,'UNAUTHENTICATED','Sesión no válida');return;}
      try{
        const result=await documents.read(secret,String(request.params.applicationId),
          String(request.params.documentId));
        const extension=result.type==='application/pdf'?'pdf':result.type==='image/png'?'png':'jpg';
        response.set('Content-Type',result.type);
        response.set('Content-Disposition',`attachment; filename="adjunto-test.${extension}"`);
        response.status(200).send(result.bytes);
      }catch{
        sendIdentityError(response,404,'NOT_VISIBLE','Recurso no visible');
      }
    });
  return router;
}
