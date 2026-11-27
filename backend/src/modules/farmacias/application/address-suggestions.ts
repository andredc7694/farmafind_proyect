import { LocationValidationError, insidePeru } from '../domain/pharmacy-location.js';

/** F071-FR-013/014: sugerencia de dirección y ubicación. Nunca publica nada: solo ayuda a llenar el formulario. */
export interface AddressMatch { readonly latitud:number; readonly longitud:number; readonly etiqueta:string }
export interface ReverseMatch { readonly calle:string|null; readonly ciudad:string|null }
/** F07.2 (D-02 A): zona a la que se limita la búsqueda (centro de la ciudad de la lista interna). */
export interface SearchArea { readonly latitude:number; readonly longitude:number; readonly halfSideDegrees:number }
/** ±0,27° ≈ 30 km alrededor del centro de la ciudad. */
export const SEARCH_AREA_HALF_SIDE_DEGREES = 0.27;
export interface GeocoderPort {
  search(address:string,city:string,area?:SearchArea|null):Promise<AddressMatch|null>;
  reverse(latitude:number,longitude:number):Promise<ReverseMatch|null>;
}
export class AddressSuggestionsDisabledError extends Error {}
export class AddressSuggestionsBusyError extends Error {}

export interface AddressSuggestionOptions {
  readonly minIntervalMs:number; readonly cacheTtlMs:number; readonly cacheMax:number; readonly maxWaitMs:number;
}
export const DEFAULT_SUGGESTION_OPTIONS:AddressSuggestionOptions = Object.freeze({
  minIntervalMs:1000, cacheTtlMs:24*60*60*1000, cacheMax:500, maxWaitMs:3000,
});

function text(value:unknown,min:number,max:number):string {
  if (typeof value!=='string') throw new LocationValidationError('Texto inválido');
  const normalized=value.normalize('NFC').trim().replace(/\s+/g,' ');
  if (normalized.length<min || normalized.length>max) throw new LocationValidationError('Texto fuera de rango');
  return normalized;
}
function exact(raw:unknown,keys:readonly string[],optional:readonly string[]=[]):Record<string,unknown> {
  if (typeof raw!=='object' || raw===null || Array.isArray(raw)) throw new LocationValidationError('Objeto requerido');
  const value=raw as Record<string,unknown>;
  const present=Object.keys(value);
  if (!keys.every(key=>present.includes(key)) || !present.every(key=>keys.includes(key) || optional.includes(key)))
    throw new LocationValidationError('Campos inválidos');
  return value;
}
function area(raw:unknown):SearchArea|null {
  if (raw===undefined) return null;
  const value=exact(raw,['latitud','longitud']);
  const latitude=value.latitud, longitude=value.longitud;
  if (typeof latitude!=='number' || typeof longitude!=='number' || !Number.isFinite(latitude) || !Number.isFinite(longitude) ||
      !insidePeru(latitude,longitude)) throw new LocationValidationError('Centro fuera del Perú');
  return {latitude:Math.round(latitude*1e4)/1e4,longitude:Math.round(longitude*1e4)/1e4,halfSideDegrees:SEARCH_AREA_HALF_SIDE_DEGREES};
}
const insideArea=(zone:SearchArea,latitude:number,longitude:number)=>
  Math.abs(latitude-zone.latitude)<=zone.halfSideDegrees && Math.abs(longitude-zone.longitude)<=zone.halfSideDegrees;

/**
 * Límite global de 1 consulta/s (reserva de turnos), caché en memoria con caducidad y tamaño máximo,
 * espera máxima e interruptor (geocoder null = apagado). No registra direcciones ni puntos consultados.
 */
export class AddressSuggestions {
  private nextSlot=0;
  private readonly cache=new Map<string,{expires:number;value:unknown}>();
  constructor(private readonly geocoder:GeocoderPort|null,
    private readonly clock:{now():number}={now:()=>Date.now()},
    private readonly sleep:(ms:number)=>Promise<void>=ms=>new Promise(done=>setTimeout(done,ms)),
    private readonly options:AddressSuggestionOptions=DEFAULT_SUGGESTION_OPTIONS) {}

  get enabled():boolean { return this.geocoder!==null; }

  async search(raw:unknown):Promise<AddressMatch|null> {
    // F07.2 (D-02 A): `centro` opcional limita la búsqueda a ~30 km de la ciudad; sin él, como en F07.1.
    const input=exact(raw,['direccion','ciudad'],['centro']);
    const address=text(input.direccion,3,240), city=text(input.ciudad,2,120), zone=area(input.centro);
    const key=`s:${address.toLocaleLowerCase('es')}|${city.toLocaleLowerCase('es')}|${zone ? `${zone.latitude},${zone.longitude}` : '-'}`;
    return this.cached(key,async geocoder=>{
      const match=await geocoder.search(address,city,zone);
      if (!match || !insidePeru(match.latitud,match.longitud)) return null;
      return zone && !insideArea(zone,match.latitud,match.longitud) ? null : match; // doble control: nunca fuera de la zona
    });
  }

  async reverse(raw:unknown):Promise<ReverseMatch|null> {
    const input=exact(raw,['latitud','longitud']);
    const latitude=input.latitud, longitude=input.longitud;
    if (typeof latitude!=='number' || typeof longitude!=='number' || !Number.isFinite(latitude) || !Number.isFinite(longitude) ||
        !insidePeru(latitude,longitude)) throw new LocationValidationError('Punto fuera del Perú');
    const key=`r:${latitude.toFixed(5)},${longitude.toFixed(5)}`;
    return this.cached(key,async geocoder=>{
      const match=await geocoder.reverse(latitude,longitude);
      return match && (match.calle || match.ciudad) ? match : null;
    });
  }

  private async cached<T>(key:string,work:(geocoder:GeocoderPort)=>Promise<T|null>):Promise<T|null> {
    if (!this.geocoder) throw new AddressSuggestionsDisabledError('Sugerencias apagadas');
    const now=this.clock.now();
    const hit=this.cache.get(key);
    if (hit && hit.expires>now) return hit.value as T|null;
    const wait=Math.max(0,this.nextSlot-now);
    if (wait>this.options.maxWaitMs) throw new AddressSuggestionsBusyError('Demasiadas consultas');
    this.nextSlot=Math.max(now,this.nextSlot)+this.options.minIntervalMs;
    if (wait>0) await this.sleep(wait);
    let value:T|null;
    try { value=await work(this.geocoder); } catch { return null; } // fallo externo: sin sugerencia, sin error al usuario
    if (this.cache.size>=this.options.cacheMax) this.cache.delete(this.cache.keys().next().value as string);
    this.cache.set(key,{expires:this.clock.now()+this.options.cacheTtlMs,value});
    return value;
  }
}
