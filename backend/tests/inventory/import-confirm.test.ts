import { describe, expect, it } from 'vitest';
import { assessConfirmation } from '../../src/modules/inventario/domain/importacion.js';

const row = { line: 2, medicationId: 'med1', priceCents: 1250, physicalQuantity: 5, errorCode: null };

describe('puerta de confirmación F02', () => {
  it('permite solo vista previa vigente y todas las filas conciliadas', () => {
    expect(assessConfirmation('VISTA_PREVIA', '2026-11-12T13:30:00Z',
      '2026-11-12T13:00:00Z', [row])).toBe('CONFIRMABLE');
    expect(assessConfirmation('VISTA_PREVIA', '2026-11-12T12:30:00Z',
      '2026-11-12T13:00:00Z', [row])).toBe('EXPIRADA');
    expect(assessConfirmation('VISTA_PREVIA', '2026-11-12T13:30:00Z',
      '2026-11-12T13:00:00Z', [{ ...row, errorCode: 'VALOR_INVALIDO' }])).toBe('RECHAZADA');
  });
  it('un reintento confirmado es idempotente; otros terminales no se reabren', () => {
    expect(assessConfirmation('CONFIRMADA', '2026-11-12T12:00:00Z',
      '2026-11-12T13:00:00Z', [row])).toBe('ALREADY_CONFIRMED');
    expect(assessConfirmation('RECHAZADA', '2026-11-12T13:30:00Z',
      '2026-11-12T13:00:00Z', [row])).toBe('CONFLICT');
  });
});
