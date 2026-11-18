export class LocationValidationError extends Error {}
export class LocationForbiddenError extends Error {}
export class LocationNotVisibleError extends Error {}
export class LocationConflictError extends Error {}

export interface LocationProposalInput {
  readonly address:string; readonly city:string; readonly latitude:number; readonly longitude:number;
  readonly precisionMeters:number|null; readonly source:string; readonly evidenceReference:string|null;
}
export type LocationDecision = 'APROBAR'|'RECHAZAR';
export interface LocationReviewInput { readonly decision:LocationDecision; readonly evidenceConfirmed:boolean; readonly reason:string|null; }

function object(input:unknown):Record<string,unknown> {
  if (typeof input!=='object' || input===null || Array.isArray(input)) throw new LocationValidationError('Objeto requerido');
  return input as Record<string,unknown>;
}
function exactKeys(input:Record<string,unknown>,required:readonly string[],optional:readonly string[]) {
  if (required.some(key=>!Object.hasOwn(input,key)) ||
      Object.keys(input).some(key=>![...required,...optional].includes(key)))
    throw new LocationValidationError('Campos inválidos');
}
function string(value:unknown,min:number,max:number,name:string):string {
  if (typeof value!=='string') throw new LocationValidationError(`${name} inválida`);
  const normalized=value.normalize('NFC').trim().replace(/\s+/g,' ');
  if (normalized.length<min || normalized.length>max) throw new LocationValidationError(`${name} fuera de rango`);
  return normalized;
}
function coordinate(value:unknown,min:number,max:number,name:string):number {
  if (typeof value!=='number' || !Number.isFinite(value) || value<min || value>max)
    throw new LocationValidationError(`${name} inválida`);
  return value;
}
export function parseLocationProposal(raw:unknown):LocationProposalInput {
  const input=object(raw);
  exactKeys(input,['direccionPublicable','ciudad','latitud','longitud','fuente'],['precisionMetros','evidenciaReferencia']);
  const precision=input.precisionMetros===undefined ? null : input.precisionMetros;
  if (precision!==null && (typeof precision!=='number' || !Number.isFinite(precision) || precision<=0))
    throw new LocationValidationError('Precisión inválida');
  const evidence=input.evidenciaReferencia===undefined ? null : string(input.evidenciaReferencia,1,240,'Evidencia');
  return {
    address:string(input.direccionPublicable,1,240,'Dirección'),
    city:string(input.ciudad,2,120,'Ciudad').toLocaleLowerCase('es'),
    latitude:coordinate(input.latitud,-90,90,'Latitud'),longitude:coordinate(input.longitud,-180,180,'Longitud'),
    precisionMeters:precision as number|null,source:string(input.fuente,2,120,'Fuente'),evidenceReference:evidence,
  };
}
export function parseLocationReview(raw:unknown):LocationReviewInput {
  const input=object(raw); exactKeys(input,['decision','evidenciaConfirmada'],['motivo']);
  if (input.decision!=='APROBAR' && input.decision!=='RECHAZAR') throw new LocationValidationError('Decisión inválida');
  if (typeof input.evidenciaConfirmada!=='boolean' || (input.decision==='APROBAR' && !input.evidenciaConfirmada))
    throw new LocationValidationError('Evidencia no confirmada');
  const reason=input.motivo===undefined ? null : string(input.motivo,1,500,'Motivo');
  return {decision:input.decision,evidenceConfirmed:input.evidenciaConfirmada,reason};
}
