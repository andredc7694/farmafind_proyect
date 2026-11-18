import { describe, expect, it } from 'vitest';
import { InMemoryReviewedSourceCatalog } from '../../src/modules/asistente-ia/infrastructure/reviewed-source-catalog.js';
import { SYNTHETIC_SOURCE } from './fixtures/conversation-fixtures.js';

const NOW = new Date('2026-11-17T12:00:00.000Z');
describe('fichas revisadas F06.1', () => {
  it('admite solo una ficha sintética completa, vigente y autorizada para TEST', () => {
    const catalog = new InMemoryReviewedSourceCatalog([SYNTHETIC_SOURCE]);
    expect(catalog.lookup('¿Qué indica la ficha de Producto Ficticio Alfa?', NOW)?.reference).toBe(SYNTHETIC_SOURCE.reference);
  });
  it.each(['authority', 'jurisdiction', 'reference', 'title', 'version', 'reviewedAt', 'validUntil',
    'reusePermission', 'professionalReviewer', 'productName', 'educationalStatement'] as const)
  ('rechaza campo obligatorio ausente: %s', field => {
    const catalog = new InMemoryReviewedSourceCatalog([{ ...SYNTHETIC_SOURCE, [field]: '' }]);
    expect(catalog.lookup('Producto Ficticio Alfa', NOW)).toBeNull();
  });
  it('rechaza revisión ausente, permiso real no aprobado y ficha caducada', () => {
    const invalid = [
      { ...SYNTHETIC_SOURCE, approvedForTest: false },
      { ...SYNTHETIC_SOURCE, reusePermission: 'UNKNOWN' },
      { ...SYNTHETIC_SOURCE, validUntil: '2026-01-01T00:00:00.000Z' },
    ];
    for (const source of invalid) expect(new InMemoryReviewedSourceCatalog([source]).lookup('Producto Ficticio Alfa', NOW)).toBeNull();
  });
  it('se abstiene ante fuentes contradictorias para el mismo nombre', () => {
    const catalog = new InMemoryReviewedSourceCatalog([SYNTHETIC_SOURCE,
      { ...SYNTHETIC_SOURCE, reference: 'test://ficha/sintetica-002', educationalStatement: 'Otra afirmación sintética.' }]);
    expect(catalog.lookup('Producto Ficticio Alfa', NOW)).toBeNull();
  });
});
