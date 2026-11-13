import { describe, expect, it } from 'vitest';
import { orderOffers } from '../../src/modules/busqueda/domain/public-offer.js';
import { parsePublicQuery } from '../../src/modules/busqueda/domain/public-query.js';

const base={ medicamento:{id:'m',nombreComercial:'producto',principioActivo:'principio',concentracion:'10 mg',presentacion:'tabletas',clasificacion:'libre'},
  farmacia:{id:'a',nombre:'Alfa',direccion:'Dirección'},precioReferencialCentavos:1200,disponibilidadReferencial:'DISPONIBLE' as const,
  ultimaRevision:'2026-11-12T00:00:00.000Z',distanciaKm:null };
describe('oferta pública F03',()=>{
  it('ordena precio estable sin exponer cantidades internas',()=>{
    const values=orderOffers([{...base,farmacia:{...base.farmacia,id:'b'},precioReferencialCentavos:1300},base],parsePublicQuery({q:'producto',orden:'precio_asc'}));
    expect(values.map(value=>value.farmacia.id)).toEqual(['a','b']);
    expect(JSON.stringify(values)).not.toContain('cantidad');
  });
  it('conserva la fecha de revisión de fuente',()=>expect(base.ultimaRevision).toBe('2026-11-12T00:00:00.000Z'));
});
