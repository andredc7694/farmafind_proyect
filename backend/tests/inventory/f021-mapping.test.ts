import { describe, expect, it } from 'vitest';
import { suggestImportMapping } from '../../src/modules/inventario/domain/importacion.js';

describe('F02.1: sugerencias conservadoras de mapeo', () => {
  it('reconoce sinónimos explícitos en español', () => {
    const result = suggestImportMapping(['Medicamento', 'Concentración', 'Presentación',
      'Clasificación', 'Precio unitario', 'Stock']);
    expect(result.mapping).toEqual({ nombre: 'Medicamento', concentracion: 'Concentración',
      presentacion: 'Presentación', clasificacion: 'Clasificación',
      precioReferencial: 'Precio unitario', cantidadFisica: 'Stock' });
    expect(result.ambiguous).toEqual([]);
  });

  it('deja sin resolver dos columnas candidatas para el mismo campo', () => {
    const result = suggestImportMapping(['Medicamento', 'Nombre', 'Precio', 'Stock']);
    expect(result.mapping.nombre).toBeUndefined();
    expect(result.ambiguous).toContain('nombre');
  });

  it('no equipara dosis o indicaciones clínicas a concentración ni inventa columnas', () => {
    const result = suggestImportMapping(['Dosis recomendada', 'Indicaciones', 'Precio']);
    expect(result.mapping.concentracion).toBeUndefined();
    expect(result.mapping.nombre).toBeUndefined();
    expect(result.mapping.precioReferencial).toBe('Precio');
  });
});
