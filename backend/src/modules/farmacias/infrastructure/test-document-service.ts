import {createHash,randomBytes} from 'node:crypto';
import {mkdir,readFile,unlink,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import type {PgPharmacyUnitOfWork} from './pharmacy-unit-of-work.js';

const directory=resolve(process.cwd(),'.cache','f025-docker','documents');
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export class TestDocumentError extends Error{}

function actualType(bytes:Buffer):string|null{
  if(bytes.subarray(0,5).toString('ascii')==='%PDF-')return 'application/pdf';
  if(bytes.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex')))return 'image/png';
  if(bytes.length>=3&&bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff)return 'image/jpeg';
  return null;
}

/** Metadata is RLS protected; bytes use random names in an ignored local directory. */
export class TestDocumentService{
  constructor(private readonly unit:PgPharmacyUnitOfWork){}
  async authorizeUpload(secret:string,applicationId:string):Promise<void>{
    if(!uuid.test(applicationId))throw new TestDocumentError('No visible');
    await this.unit.runWithContext(secret,async({client,actorUserId})=>{
      const result=await client.query(`SELECT id FROM f025.solicitud WHERE id=$1
        AND solicitante_id=$2 AND estado IN ('BORRADOR','OBSERVADA')`,[applicationId,actorUserId]);
      if(result.rows.length!==1)throw new TestDocumentError('No visible');
    });
  }
  async upload(secret:string,applicationId:string,bytes:Buffer,declaredType:string){
    if(!uuid.test(applicationId)||bytes.length<1||bytes.length>5*1024*1024)
      throw new TestDocumentError('Archivo inválido');
    const type=actualType(bytes);
    if(type===null||type!==declaredType)throw new TestDocumentError('Archivo inválido');
    const key=randomBytes(24).toString('hex');
    const digest=createHash('sha256').update(bytes).digest('hex');
    await mkdir(directory,{recursive:true,mode:0o700});
    await writeFile(resolve(directory,key),bytes,{flag:'wx',mode:0o600});
    try{
      const id=await this.unit.runWithContext(secret,async({client})=>{
        const result=await client.query(`SELECT f025.add_test_document($1,$2,$3,$4,$5) AS id`,
          [applicationId,type,key,bytes.length,digest]);
        return String(result.rows[0]?.id??'');
      });
      if(!uuid.test(id))throw new TestDocumentError('No visible');
      return {id,tipo:type,tamanoBytes:bytes.length};
    }catch(error){await unlink(resolve(directory,key)).catch(()=>undefined);throw error;}
  }
  async read(secret:string,applicationId:string,documentId:string){
    if(!uuid.test(applicationId)||!uuid.test(documentId))throw new TestDocumentError('No visible');
    const result=await this.unit.runWithContext(secret,async({client})=>
      client.query(`SELECT * FROM f025.read_test_document($1,$2)`,[applicationId,documentId]));
    if(result.rows.length!==1)throw new TestDocumentError('No visible');
    const row=result.rows[0];const key=String(row.storage_key);
    if(!/^[a-f0-9]{32,128}$/.test(key))throw new TestDocumentError('No visible');
    const bytes=await readFile(resolve(directory,key));
    if(bytes.length!==Number(row.tamano_bytes)||
      createHash('sha256').update(bytes).digest('hex')!==String(row.sha256_hex))
      throw new TestDocumentError('No visible');
    return {bytes,type:String(row.tipo)};
  }
}
