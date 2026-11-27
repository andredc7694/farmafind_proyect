import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const contract = readFileSync(new URL('../../../specs/024-f072-revision-ubicaciones/contracts/mi-farmacia.openapi.yaml', import.meta.url), 'utf8');
const platformRouter = readFileSync(new URL('../../src/modules/farmacias/presentation/platform-locations-router.ts', import.meta.url), 'utf8');
const suggestionsRouter = readFileSync(new URL('../../src/modules/farmacias/presentation/address-suggestions-router.ts', import.meta.url), 'utf8');

describe('F07.2 · contrato 0.2.0 (T010)', () => {
  it('historial del revisor con REEMPLAZADA en filtro y decisión', () => {
    expect(contract).toContain('version: 0.2.0');
    expect(contract).toContain('/api/v1/platform/location-proposals/historial:');
    expect(contract.match(/enum: \[PENDIENTE, APROBADA, RECHAZADA, REEMPLAZADA\]/g)).toHaveLength(2);
    expect(platformRouter).toContain("'/platform/location-proposals/historial'");
  });
  it('búsqueda de direcciones con centro opcional y cerrado', () => {
    expect(contract).toContain('/api/v1/farmacias/{farmaciaId}/ubicacion/sugerencias/buscar:');
    expect(contract).toMatch(/required: \[direccion, ciudad\]\r?\n/);
    expect(contract).toMatch(/centro:\r?\n\s+type: object\r?\n\s+additionalProperties: false\r?\n\s+required: \[latitud, longitud\]/);
    expect(suggestionsRouter).toContain("'/farmacias/:farmaciaId/ubicacion/sugerencias'");
    expect(suggestionsRouter).toContain('`${path}/buscar`');
  });
});
