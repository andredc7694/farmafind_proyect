import { PUBLIC_NOTICE } from '../contracts/public-search.js';
import type { CityQuery, ProximityQuery } from '../domain/geolocation-query.js';
import { orderNearby } from '../domain/geolocation-distance.js';

export interface GeoPublicPharmacy {
  readonly id:string; readonly name:string; readonly address:string; readonly city:string;
  readonly latitude:number|null; readonly longitude:number|null; readonly verified:boolean; readonly updatedAt:string;
}
export interface GeoPublicOffer {
  readonly pharmacyId:string; readonly productId:string; readonly priceCents:number; readonly reviewedAt:string;
}
export interface GeolocationReadPort {
  listPharmacies(city:string|null):Promise<readonly GeoPublicPharmacy[]>;
  listOffers(term:string|null,minimumPrice:number|null,maximumPrice:number|null):Promise<readonly GeoPublicOffer[]>;
}

export class ListNearbyPharmacies {
  constructor(private readonly repository:GeolocationReadPort) {}

  async execute(query:CityQuery|ProximityQuery) {
    const candidates=await this.repository.listPharmacies(query.kind==='city'?query.city:null);
    if (candidates.length>200) throw new Error('F07: límite de candidatas excedido');
    const ordered=query.kind==='city'
      ? [...candidates].sort((a,b)=>a.name.localeCompare(b.name,'es') || a.id.localeCompare(b.id))
        .map(candidate=>({candidate,distanceKm:null as number|null}))
      : orderNearby(candidates.map(candidate=>({ ...candidate })),
        {latitude:query.latitude,longitude:query.longitude},query.radiusKm)
        .map(item=>({candidate:item.candidate,distanceKm:item.distanceKm as number|null}));
    const offers=await this.repository.listOffers(query.term,query.minimumPrice,query.maximumPrice);
    const byPharmacy=new Map<string,GeoPublicOffer[]>();
    for (const offer of offers) {
      const list=byPharmacy.get(offer.pharmacyId) ?? [];
      list.push(offer); byPharmacy.set(offer.pharmacyId,list);
    }
    const filtered=ordered.filter(item=>
      (query.term===null && query.minimumPrice===null && query.maximumPrice===null) ||
      byPharmacy.has(item.candidate.id));
    const start=(query.page-1)*query.pageSize;
    return {farmacias:filtered.slice(start,start+query.pageSize).map(({candidate,distanceKm})=>({
      farmaciaId:candidate.id,nombre:candidate.name,direccion:candidate.address,
      ubicacionVerificada:candidate.verified,
      ...(candidate.verified && candidate.latitude!==null && candidate.longitude!==null
        ? {latitud:candidate.latitude,longitud:candidate.longitude}:{}),
      ...(distanceKm===null?{}:{distanciaLinealKm:distanceKm}),
      actualizadoEn:candidate.updatedAt,
      ofertas:(byPharmacy.get(candidate.id) ?? []).map(offer=>({
        productoId:offer.productId,precioCentavos:offer.priceCents,
        disponibilidadReferencial:true,revisadoEn:offer.reviewedAt,
      })),
    })),pagina:query.page,aviso:PUBLIC_NOTICE};
  }
}
