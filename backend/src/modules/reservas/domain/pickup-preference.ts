/**
 * F04.1: preferencia de recogida del cliente. Es solo orientación: nunca amplía ni recalcula el vencimiento
 * de F04-TIME-01 y no promete cita. Debe caber en [creación, creación + plazo de recogida de la farmacia].
 */
export const PREFERENCE_MINUTES = [30, 60, 120] as const;
export const MIN_WINDOW_MINUTES = 15;
export const MAX_WINDOW_MINUTES = 120;
const SKEW_MS = 60_000; // tolerancia de reloj del navegador al elegir «desde ahora»

export type PickupPreference =
  | { readonly type: 'MINUTES'; readonly minutes: 30 | 60 | 120 }
  | { readonly type: 'WINDOW'; readonly start: string; readonly end: string };

export class PickupPreferenceError extends Error {
  constructor(message: string) { super(message); this.name = 'PickupPreferenceError'; }
}

const isoDate = (value: unknown, label: string): Date => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(value)) throw new PickupPreferenceError(`${label} inválida`);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new PickupPreferenceError(`${label} inválida`);
  return date;
};

/** Valida y normaliza. `undefined`/`null` → sin preferencia. Lanza PickupPreferenceError con un mensaje claro. */
export function validatePickupPreference(input: unknown, now: Date, pickupWindowHours: number): PickupPreference | null {
  if (input === undefined || input === null) return null;
  if (typeof input !== 'object' || Array.isArray(input)) throw new PickupPreferenceError('Preferencia inválida');
  if (!Number.isInteger(pickupWindowHours) || pickupWindowHours < 1 || pickupWindowHours > 8) {
    throw new PickupPreferenceError('Plazo de la farmacia inválido');
  }
  const body = input as Record<string, unknown>;
  const limit = new Date(now.getTime() + pickupWindowHours * 3_600_000);
  if (body.type === 'MINUTES') {
    if (Object.keys(body).some(key => !['type', 'minutes'].includes(key))) throw new PickupPreferenceError('Preferencia inválida');
    const minutes = body.minutes;
    if (!(PREFERENCE_MINUTES as readonly unknown[]).includes(minutes)) throw new PickupPreferenceError('Elige 30, 60 o 120 minutos');
    if ((minutes as number) > pickupWindowHours * 60) {
      throw new PickupPreferenceError(`La farmacia mantiene la reserva ${pickupWindowHours} h como máximo; elige un tiempo menor`);
    }
    return { type: 'MINUTES', minutes: minutes as 30 | 60 | 120 };
  }
  if (body.type === 'WINDOW') {
    if (Object.keys(body).some(key => !['type', 'start', 'end'].includes(key))) throw new PickupPreferenceError('Preferencia inválida');
    const start = isoDate(body.start, 'Hora de inicio'); const end = isoDate(body.end, 'Hora de fin');
    const minutes = (end.getTime() - start.getTime()) / 60_000;
    if (minutes < MIN_WINDOW_MINUTES || minutes > MAX_WINDOW_MINUTES) {
      throw new PickupPreferenceError(`La franja debe durar entre ${MIN_WINDOW_MINUTES} y ${MAX_WINDOW_MINUTES} minutos`);
    }
    if (start.getTime() < now.getTime() - SKEW_MS) throw new PickupPreferenceError('La franja no puede empezar en el pasado');
    if (end.getTime() > limit.getTime()) {
      throw new PickupPreferenceError(`La franja debe terminar dentro de las próximas ${pickupWindowHours} h (plazo de la farmacia)`);
    }
    return { type: 'WINDOW', start: start.toISOString(), end: end.toISOString() };
  }
  throw new PickupPreferenceError('Preferencia inválida');
}

/** Texto para mostrar: siempre como orientación, nunca como cita. */
export function describePickupPreference(preference: PickupPreference | null, locale = 'es-PE'): string | null {
  if (!preference) return null;
  if (preference.type === 'MINUTES') return `Preferencia estimada: en unos ${preference.minutes} minutos (no es una cita)`;
  const format = (iso: string) => new Date(iso).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  return `Preferencia estimada: entre ${format(preference.start)} y ${format(preference.end)} (no es una cita)`;
}
