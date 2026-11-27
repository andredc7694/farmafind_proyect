import type { AddressMatch, GeocoderPort, ReverseMatch, SearchArea } from '../application/address-suggestions.js';

/** F071-FR-016: identificación genérica aprobada por Andre (opción A); sin correo ni repositorio. */
export const NOMINATIM_USER_AGENT = 'FarmaFind-DEMO/0.1 (proyecto local de pruebas)';
const BASE = 'https://nominatim.openstreetmap.org';

type FetchLike = (url:string,init:{headers:Record<string,string>;signal:AbortSignal})=>Promise<{ok:boolean;json():Promise<unknown>}>;

function first<T>(...values:unknown[]):T|null {
  for (const value of values) if (typeof value==='string' && value.trim()) return value.trim() as T;
  return null;
}

/**
 * Adaptador de Nominatim (OSM): Perú, un resultado, español, tiempo máximo. No escribe registros
 * con la dirección ni el punto consultados.
 */
export class NominatimGeocoder implements GeocoderPort {
  constructor(private readonly fetchImpl:FetchLike=fetch as unknown as FetchLike,private readonly timeoutMs=4000) {}

  private async get(path:string,params:Record<string,string>):Promise<unknown> {
    const url=new URL(path,BASE);
    for (const [key,value] of Object.entries({...params,format:'jsonv2',countrycodes:'pe','accept-language':'es'}))
      url.searchParams.set(key,value);
    const response=await this.fetchImpl(url.toString(),{headers:{'User-Agent':NOMINATIM_USER_AGENT,Accept:'application/json'},
      signal:AbortSignal.timeout(this.timeoutMs)});
    if (!response.ok) return null;
    return response.json();
  }

  async search(address:string,city:string,area:SearchArea|null=null):Promise<AddressMatch|null> {
    // F07.2 (D-02 A): con zona, Nominatim devuelve solo resultados dentro del recuadro (viewbox + bounded).
    const zone:Record<string,string>=area ? {viewbox:[area.longitude-area.halfSideDegrees,area.latitude+area.halfSideDegrees,
      area.longitude+area.halfSideDegrees,area.latitude-area.halfSideDegrees].map(value=>value.toFixed(4)).join(','),bounded:'1'} : {} as Record<string,string>;
    const body=await this.get('/search',{q:`${address}, ${city}, Perú`,limit:'1',addressdetails:'0',...zone});
    const row=Array.isArray(body) ? body[0] as Record<string,unknown>|undefined : undefined;
    const latitude=Number(row?.lat), longitude=Number(row?.lon);
    if (!row || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
    return {latitud:latitude,longitud:longitude,etiqueta:String(row.display_name ?? '').slice(0,240)};
  }

  async reverse(latitude:number,longitude:number):Promise<ReverseMatch|null> {
    const body=await this.get('/reverse',{lat:String(latitude),lon:String(longitude),zoom:'18',addressdetails:'1'});
    const address=(body && typeof body==='object' ? (body as Record<string,unknown>).address : null) as Record<string,unknown>|null;
    if (!address) return null;
    // Calle sin número (house_number se descarta a propósito).
    return {calle:first<string>(address.road,address.pedestrian,address.footway,address.residential),
      ciudad:first<string>(address.city,address.town,address.village,address.county)};
  }
}
