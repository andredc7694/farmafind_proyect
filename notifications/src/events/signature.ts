import {createHash,createHmac,timingSafeEqual} from 'node:crypto';
export function canonicalJson(value:unknown):string{
  if(value===null||typeof value!=='object')return JSON.stringify(value);
  if(Array.isArray(value))return `[${value.map(canonicalJson).join(',')}]`;
  const object=value as Record<string,unknown>;
  return `{${Object.keys(object).sort().map(key=>`${JSON.stringify(key)}:${canonicalJson(object[key])}`).join(',')}}`;
}
export interface SignatureInput{method:string;path:string;timestamp:string;eventId:string;body:Buffer;signature:string}
export function verifySignature(input:SignatureInput,secret:string,now:Date,windowMs=300000):boolean{
  const at=Date.parse(input.timestamp);if(!Number.isFinite(at)||Math.abs(now.getTime()-at)>windowMs)return false;
  if(!/^sha256=[0-9a-f]{64}$/.test(input.signature))return false;
  const digest=createHash('sha256').update(input.body).digest('hex');const canonical=`${input.method}\n${input.path}\n${input.timestamp}\n${input.eventId}\n${digest}`;
  const expected=createHmac('sha256',secret).update(canonical).digest('hex');const supplied=input.signature.slice(7);
  return timingSafeEqual(Buffer.from(expected,'hex'),Buffer.from(supplied,'hex'));
}
export function fingerprint(body:Buffer){return createHash('sha256').update(body).digest('hex');}
