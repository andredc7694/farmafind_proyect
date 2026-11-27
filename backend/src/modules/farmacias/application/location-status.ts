import type { LocationHistoryRow, PublicLocationState } from './location-ports.js';

export type LocationStatusCode = 'SIN_UBICACION'|'EN_REVISION'|'VERIFICADA'|'RECHAZADA';
export interface LocationHistoryEntry {
  readonly fecha:string; readonly accion:'PROPUESTA'|'APROBACION'|'RECHAZO'|'REEMPLAZADA';
  readonly autor:string; readonly motivo:string|null; readonly direccion:string;
}
export interface LocationStatusView {
  readonly estado:LocationStatusCode;
  readonly publicada:{direccion:string;ciudad:string|null;latitud:number|null;longitud:number|null;verificadaAt:string|null}|null;
  readonly pendiente:{propuestaId:string;direccion:string;ciudad:string;latitud:number;longitud:number}|null;
  readonly historial:LocationHistoryEntry[];
}

/**
 * F071-FR-006: estado e historial sin identificadores internos. Autores: «Tú», «Otra persona de
 * la farmacia» o «Revisión de FarmaFind». «Reemplazada» se calcula (D-04 A, sin tocar F07).
 * `history` viene ordenado de la propuesta más reciente a la más antigua.
 */
export function buildLocationStatus(history:readonly LocationHistoryRow[],published:PublicLocationState|null,
  actorId:string):LocationStatusView {
  const who=(id:string)=>id===actorId?'Tú':'Otra persona de la farmacia';
  const latest=history[0]?.proposal;
  const estado:LocationStatusCode = latest?.status==='PENDIENTE' ? 'EN_REVISION'
    : latest?.status==='RECHAZADA' ? 'RECHAZADA'
    : published?.verified || latest?.status==='PUBLICADA_VERIFICADA' ? 'VERIFICADA' : 'SIN_UBICACION';
  const entries:LocationHistoryEntry[]=[];
  let newerPending=false;
  for (const item of history) {
    const {proposal}=item;
    if (proposal.status==='PENDIENTE' && newerPending)
      entries.push({fecha:item.proposedAt,accion:'REEMPLAZADA',autor:'FarmaFind',motivo:'Se envió una propuesta más reciente',
        direccion:proposal.address});
    else if (proposal.status!=='PENDIENTE' && item.reviewedAt)
      entries.push({fecha:item.reviewedAt,accion:proposal.status==='PUBLICADA_VERIFICADA'?'APROBACION':'RECHAZO',
        autor:'Revisión de FarmaFind',motivo:item.reason,direccion:proposal.address});
    entries.push({fecha:item.proposedAt,accion:'PROPUESTA',autor:who(proposal.proposerId),motivo:null,direccion:proposal.address});
    if (proposal.status==='PENDIENTE') newerPending=true;
  }
  const pending=latest?.status==='PENDIENTE' ? latest : null;
  return {
    estado,
    publicada: published?.verified ? {direccion:published.address,ciudad:published.city,latitud:published.latitude,
      longitud:published.longitude,verificadaAt:published.verifiedAt} : null,
    pendiente: pending ? {propuestaId:pending.id,direccion:pending.address,ciudad:pending.city,
      latitud:pending.latitude,longitud:pending.longitude} : null,
    historial: entries.sort((a,b)=>b.fecha.localeCompare(a.fecha)),
  };
}
