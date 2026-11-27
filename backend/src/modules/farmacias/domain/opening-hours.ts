/** F071-FR-008 (D-03 A): un tramo por día o «Cerrado», en hora de Lima. */
export class OpeningHoursValidationError extends Error {}

export interface OpeningDay {
  readonly dia:number; readonly cerrado:boolean; readonly abre:string|null; readonly cierra:string|null;
}
export interface OpeningHoursInput { readonly version:number; readonly dias:readonly OpeningDay[] }

const time=/^([01][0-9]|2[0-3]):[0-5][0-9]$/;

function day(raw:unknown):OpeningDay {
  if (typeof raw!=='object' || raw===null || Array.isArray(raw)) throw new OpeningHoursValidationError('Día inválido');
  const value=raw as Record<string,unknown>;
  const keys=Object.keys(value);
  if (keys.some(key=>!['dia','cerrado','abre','cierra'].includes(key)) || !keys.includes('dia') || !keys.includes('cerrado'))
    throw new OpeningHoursValidationError('Campos inválidos');
  if (!Number.isInteger(value.dia) || (value.dia as number)<1 || (value.dia as number)>7)
    throw new OpeningHoursValidationError('Día fuera de rango');
  if (typeof value.cerrado!=='boolean') throw new OpeningHoursValidationError('Cerrado inválido');
  const abre=value.abre ?? null, cierra=value.cierra ?? null;
  if (value.cerrado) {
    if (abre!==null || cierra!==null) throw new OpeningHoursValidationError('Un día cerrado no lleva horas');
    return {dia:value.dia as number,cerrado:true,abre:null,cierra:null};
  }
  if (typeof abre!=='string' || typeof cierra!=='string' || !time.test(abre) || !time.test(cierra))
    throw new OpeningHoursValidationError('Hora inválida');
  if (abre>=cierra) throw new OpeningHoursValidationError('La hora de cierre debe ser posterior a la de apertura');
  return {dia:value.dia as number,cerrado:false,abre,cierra};
}

export function parseOpeningHours(raw:unknown):OpeningHoursInput {
  if (typeof raw!=='object' || raw===null || Array.isArray(raw)) throw new OpeningHoursValidationError('Objeto requerido');
  const value=raw as Record<string,unknown>;
  if (Object.keys(value).sort().join(',')!=='dias,version') throw new OpeningHoursValidationError('Campos inválidos');
  if (!Number.isSafeInteger(value.version) || (value.version as number)<0) throw new OpeningHoursValidationError('Versión inválida');
  if (!Array.isArray(value.dias) || value.dias.length!==7) throw new OpeningHoursValidationError('Se requieren los 7 días');
  const dias=value.dias.map(day).sort((a,b)=>a.dia-b.dia);
  if (dias.some((item,index)=>item.dia!==index+1)) throw new OpeningHoursValidationError('Días repetidos o faltantes');
  return {version:value.version as number,dias};
}

/** «08:00:00» (PostgreSQL time) → «08:00». */
export function shortTime(value:unknown):string|null {
  return value===null || value===undefined ? null : String(value).slice(0,5);
}
