import { describe, expect, it } from 'vitest';
import { canonicalizeTerm, parsePublicQuery } from '../../src/modules/busqueda/domain/public-query.js';
import { distanceKm } from '../../src/modules/busqueda/domain/public-offer.js';

describe('consulta pública F03', () => {
  it('normaliza espacios y conserva acentos como texto verificable', () => {
    expect(canonicalizeTerm('  Paracetamol   500 mg ')).toBe('paracetamol 500 mg');
    expect(canonicalizeTerm('  Ácido acetilsalicílico ')).toBe('ácido acetilsalicílico');
  });
  it('valida término, precio, página, tamaño y coordenadas completas', () => {
    expect(parsePublicQuery({ q: 'ibuprofeno', pagina: '2', tamano: '50' })).toMatchObject({ page: 2, pageSize: 50 });
    expect(() => parsePublicQuery({ q: 'x' })).toThrow();
    expect(() => parsePublicQuery({ q: 'ibuprofeno', precioMinCentavos: '20', precioMaxCentavos: '10' })).toThrow();
    expect(() => parsePublicQuery({ q: 'ibuprofeno', orden: 'cercania' })).toThrow();
  });
  it('calcula cercanía efímera con precisión estable', () => {
    expect(distanceKm(-12.0464, -77.0428, -12.05, -77.04)).toBeGreaterThan(0);
  });
});
