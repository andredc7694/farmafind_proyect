import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('contrato OpenAPI F03', () => {
  const contract=readFileSync(new URL('../../../specs/004-f03-consultas-publicas/contracts/public-search.openapi.yaml',import.meta.url),'utf8');
  it('define las dos rutas públicas y paginación acotada', () => {
    expect(contract).toContain('/busquedas:'); expect(contract).toContain('/farmacias/{pharmacyId}:');
    expect(contract).toContain('maximum: 50'); expect(contract).toContain('additionalProperties: false');
  });
  it('no incluye cantidades, sesiones, membresías ni reservas', () => {
    for(const forbidden of ['cantidadFisica','cantidadComprometida','sessionSecret','membresiaId','reservaId']) expect(contract).not.toContain(forbidden);
  });
});
