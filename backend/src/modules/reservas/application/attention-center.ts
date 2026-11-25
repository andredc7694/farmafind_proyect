import { toCsv } from '../domain/csv-export.js';
import { describePickupPreference } from '../domain/pickup-preference.js';
import type { Clock } from '../domain/pickup-window.js';
import type { AttentionFilters, AttentionItem, HistoryFilters, HistoryItem, ReservationUnitOfWork } from './ports.js';

export const HISTORY_PAGE_MAX = 100;
export const EXPORT_MAX_ROWS = 5000;

/** Filtro o cursor inválido (400). */
export class AttentionFilterError extends Error { constructor(message = 'Filtro inválido') { super(message); this.name = 'AttentionFilterError'; } }

const encodeCursor = (cursor: { createdAt: string; id: string }): string => Buffer.from(JSON.stringify(cursor)).toString('base64url');
export function decodeCursor(text: string): { createdAt: string; id: string } {
  try {
    const value = JSON.parse(Buffer.from(text, 'base64url').toString('utf8')) as { createdAt?: unknown; id?: unknown };
    if (typeof value.createdAt !== 'string' || Number.isNaN(new Date(value.createdAt).getTime()) ||
        typeof value.id !== 'string' || !/^[0-9a-f-]{36}$/i.test(value.id)) throw new Error();
    return { createdAt: new Date(value.createdAt).toISOString(), id: value.id };
  } catch { throw new AttentionFilterError('Cursor inválido'); }
}

/** F04.1: lecturas de la farmacia autorizada (`reservation.read`). Nunca cambian estados ni inventario. */
export class AttentionCenter {
  constructor(private readonly uow: ReservationUnitOfWork, private readonly clock: Clock) {}

  /** F08.1: cifras para el Resumen de la farmacia (exige `reservation.read`). */
  async summary(secret: string, pharmacyId: string): Promise<{ generatedAt: string; pending: number; confirmed: number; expiringSoon: number }> {
    const counts = await this.uow.run(secret, pharmacyId, 'reservation.read', ports => ports.reservations.summary(pharmacyId));
    return { generatedAt: this.clock.now().toISOString(), ...counts };
  }

  async snapshot(secret: string, pharmacyId: string, filters: AttentionFilters): Promise<{ generatedAt: string; items: readonly AttentionItem[] }> {
    const items = await this.uow.run(secret, pharmacyId, 'reservation.read', ports => ports.reservations.attention(pharmacyId, filters));
    return { generatedAt: this.clock.now().toISOString(), items };
  }

  async history(secret: string, pharmacyId: string, filters: Omit<HistoryFilters, 'limit' | 'cursor'> & { limit?: number; cursor?: string }):
    Promise<{ items: readonly HistoryItem[]; nextCursor: string | null }> {
    const { cursor: cursorText, limit: requested, ...rest } = filters;
    const limit = requested ?? 25;
    if (!Number.isInteger(limit) || limit < 1 || limit > HISTORY_PAGE_MAX) throw new AttentionFilterError('Límite inválido');
    const cursor = cursorText ? decodeCursor(cursorText) : undefined;
    const page = await this.uow.run(secret, pharmacyId, 'reservation.read', ports =>
      ports.reservations.history(pharmacyId, { ...rest, limit, ...(cursor ? { cursor } : {}) }));
    return { items: page.items, nextCursor: page.next ? encodeCursor(page.next) : null };
  }

  /** CSV del historial de la farmacia activa, sin datos del cliente; máximo 5000 filas. */
  async exportCsv(secret: string, pharmacyId: string, filters: Omit<HistoryFilters, 'limit' | 'cursor'>): Promise<{ csv: string; truncated: boolean; rows: number }> {
    const result = await this.uow.run(secret, pharmacyId, 'reservation.read', ports =>
      ports.reservations.exportHistory(pharmacyId, filters, EXPORT_MAX_ROWS));
    const csv = toCsv(['codigo', 'estado', 'medicamento', 'cantidad', 'creada', 'confirmada', 'vence_recogida', 'motivo_cierre', 'preferencia'],
      result.rows.map(item => [item.code, item.state, item.medication, item.quantity, item.createdAt, item.confirmedAt, item.pickupExpiresAt,
        item.closeReason, describePickupPreference(item.pickupPreference)]));
    return { csv, truncated: result.truncated, rows: result.rows.length };
  }
}
