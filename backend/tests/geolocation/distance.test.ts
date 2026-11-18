import { describe, expect, it } from 'vitest';
import { parseCityQuery, parseProximityQuery } from '../../src/modules/busqueda/domain/geolocation-query.js';
import { orderNearby, straightLineKm } from '../../src/modules/busqueda/domain/geolocation-distance.js';

describe('F07 consulta geográfica', () => {
  it('normaliza ciudad y permite consulta por ciudad sin ubicación', () => {
    expect(parseCityQuery({ciudad:'  LIMA  ',pagina:'2'})).toMatchObject({city:'lima',page:2,pageSize:20});
    expect(() => parseCityQuery({ciudad:'lima',latitud:'-12'})).toThrow();
    expect(() => parseCityQuery({ciudad:'lima',extra:'x'})).toThrow();
    expect(() => parseCityQuery({ciudad:'a'})).toThrow();
    expect(() => parseCityQuery({ciudad:'a'.repeat(121)})).toThrow();
    expect(() => parseCityQuery({ciudad:'-12.04,-77.03'})).toThrow();
  });
  it('acepta par completo, radio 1–50 y rechaza valores no finitos/parciales', () => {
    expect(parseProximityQuery({latitud:-90,longitud:180,radioKm:50})).toMatchObject({latitude:-90,longitude:180,radiusKm:50});
    expect(parseProximityQuery({latitud:0,longitud:0})).toMatchObject({radiusKm:10});
    for (const query of [
      {latitud:0},{longitud:0},{latitud:91,longitud:0},{latitud:0,longitud:-181},
      {latitud:NaN,longitud:0},{latitud:Infinity,longitud:0},{latitud:'-12',longitud:-77},
      {latitud:0,longitud:0,radioKm:0},{latitud:0,longitud:0,radioKm:51},
      {latitud:0,longitud:0,extra:'x'},
    ]) expect(() => parseProximityQuery(query)).toThrow();
  });
  it('rechaza precios y paginación incompatibles o mal formados', () => {
    expect(() => parseCityQuery({ciudad:'lima',precioMinCentavos:'200',precioMaxCentavos:'100'})).toThrow();
    expect(() => parseCityQuery({ciudad:'lima',pagina:'1.5'})).toThrow();
    expect(() => parseProximityQuery({latitud:0,longitud:0,tamano:51})).toThrow();
  });
});

describe('F07 distancia lineal y orden estable', () => {
  const origin={latitude:-12.0464,longitude:-77.0428};
  const candidates=[
    {id:'alfa-centro',latitude:-12.0464,longitude:-77.0428},
    {id:'alfa-norte',latitude:-12.0340,longitude:-77.0520},
    {id:'beta-centro',latitude:-12.0600,longitude:-77.0500},
    {id:'gamma-sur',latitude:-12.1000,longitude:-77.0600},
    {id:'delta-arequipa',latitude:-16.3989,longitude:-71.5350},
  ];
  it('coincide con cinco distancias ficticias documentadas', () => {
    expect(candidates.map(value=>straightLineKm(origin.latitude,origin.longitude,value.latitude,value.longitude)))
      .toEqual([0,1.70,1.70,6.25,765.80]);
  });
  it('filtra radio, ordena empates por identificador y no inventa distancia sin coordenadas', () => {
    const within=orderNearby(candidates,origin,2);
    expect(within.map(value=>value.id)).toEqual(['alfa-centro','alfa-norte','beta-centro']);
    expect(orderNearby(candidates,origin,1).map(value=>value.id)).toEqual(['alfa-centro']);
    expect(orderNearby([{id:'sin-posicion',latitude:null,longitude:null}],origin,50)).toEqual([]);
    expect(orderNearby(candidates,origin,50).map(value=>value.id)).toEqual(['alfa-centro','alfa-norte','beta-centro','gamma-sur']);
  });
  it('rechaza más de 200 candidatas antes de ordenar', () => {
    expect(() => orderNearby(Array.from({length:201},(_,index)=>({id:String(index),latitude:0,longitude:0})),origin,50)).toThrow();
  });
});
