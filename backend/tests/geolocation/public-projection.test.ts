import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { Client } from 'pg';

const group=process.env.F07_TEST_DATABASE_URL && process.env.F07_RUNTIME_DATABASE_URL ? describe : describe.skip;
group('F07 proyección pública PostgreSQL TEST real',()=>{
  let admin:Client; let runtime:Client;
  let state:{pharmacyIds:Record<string,string>};
  beforeAll(async()=>{
    state=JSON.parse(readFileSync(new URL('../../../.cache/f07-fixture/state.local.json',import.meta.url),'utf8'));
    admin=new Client({connectionString:process.env.F07_TEST_DATABASE_URL}); await admin.connect();
    runtime=new Client({connectionString:process.env.F07_RUNTIME_DATABASE_URL}); await runtime.connect();
  });
  afterAll(async()=>{if(admin)await admin.end();if(runtime)await runtime.end();});
  it('solo farmacias activas y verificadas tienen marcador',async()=>{
    const beta=state.pharmacyIds['beta-centro'];
    await admin.query("UPDATE f01.farmacia_referencia SET estado='INACTIVA' WHERE id=$1",[beta]);
    try {
      const ids=(await runtime.query('SELECT farmacia_id FROM f07.list_public_pharmacies(NULL)')).rows.map(row=>row.farmacia_id);
      expect(ids).not.toContain(beta); expect(ids).toHaveLength(4);
    } finally { await admin.query("UPDATE f01.farmacia_referencia SET estado='ACTIVA' WHERE id=$1",[beta]); }
    const gamma=state.pharmacyIds['gamma-sur'];
    await admin.query("UPDATE f03.farmacia_publica SET estado_ubicacion='PENDIENTE' WHERE farmacia_id=$1",[gamma]);
    try {
      expect((await runtime.query('SELECT farmacia_id FROM f07.list_public_pharmacies(NULL)')).rows.map(row=>row.farmacia_id))
        .not.toContain(gamma);
      const city=(await runtime.query("SELECT * FROM f07.list_public_pharmacies('lima')")).rows
        .find(row=>row.farmacia_id===gamma);
      expect(city).toMatchObject({farmacia_latitud:null,farmacia_longitud:null,ubicacion_verificada:false});
      expect(city.farmacia_direccion).toContain('Prueba');
    } finally { await admin.query("UPDATE f03.farmacia_publica SET estado_ubicacion='PUBLICADA_VERIFICADA' WHERE farmacia_id=$1",[gamma]); }
  });
  it('oferta F03 conserva precio, disponibilidad pública y última revisión',async()=>{
    const rows=(await runtime.query("SELECT * FROM f03.search_public_offers('producto',NULL,NULL,200)")).rows;
    expect(rows).toHaveLength(3);
    expect(rows.every(row=>Number(row.precio_centavos)>0 && row.ultima_revision instanceof Date)).toBe(true);
    expect(rows.every(row=>row.farmacia_latitud!==null && row.farmacia_longitud!==null)).toBe(true);
  });
});
