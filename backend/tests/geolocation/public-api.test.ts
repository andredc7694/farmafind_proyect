import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { Client } from 'pg';
import { createApp } from '../../src/app.js';
import { ListNearbyPharmacies, type GeolocationReadPort } from '../../src/modules/busqueda/application/list-nearby-pharmacies.js';
import { createGeolocationRouter } from '../../src/modules/busqueda/presentation/geolocation-router.js';
import { InMemoryPublicRateLimit } from '../../src/modules/busqueda/presentation/public-rate-limit.js';
import { PgPublicOfferRepository } from '../../src/modules/busqueda/infrastructure/public-offer-repository.js';

const updatedAt='2026-11-18T12:00:00.000Z';
const pharmacies=[
  {id:'alfa',name:'Farmacia Alfa',address:'Av. Ficticia 100',city:'lima',latitude:-12.0464,longitude:-77.0428,verified:true,updatedAt},
  {id:'beta',name:'Farmacia Beta',address:'Calle Demo 200',city:'lima',latitude:-12.06,longitude:-77.05,verified:true,updatedAt},
  {id:'legacy',name:'Farmacia Legacy',address:'Dirección textual',city:'lima',latitude:null,longitude:null,verified:false,updatedAt},
];
const repo:GeolocationReadPort={
  async listPharmacies(city) { return pharmacies.filter(value=>city===null ? value.verified : value.city===city); },
  async listOffers() { return [{pharmacyId:'alfa',productId:'producto-ficticio',priceCents:1200,reviewedAt:updatedAt}]; },
};
const app=createApp(undefined,undefined,createGeolocationRouter(new ListNearbyPharmacies(repo)));

describe('F07 API pública de ciudad y proximidad',()=>{
  it('GET acepta ciudad, conserva dirección sin marcador y devuelve cero resultados sin error',async()=>{
    const result=await request(app).get('/api/v1/geolocalizacion/farmacias?ciudad=Lima').expect(200);
    expect(result.body.farmacias).toHaveLength(3);
    expect(result.body.farmacias.find((value:{farmaciaId:string})=>value.farmaciaId==='legacy'))
      .toMatchObject({direccion:'Dirección textual',ubicacionVerificada:false});
    expect(result.body.farmacias.find((value:{farmaciaId:string})=>value.farmaciaId==='legacy')).not.toHaveProperty('latitud');
    const empty=await request(app).get('/api/v1/geolocalizacion/farmacias?ciudad=arequipa').expect(200);
    expect(empty.body.farmacias).toEqual([]);
  });
  it('rechaza coordenadas y parámetros desconocidos en URL',async()=>{
    await request(app).get('/api/v1/geolocalizacion/farmacias?ciudad=lima&latitud=-12').expect(400);
    await request(app).get('/api/v1/geolocalizacion/farmacias?ciudad=lima&extra=x').expect(400);
    await request(app).get('/api/v1/geolocalizacion/farmacias?ciudad=-12.04%2C-77.03').expect(400);
    await request(app).post('/api/v1/geolocalizacion/consultas?latitud=-12')
      .send({latitud:-12,longitud:-77}).expect(400);
  });
  it('POST usa cuerpo efímero, no-store y radio lineal; no registra coordenadas',async()=>{
    const logged=vi.spyOn(console,'log'); const warned=vi.spyOn(console,'warn');
    try {
      const result=await request(app).post('/api/v1/geolocalizacion/consultas')
        .send({latitud:-12.0464,longitud:-77.0428,radioKm:1}).expect(200);
      expect(result.headers['cache-control']).toBe('no-store');
      expect(result.body.farmacias.map((value:{farmaciaId:string})=>value.farmaciaId)).toEqual(['alfa']);
      expect(result.body.farmacias[0].distanciaLinealKm).toBe(0);
      expect(logged).not.toHaveBeenCalled(); expect(warned).not.toHaveBeenCalled();
    } finally { logged.mockRestore(); warned.mockRestore(); }
  });
  it('distingue límite de abuso y fuente temporalmente no disponible',async()=>{
    const limited=createApp(undefined,undefined,createGeolocationRouter(new ListNearbyPharmacies(repo),
      new InMemoryPublicRateLimit(1,60_000)));
    await request(limited).get('/api/v1/geolocalizacion/farmacias?ciudad=lima').expect(200);
    const denied=await request(limited).get('/api/v1/geolocalizacion/farmacias?ciudad=lima').expect(429);
    expect(denied.headers['retry-after']).toBeDefined();
    const broken:GeolocationReadPort={async listPharmacies(){throw new Error('connection secret');},async listOffers(){return [];}};
    const unavailable=await request(createApp(undefined,undefined,createGeolocationRouter(new ListNearbyPharmacies(broken))))
      .get('/api/v1/geolocalizacion/farmacias?ciudad=lima').expect(503);
    expect(JSON.stringify(unavailable.body)).not.toContain('connection secret');
  });
  it('pagina de modo estable y mantiene los avisos de oferta referencial',async()=>{
    const page=await request(app).get('/api/v1/geolocalizacion/farmacias?ciudad=lima&pagina=2&tamano=1').expect(200);
    expect(page.body.pagina).toBe(2);
    expect(page.body.farmacias).toHaveLength(1);
    expect(page.body.aviso).toMatch(/referenciales/);
  });
});

const group=process.env.F07_RUNTIME_DATABASE_URL ? describe : describe.skip;
group('F07 API HTTP con PostgreSQL TEST real',()=>{
  let database:Client;
  beforeAll(async()=>{ database=new Client({connectionString:process.env.F07_RUNTIME_DATABASE_URL}); await database.connect(); });
  afterAll(async()=>{ if(database) await database.end(); });
  it('ciudad y proximidad componen solo farmacias/ofertas F03 públicas reales',async()=>{
    const live=createApp(undefined,undefined,
      createGeolocationRouter(new ListNearbyPharmacies(new PgPublicOfferRepository(database))));
    const city=await request(live).get('/api/v1/geolocalizacion/farmacias?ciudad=lima').expect(200);
    expect(city.body.farmacias).toHaveLength(4);
    expect(city.body.farmacias.every((value:{actualizadoEn:string})=>!Number.isNaN(Date.parse(value.actualizadoEn)))).toBe(true);
    const near=await request(live).post('/api/v1/geolocalizacion/consultas')
      .send({latitud:-12.0464,longitud:-77.0428,radioKm:2}).expect(200);
    expect(near.headers['cache-control']).toBe('no-store');
    expect(near.body.farmacias.map((value:{nombre:string})=>value.nombre)).toEqual([
      'Farmacia Alfa Centro','Farmacia Alfa Norte','Farmacia Beta Centro']);
    expect(near.body.farmacias.flatMap((value:{ofertas:unknown[]})=>value.ofertas)).toHaveLength(3);
    const empty=await request(live).get('/api/v1/geolocalizacion/farmacias?ciudad=trujillo').expect(200);
    expect(empty.body.farmacias).toEqual([]);
    const filtered=await request(live).get('/api/v1/geolocalizacion/farmacias?ciudad=lima&q=producto%20ficticio%20a&precioMinCentavos=1250').expect(200);
    expect(filtered.body.farmacias.map((value:{nombre:string})=>value.nombre)).toEqual(['Farmacia Alfa Norte']);
    expect(filtered.body.farmacias[0].ofertas[0]).toMatchObject({precioCentavos:1300,disponibilidadReferencial:true});
    expect(filtered.body.farmacias[0].ofertas[0].revisadoEn).toMatch(/T/);
  });
});
