import { describe, expect, it } from 'vitest';
import { describePickupPreference, PickupPreferenceError, validatePickupPreference } from '../../src/modules/reservas/domain/pickup-preference.js';

const now = new Date('2026-11-24T15:00:00.000Z');
const at = (minutes: number) => new Date(now.getTime() + minutes * 60_000).toISOString();

describe('F04.1 preferencia de recogida (dominio)', () => {
  it('sin preferencia no hay nada que validar', () => {
    expect(validatePickupPreference(undefined, now, 4)).toBeNull();
    expect(validatePickupPreference(null, now, 4)).toBeNull();
  });

  it.each([30, 60, 120])('acepta %i minutos con el plazo por defecto de 4 h', minutes => {
    expect(validatePickupPreference({ type: 'MINUTES', minutes }, now, 4)).toEqual({ type: 'MINUTES', minutes });
  });

  it.each([0, 15, 45, 90, 121, '60', null, 60.5])('rechaza minutos no permitidos (%j)', minutes => {
    expect(() => validatePickupPreference({ type: 'MINUTES', minutes }, now, 4)).toThrow(PickupPreferenceError);
  });

  it('rechaza minutos que superan el plazo de la farmacia (1 h admite 30 y 60, no 120)', () => {
    expect(validatePickupPreference({ type: 'MINUTES', minutes: 60 }, now, 1)).toEqual({ type: 'MINUTES', minutes: 60 });
    expect(() => validatePickupPreference({ type: 'MINUTES', minutes: 120 }, now, 1)).toThrow(/1 h como máximo/);
    expect(validatePickupPreference({ type: 'MINUTES', minutes: 120 }, now, 2)).toEqual({ type: 'MINUTES', minutes: 120 });
  });

  it('acepta una franja válida dentro de la ventana de 1 a 8 h', () => {
    for (const hours of [1, 4, 8]) {
      expect(validatePickupPreference({ type: 'WINDOW', start: at(10), end: at(40) }, now, hours))
        .toEqual({ type: 'WINDOW', start: at(10), end: at(40) });
    }
    expect(validatePickupPreference({ type: 'WINDOW', start: at(0), end: at(60) }, now, 1)).toBeTruthy(); // termina justo en el límite
  });

  it('rechaza franjas demasiado cortas, largas, pasadas o que exceden el plazo de la farmacia', () => {
    expect(() => validatePickupPreference({ type: 'WINDOW', start: at(10), end: at(20) }, now, 4)).toThrow(/entre 15 y 120/);
    expect(() => validatePickupPreference({ type: 'WINDOW', start: at(10), end: at(135) }, now, 8)).toThrow(/entre 15 y 120/);
    expect(() => validatePickupPreference({ type: 'WINDOW', start: at(-30), end: at(0) }, now, 4)).toThrow(/pasado/);
    expect(() => validatePickupPreference({ type: 'WINDOW', start: at(30), end: at(90) }, now, 1)).toThrow(/próximas 1 h/);
    expect(() => validatePickupPreference({ type: 'WINDOW', start: at(200), end: at(260) }, now, 4)).toThrow(/próximas 4 h/);
    expect(validatePickupPreference({ type: 'WINDOW', start: at(-0.5), end: at(30) }, now, 4)).toBeTruthy(); // tolera 1 min de reloj
  });

  it('rechaza formas inválidas, campos extra y un plazo de farmacia fuera de 1–8', () => {
    for (const bad of ['60', 60, [], { type: 'OTRO' }, { type: 'MINUTES', minutes: 60, extra: 1 }, { type: 'WINDOW', start: 'ayer', end: 'hoy' },
      { type: 'WINDOW', start: at(10), end: 5 }, { type: 'WINDOW', start: at(10), end: at(40), hours: 4 }]) {
      expect(() => validatePickupPreference(bad, now, 4), JSON.stringify(bad)).toThrow(PickupPreferenceError);
    }
    for (const hours of [0, 9, 4.5]) expect(() => validatePickupPreference({ type: 'MINUTES', minutes: 30 }, now, hours)).toThrow(PickupPreferenceError);
  });

  it('el texto siempre aclara que no es una cita', () => {
    expect(describePickupPreference(null)).toBeNull();
    expect(describePickupPreference({ type: 'MINUTES', minutes: 60 })).toContain('no es una cita');
    expect(describePickupPreference({ type: 'WINDOW', start: at(10), end: at(40) })).toMatch(/entre .* y .* \(no es una cita\)/);
  });
});
