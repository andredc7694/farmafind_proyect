import {randomUUID,createHash,createHmac} from 'node:crypto';
import type {Pool,PoolClient} from 'pg';
import {classifyStatus,retryDelaySeconds} from '../domain/retry-policy.js';

export interface ApplicationEnvelope {
  eventId:string;version:1;type:string;correlationId:string;occurredAt:string;
  payload:{applicationId:string;applicationVersion:number;recipientUserId:string};
}
interface Claim {claimId:string;attempt:number;envelope:ApplicationEnvelope}
function canonicalJson(value:unknown):string {
  if(value===null||typeof value!=='object')return JSON.stringify(value);
  if(Array.isArray(value))return `[${value.map(canonicalJson).join(',')}]`;
  const object=value as Record<string,unknown>;
  return `{${Object.keys(object).sort().map(key=>`${JSON.stringify(key)}:${canonicalJson(object[key])}`).join(',')}}`;
}

export class PgApplicationOutbox {
  constructor(private readonly pool:Pool){}
  private async transaction<T>(work:(client:PoolClient)=>Promise<T>):Promise<T>{
    const client=await this.pool.connect();
    try{
      await client.query('BEGIN');await client.query('SET LOCAL ROLE f05_outbox_publisher');
      const target=await client.query(`SELECT current_database() database,
        current_setting('cluster_name') cluster,
        (SELECT description FROM pg_shdescription WHERE objoid=(SELECT oid FROM pg_database
          WHERE datname=current_database())) marker`);
      if(!/^farmafind_f01_test_[a-f0-9]{12}$/.test(String(target.rows[0]?.database))||
        target.rows[0]?.cluster!=='farmafind-f025-test'||
        target.rows[0]?.marker!=='FarmaFind F07 TEST efimera')
        throw new Error('F02.5: publicador solo en base TEST aislada');
      const result=await work(client);await client.query('COMMIT');return result;
    }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
  }
  claim(now:Date,batch:number,leaseSeconds:number):Promise<Claim[]>{
    return this.transaction(async client=>{
      const token=randomUUID();
      const rows=await client.query(`WITH candidates AS (
        SELECT o.id FROM f025.outbox_evento o
        WHERE o.estado IN ('PENDIENTE','FALLIDO','RECLAMADO')
          AND o.proximo_intento_en<=$1
          AND (o.reclamado_hasta IS NULL OR o.reclamado_hasta<=$1)
          AND NOT EXISTS (SELECT 1 FROM f025.outbox_evento earlier
            WHERE earlier.solicitud_id=o.solicitud_id
              AND (earlier.creado_en,earlier.id)<(o.creado_en,o.id)
              AND earlier.estado<>'PUBLICADO')
        ORDER BY o.creado_en,o.id FOR UPDATE SKIP LOCKED LIMIT $2)
        UPDATE f025.outbox_evento o SET estado='RECLAMADO',reclamo_id=$3,
          reclamado_hasta=$1+($4||' seconds')::interval,intentos=o.intentos+1
        FROM candidates c WHERE o.id=c.id
        RETURNING o.id,o.solicitud_id,o.destinatario_usuario_id,o.tipo,
          o.version_solicitud,o.correlation_id,o.creado_en,o.intentos`,
      [now,batch,token,leaseSeconds]);
      return rows.rows.map(row=>({claimId:token,attempt:Number(row.intentos),envelope:{
        eventId:String(row.id),version:1,type:String(row.tipo),
        correlationId:String(row.correlation_id),occurredAt:new Date(row.creado_en).toISOString(),
        payload:{applicationId:String(row.solicitud_id),applicationVersion:Number(row.version_solicitud),
          recipientUserId:String(row.destinatario_usuario_id)},
      }}));
    });
  }
  async finish(claim:Claim,now:Date,next:Date|null,code:string|null):Promise<void>{
    await this.transaction(async client=>{
      const result=await client.query(`UPDATE f025.outbox_evento SET
        estado=$3,proximo_intento_en=$4,publicado_en=$5,ultimo_error_codigo=$6,
        reclamo_id=NULL,reclamado_hasta=NULL
        WHERE id=$1 AND reclamo_id=$2`,[claim.envelope.eventId,claim.claimId,
          code===null?'PUBLICADO':next?'FALLIDO':'BLOQUEADO',next,code===null?now:null,code]);
      if(result.rowCount!==1)throw new Error('F02.5: reclamo perdido');
    });
  }
}

/** Local signed transport; the reservation route remains unchanged. */
export class HttpApplicationEventTransport {
  constructor(private readonly url:string,private readonly secret:string,
    private readonly timeoutMs:number,private readonly fetchImpl:typeof fetch=fetch){}
  async send(event:ApplicationEnvelope):Promise<number>{
    const target=new URL(this.url);
    if(target.hostname!=='127.0.0.1'||target.pathname!=='/internal/v1/pharmacy-application-events'||
      target.protocol!=='http:'||target.search||target.hash)
      throw new Error('F02.5: transporte solo local y ruta interna');
    const body=canonicalJson(event),timestamp=new Date().toISOString();
    const digest=createHash('sha256').update(body).digest('hex');
    const signature=createHmac('sha256',this.secret).update(`POST\n${target.pathname}\n${timestamp}\n${event.eventId}\n${digest}`).digest('hex');
    const response=await this.fetchImpl(this.url,{method:'POST',signal:AbortSignal.timeout(this.timeoutMs),
      headers:{'Content-Type':'application/json','X-FarmaFind-Event-Id':event.eventId,
        'X-FarmaFind-Timestamp':timestamp,'X-FarmaFind-Signature':`sha256=${signature}`},body});
    return response.status;
  }
}

export class PublishApplicationOutbox {
  constructor(private readonly repository:PgApplicationOutbox,
    private readonly transport:HttpApplicationEventTransport,
    private readonly config:{batchSize:number;leaseSeconds:number;maxAttempts:number;
      baseDelaySeconds:number;maxDelaySeconds:number},private readonly clock={now:()=>new Date()}){}
  async run(){
    const claims=await this.repository.claim(this.clock.now(),this.config.batchSize,this.config.leaseSeconds);
    const result={claimed:claims.length,published:0,retried:0,blocked:0};
    for(const claim of claims){
      try{
        const status=await this.transport.send(claim.envelope);
        if(status>=200&&status<300){await this.repository.finish(claim,this.clock.now(),null,null);result.published++;continue;}
        const retry=classifyStatus(status)==='TRANSIENT'&&claim.attempt<this.config.maxAttempts;
        const next=retry?new Date(this.clock.now().getTime()+retryDelaySeconds(
          claim.attempt,this.config.baseDelaySeconds,this.config.maxDelaySeconds)*1000):null;
        await this.repository.finish(claim,this.clock.now(),next,`HTTP_${status}`);
        retry?result.retried++:result.blocked++;
      }catch{
        const retry=claim.attempt<this.config.maxAttempts;
        const next=retry?new Date(this.clock.now().getTime()+retryDelaySeconds(
          claim.attempt,this.config.baseDelaySeconds,this.config.maxDelaySeconds)*1000):null;
        await this.repository.finish(claim,this.clock.now(),next,'TRANSPORT_ERROR');
        retry?result.retried++:result.blocked++;
      }
    }
    return result;
  }
}
