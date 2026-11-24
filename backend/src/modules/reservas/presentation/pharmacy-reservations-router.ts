import { Router,json } from 'express';
import type { Request,Response } from 'express';
import { AttentionFilterError } from '../application/attention-center.js';
import { authHttpSecurity,readSessionCookie,sendIdentityError,type AuthHttpOptions } from '../../usuarios/contracts/http-security.js';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
interface Services { confirm:{list(secret:string,pharmacyId:string):Promise<unknown>;execute(secret:string,pharmacyId:string,id:string,key:string):Promise<unknown>}; settings:{get(secret:string,pharmacyId:string):Promise<unknown>;save(secret:string,pharmacyId:string,hours:number):Promise<unknown>}; shortage:{execute(secret:string,pharmacyId:string,id:string,key:string):Promise<unknown>}; deliver:{execute(secret:string,pharmacyId:string,id:string,key:string):Promise<unknown>};
  /** F04.1: lecturas de atención, historial y exportación (opcional: sin él las rutas no existen). */
  center?:{snapshot(secret:string,pharmacyId:string,filters:{state?:'PENDIENTE'|'CONFIRMADA';from?:Date;to?:Date}):Promise<unknown>;
    history(secret:string,pharmacyId:string,filters:{state?:'ENTREGADA'|'CANCELADA'|'EXPIRADA';from?:Date;to?:Date;limit?:number;cursor?:string}):Promise<unknown>;
    exportCsv(secret:string,pharmacyId:string,filters:{state?:'ENTREGADA'|'CANCELADA'|'EXPIRADA';from?:Date;to?:Date}):Promise<{csv:string;truncated:boolean;rows:number}>} }
/** F04.1: filtros de consulta estrictos; un valor inválido es 400 (nunca se ignora en silencio). */
function parseFilters(query:Request['query'],states:readonly string[],extra:readonly string[]){
  const allowed=new Set(['estado','desde','hasta',...extra]);
  for(const key of Object.keys(query))if(!allowed.has(key))throw new AttentionFilterError('Filtro desconocido');
  const one=(name:string):string|undefined=>{const value=query[name];if(value===undefined)return undefined;if(typeof value!=='string'||value.length===0||value.length>200)throw new AttentionFilterError();return value;};
  const date=(name:string)=>{const value=one(name);if(value===undefined)return undefined;const parsed=new Date(value);if(!/^\d{4}-\d{2}-\d{2}/.test(value)||Number.isNaN(parsed.getTime()))throw new AttentionFilterError(`Fecha inválida (${name})`);return parsed;};
  const state=one('estado');if(state!==undefined&&!states.includes(state))throw new AttentionFilterError('Estado inválido');
  const from=date('desde'),to=date('hasta');if(from&&to&&from>to)throw new AttentionFilterError('Rango de fechas inválido');
  return {...(state?{state}:{}),...(from?{from}:{}),...(to?{to}:{}),one};
}
function fail(r:Response,e:unknown){if(e instanceof AttentionFilterError){sendIdentityError(r,400,'BAD_REQUEST',e.message);return;}const m=e instanceof Error?e.message:'';if(m.includes('Transicion')||m.includes('vencida')||m.includes('Idempotencia'))sendIdentityError(r,409,'CONFLICT','Operacion en conflicto');else sendIdentityError(r,403,'FORBIDDEN','Acceso denegado');}
export function createPharmacyReservationsRouter(s:Services,o:AuthHttpOptions):Router {const router=Router(),security=authHttpSecurity(o);router.use(json({limit:'8kb'}));router.use((_q,r,n)=>{r.set('Cache-Control','no-store');n();});
  const auth=(q:Request,r:Response)=>{const v=readSessionCookie(q,o);if(!v)sendIdentityError(r,401,'UNAUTHENTICATED','Sesion no valida');return v;};
  const ids=(q:Request,r:Response)=>{const pharmacyId=q.params.pharmacyId,reservationId=q.params.reservationId;if(typeof pharmacyId!=='string'||!uuid.test(pharmacyId)||(reservationId!==undefined&&(typeof reservationId!=='string'||!uuid.test(reservationId)))){sendIdentityError(r,404,'NOT_VISIBLE','Recurso no visible');return null;}return {pharmacyId,reservationId:reservationId as string};};
  router.get('/farmacias/:pharmacyId/reservas',async(q,r)=>{const secret=auth(q,r),p=ids(q,r);if(!secret||!p)return;try{r.json(await s.confirm.list(secret,p.pharmacyId));}catch(e){fail(r,e);}});
  router.get('/farmacias/:pharmacyId/reservas/configuracion',async(q,r)=>{const secret=auth(q,r),p=ids(q,r);if(!secret||!p)return;try{r.json(await s.settings.get(secret,p.pharmacyId));}catch(e){fail(r,e);}});
  router.put('/farmacias/:pharmacyId/reservas/configuracion',security.requireCsrf,async(q,r)=>{const secret=auth(q,r),p=ids(q,r),hours=(q.body as Record<string,unknown>)?.pickupWindowHours;if(!secret||!p)return;if(!Number.isInteger(hours)||(hours as number)<1||(hours as number)>8){sendIdentityError(r,422,'INVALID_INPUT','Plazo fuera de rango');return;}try{r.json(await s.settings.save(secret,p.pharmacyId,hours as number));}catch(e){fail(r,e);}});
  if(s.center){const center=s.center;
    router.get('/farmacias/:pharmacyId/reservas/centro',async(q,r)=>{const secret=auth(q,r),p=ids(q,r);if(!secret||!p)return;try{const f=parseFilters(q.query,['PENDIENTE','CONFIRMADA'],[]);r.json(await center.snapshot(secret,p.pharmacyId,{...(f.state?{state:f.state as 'PENDIENTE'|'CONFIRMADA'}:{}),...(f.from?{from:f.from}:{}),...(f.to?{to:f.to}:{})}));}catch(e){fail(r,e);}});
    router.get('/farmacias/:pharmacyId/reservas/historial',async(q,r)=>{const secret=auth(q,r),p=ids(q,r);if(!secret||!p)return;try{const f=parseFilters(q.query,['ENTREGADA','CANCELADA','EXPIRADA'],['limite','cursor']);const limit=f.one('limite'),cursor=f.one('cursor');
      if(limit!==undefined&&!/^\d{1,3}$/.test(limit))throw new AttentionFilterError('Límite inválido');
      r.json(await center.history(secret,p.pharmacyId,{...(f.state?{state:f.state as 'ENTREGADA'|'CANCELADA'|'EXPIRADA'}:{}),...(f.from?{from:f.from}:{}),...(f.to?{to:f.to}:{}),...(limit!==undefined?{limit:Number(limit)}:{}),...(cursor!==undefined?{cursor}:{})}));}catch(e){fail(r,e);}});
    router.get('/farmacias/:pharmacyId/reservas/historial/exportar',async(q,r)=>{const secret=auth(q,r),p=ids(q,r);if(!secret||!p)return;try{const f=parseFilters(q.query,['ENTREGADA','CANCELADA','EXPIRADA'],[]);const out=await center.exportCsv(secret,p.pharmacyId,{...(f.state?{state:f.state as 'ENTREGADA'|'CANCELADA'|'EXPIRADA'}:{}),...(f.from?{from:f.from}:{}),...(f.to?{to:f.to}:{})});
      r.set('Content-Type','text/csv; charset=utf-8').set('Content-Disposition','attachment; filename="historial-reservas.csv"').set('X-Export-Truncated',out.truncated?'true':'false').set('X-Content-Type-Options','nosniff').send(out.csv);}catch(e){fail(r,e);}});
  }
  const action=(name:'confirmar'|'falta-fisica'|'entregar',fn:(secret:string,p:string,id:string,key:string)=>Promise<unknown>)=>router.post(`/farmacias/:pharmacyId/reservas/:reservationId/${name}`,security.requireCsrf,async(q,r)=>{const secret=auth(q,r),p=ids(q,r),key=q.get('Idempotency-Key');if(!secret||!p)return;if(!key||key.length<8||key.length>128){sendIdentityError(r,422,'INVALID_INPUT','Clave idempotente invalida');return;}try{r.json(await fn(secret,p.pharmacyId,p.reservationId,key));}catch(e){fail(r,e);}});
  action('confirmar',(a,b,c,d)=>s.confirm.execute(a,b,c,d));action('falta-fisica',(a,b,c,d)=>s.shortage.execute(a,b,c,d));action('entregar',(a,b,c,d)=>s.deliver.execute(a,b,c,d));return router;
}
