import { describe, expect, it } from 'vitest';
import { distanceKm, orderOffers } from '../../src/modules/busqueda/domain/public-offer.js';
import { parsePublicQuery } from '../../src/modules/busqueda/domain/public-query.js';

describe('distancia efímera F03',()=>{
  it('acepta coordenadas válidas y produce distancia no negativa',()=>expect(distanceKm(-12.04,-77.03,-12.08,-77.06)).toBeGreaterThan(0));
  it('ordena nulos al final y desempata por farmacia',()=>{
    const offer=(id:string,distance:number|null)=>({medicamento:{id:'m',nombreComercial:'p',principioActivo:'p',concentracion:'1',presentacion:'t',clasificacion:'l'},
      farmacia:{id,nombre:id,direccion:'d'},precioReferencialCentavos:1,disponibilidadReferencial:'DISPONIBLE' as const,ultimaRevision:new Date(0).toISOString(),distanciaKm:distance});
    const query=parsePublicQuery({q:'producto',orden:'cercania',latitud:'-12',longitud:'-77'});
    expect(orderOffers([offer('b',null),offer('a',1)],query).map(value=>value.farmacia.id)).toEqual(['a','b']);
  });
});
