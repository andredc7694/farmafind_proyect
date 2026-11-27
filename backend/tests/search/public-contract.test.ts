import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('contrato OpenAPI F03', () => {
  const contract=readFileSync(new URL('../../../specs/022-f031-busqueda-mapa/contracts/public-search.openapi.yaml',import.meta.url),'utf8');
  it('define las dos rutas públicas y paginación acotada', () => {
    expect(contract).toContain('/busquedas:'); expect(contract).toContain('/farmacias/{pharmacyId}:');
    expect(contract).toContain('maximum: 50'); expect(contract).toContain('additionalProperties: false');
  });
  it('F03.1: la oferta usa PublicOfferPharmacy con ubicacion nullable; la ficha sigue con PublicPharmacy', () => {
    expect(contract).toContain("farmacia: { $ref: '#/components/schemas/PublicOfferPharmacy' }");
    expect(contract).toContain('required: [id, nombre, direccion, ubicacion]');
    expect(contract).toContain("- type: 'null'");
    expect(contract).toContain('required: [latitud, longitud]');
    expect(contract).toMatch(/required: \[id, nombre, direccion\]\r?\n/);
  });
  it('no incluye cantidades, sesiones, membresías ni reservas', () => {
    for(const forbidden of ['cantidadFisica','cantidadComprometida','sessionSecret','membresiaId','reservaId','estadoUbicacion','propuestaPor','revisadaPor','telefono','ruc']) expect(contract).not.toContain(forbidden);
  });
});
