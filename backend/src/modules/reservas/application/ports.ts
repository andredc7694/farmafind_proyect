import type { ReservationState } from '../domain/reservation.js';
import type { PickupPreference } from '../domain/pickup-preference.js';

export type ReservationCapability = 'reservation.read' | 'reservation.accept' |
  'reservation.deliver' | 'reservation.settings';

export interface ReservationRow {
  id: string; userId: string; pharmacyId: string; inventoryId: string; medicationId: string;
  quantity: number; state: ReservationState; responseExpiresAt: string;
  confirmedAt: string | null; pickupExpiresAt: string | null; version: number;
  /** F04.1: orientación opcional del cliente; nunca interviene en vencimientos ni transiciones. */
  pickupPreference: PickupPreference | null;
}

/** F04.1: vistas de lectura de la farmacia (solo lectura; nunca cambian estados ni inventario). */
export interface AttentionFilters { state?: 'PENDIENTE' | 'CONFIRMADA'; from?: Date; to?: Date }
export interface HistoryFilters { state?: 'ENTREGADA' | 'CANCELADA' | 'EXPIRADA'; from?: Date; to?: Date; limit: number;
  cursor?: { createdAt: string; id: string } }
export interface AttentionItem { id: string; state: 'PENDIENTE' | 'CONFIRMADA'; quantity: number; medication: string;
  createdAt: string; expiresAt: string; pickupPreference: PickupPreference | null }
export interface HistoryItem { id: string; code: string; state: 'ENTREGADA' | 'CANCELADA' | 'EXPIRADA'; quantity: number; medication: string;
  createdAt: string; confirmedAt: string | null; pickupExpiresAt: string | null; closeReason: string | null; pickupPreference: PickupPreference | null }

export interface ReservationSummaryCounts { pending: number; confirmed: number; expiringSoon: number }

export interface ReservationRepository {
  /** F08.1: cifras de la cola; el reloj es el de la base de datos. */
  summary(pharmacyId: string): Promise<ReservationSummaryCounts>;
  attention(pharmacyId: string, filters: AttentionFilters): Promise<readonly AttentionItem[]>;
  history(pharmacyId: string, filters: HistoryFilters): Promise<{ items: readonly HistoryItem[]; next: { createdAt: string; id: string } | null }>;
  exportHistory(pharmacyId: string, filters: Omit<HistoryFilters, 'limit' | 'cursor'>, max: number):
    Promise<{ rows: readonly HistoryItem[]; truncated: boolean }>;
  create(input: { actorUserId: string; pharmacyId: string; medicationId: string; quantity: number;
    responseExpiresAt: Date; idempotencyKey: string; preference?: PickupPreference | null }): Promise<{ reservation: ReservationRow; replay: boolean }>;
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
