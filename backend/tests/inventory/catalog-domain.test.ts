import { describe, expect, it } from 'vitest';
import { catalogKey, createMedicationReference, resolveReference } from '../../src/modules/medicamentos/domain/medicamento.js';

const tablet = { name: 'Producto Ficticio', concentration: '10 mg', presentation: 'Tabletas', classification: 'Venta libre' };

describe('referencias comunes F02', () => {
  it('normaliza una combinación para detectar duplicados sin confundir presentaciones', () => {
    expect(catalogKey({ ...tablet, name: '  PRODUCTO   ficticio ' })).toEqual(catalogKey(tablet));
    expect(catalogKey({ ...tablet, presentation: 'Jarabe' })).not.toEqual(catalogKey(tablet));
  });
  it('exige los cuatro atributos y rechaza valores vacíos o excesivos', () => {
    expect(() => createMedicationReference({ ...tablet, classification: '' })).toThrow();
    expect(() => createMedicationReference({ ...tablet, name: 'x'.repeat(161) })).toThrow();
  });
  it('no asocia una referencia inexistente o ambigua', () => {
    const first = createMedicationReference(tablet);
    expect(resolveReference([first], tablet)).toEqual(first);
    expect(resolveReference([first], { ...tablet, presentation: 'Jarabe' })).toBeNull();
    expect(() => resolveReference([first, { ...first, id: 'otra' }], tablet)).toThrow('Referencia ambigua');
  });
});
