export const RESERVATION_STATES = ['PENDIENTE','CONFIRMADA','ENTREGADA','CANCELADA','EXPIRADA'] as const;
export type ReservationState = typeof RESERVATION_STATES[number];
export const TERMINAL_RESERVATION_STATES: readonly ReservationState[] = ['ENTREGADA','CANCELADA','EXPIRADA'];

const transitions: Record<ReservationState, readonly ReservationState[]> = {
  PENDIENTE: ['CONFIRMADA','CANCELADA','EXPIRADA'],
  CONFIRMADA: ['ENTREGADA','CANCELADA','EXPIRADA'],
  ENTREGADA: [], CANCELADA: [], EXPIRADA: [],
};

export function assertPositiveQuantity(quantity: number): number {
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 2147483647) throw new Error('Cantidad invalida');
  return quantity;
}

export function canTransition(from: ReservationState, to: ReservationState): boolean {
  return transitions[from].includes(to);
}

export function transitionReservation(from: ReservationState, to: ReservationState): ReservationState {
  if (!canTransition(from, to)) throw new Error('Transicion de reserva no permitida');
  return to;
}

export function isExpired(state: ReservationState, now: Date, responseExpiresAt: Date,
  pickupExpiresAt: Date | null): boolean {
  return (state === 'PENDIENTE' && responseExpiresAt.getTime() <= now.getTime()) ||
    (state === 'CONFIRMADA' && pickupExpiresAt !== null && pickupExpiresAt.getTime() <= now.getTime());
}
