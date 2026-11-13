export const DEFAULT_PICKUP_WINDOW_HOURS = 4;
export const MIN_PICKUP_WINDOW_HOURS = 1;
export const MAX_PICKUP_WINDOW_HOURS = 8;

export interface Clock { now(): Date }

export function validatePickupWindow(hours: number): number {
  if (!Number.isInteger(hours) || hours < MIN_PICKUP_WINDOW_HOURS || hours > MAX_PICKUP_WINDOW_HOURS) {
    throw new Error('Plazo de recogida invalido');
  }
  return hours;
}

export function pickupExpiration(confirmedAt: Date, hours: number): Date {
  validatePickupWindow(hours);
  return new Date(confirmedAt.getTime() + hours * 60 * 60 * 1000);
}

export function pendingExpiration(createdAt: Date, minutes: number): Date {
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > 120) throw new Error('Plazo pendiente invalido');
  return new Date(createdAt.getTime() + minutes * 60 * 1000);
}
