export interface ReservationRuntimeConfig {
  readonly pendingMinutes: number;
  readonly idempotencyKeyMin: number;
  readonly idempotencyKeyMax: number;
  readonly expirationBatchSize: number;
}

function integer(value: string | undefined, fallback: number, min: number, max: number, name: string): number {
  const parsed = value === undefined ? fallback : Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) throw new Error(`F04: ${name} invalido`);
  return parsed;
}

export function loadReservationConfig(env: NodeJS.ProcessEnv): ReservationRuntimeConfig {
  return {
    pendingMinutes: integer(env.RESERVATION_PENDING_MINUTES, 20, 1, 120, 'plazo PENDIENTE'),
    idempotencyKeyMin: 8,
    idempotencyKeyMax: 128,
    expirationBatchSize: integer(env.RESERVATION_EXPIRATION_BATCH_SIZE, 100, 1, 500, 'lote de expiracion'),
  };
}
