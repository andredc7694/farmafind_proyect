import type { ReservationState } from '../domain/reservation.js';

export type ReservationCapability = 'reservation.read' | 'reservation.accept' |
  'reservation.deliver' | 'reservation.settings';

export interface ReservationRow {
  id: string; userId: string; pharmacyId: string; inventoryId: string; medicationId: string;
  quantity: number; state: ReservationState; responseExpiresAt: string;
  confirmedAt: string | null; pickupExpiresAt: string | null; version: number;
}

export interface ReservationRepository {
  create(input: { actorUserId: string; pharmacyId: string; medicationId: string; quantity: number;
    responseExpiresAt: Date; idempotencyKey: string }): Promise<{ reservation: ReservationRow; replay: boolean }>;
  listOwn(actorUserId: string): Promise<readonly ReservationRow[]>;
  findOwn(actorUserId: string, reservationId: string): Promise<ReservationRow | null>;
  listPharmacy(pharmacyId: string): Promise<readonly ReservationRow[]>;
  transition(input: { reservationId: string; pharmacyId: string; actorUserId: string;
    target: ReservationState; idempotencyKey: string; now: Date; reason?: string;
    pickupWindowHours?: number }): Promise<ReservationRow>;
  expireBatch(now: Date, limit: number): Promise<number>;
  pickupWindow(pharmacyId: string): Promise<number>;
  savePickupWindow(pharmacyId: string, actorUserId: string, hours: number): Promise<number>;
}

export interface ReservationOperationPorts { reservations: ReservationRepository }
export interface ReservationUnitOfWork {
  run<T>(sessionSecret: string, pharmacyId: string | null, capability: ReservationCapability | null,
    work: (ports: ReservationOperationPorts, actorUserId: string) => Promise<T>): Promise<T>;
}
