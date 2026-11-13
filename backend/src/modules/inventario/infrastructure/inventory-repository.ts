import { randomUUID } from 'node:crypto';
import type { SqlClient } from '../../usuarios/contracts/tenant.js';
import { reviewInventory, type InventoryReview, type InventoryState } from '../domain/inventario.js';
import type { InventoryRow } from '../application/ports.js';

function mapRow(row: Record<string, unknown>): InventoryRow {
  return { id: String(row.id), farmaciaId: String(row.farmacia_id),
    medicamentoId: String(row.medicamento_id), precioReferencial: Number(row.precio_centavos) / 100,
    cantidadFisica: Number(row.cantidad_fisica), cantidadComprometida: Number(row.cantidad_comprometida),
    ultimaRevision: (row.ultima_revision_at as Date).toISOString(), version: Number(row.version) };
}

export class PgInventoryRepository {
  constructor(private readonly client: SqlClient, private readonly pharmacyId: string) {}

  async list(): Promise<readonly InventoryRow[]> {
    const result = await this.client.query(`SELECT id,farmacia_id,medicamento_id,precio_centavos,
      cantidad_fisica,cantidad_comprometida,ultima_revision_at,version
      FROM f02.inventario WHERE farmacia_id=$1 ORDER BY medicamento_id LIMIT 500`, [this.pharmacyId]);
    return result.rows.map(mapRow);
  }

  async movements(): Promise<readonly Record<string, unknown>[]> {
    const result = await this.client.query(`SELECT id,inventario_id,medicamento_id,cantidad_antes,
      cantidad_despues,precio_antes_centavos,precio_despues_centavos,motivo,occurred_at
      FROM f02.movimiento WHERE farmacia_id=$1 ORDER BY occurred_at DESC,id LIMIT 500`, [this.pharmacyId]);
    return result.rows;
  }

  async review(medicationId: string, input: InventoryReview): Promise<InventoryRow> {
    const reference = await this.client.query(`SELECT id FROM f02.medicamento
      WHERE id=$1 AND estado='ACTIVO'`, [medicationId]);
    if (reference.rows.length !== 1) throw new Error('Referencia no visible');
    let current = await this.client.query(`SELECT id,farmacia_id,medicamento_id,precio_centavos,
      cantidad_fisica,cantidad_comprometida,ultima_revision_at,version
      FROM f02.inventario WHERE farmacia_id=$1 AND medicamento_id=$2 FOR UPDATE`,
    [this.pharmacyId, medicationId]);
    if (current.rows.length === 0) {
      const inserted = await this.client.query(`INSERT INTO f02.inventario
        (farmacia_id,medicamento_id,precio_centavos,cantidad_fisica,ultima_revision_at)
        VALUES($1,$2,0,0,$3) ON CONFLICT (farmacia_id,medicamento_id) DO NOTHING RETURNING id`,
      [this.pharmacyId, medicationId, input.at]);
      current = await this.client.query(`SELECT id,farmacia_id,medicamento_id,precio_centavos,
        cantidad_fisica,cantidad_comprometida,ultima_revision_at,version
        FROM f02.inventario WHERE farmacia_id=$1 AND medicamento_id=$2 FOR UPDATE`,
      [this.pharmacyId, medicationId]);
      if (inserted.rows.length === 0 && current.rows.length !== 1) throw new Error('Conflicto de inventario');
    }
    if (current.rows.length !== 1) throw new Error('Inventario no visible');
    const row = current.rows[0];
    const before: InventoryState = {
      pharmacyId: this.pharmacyId, medicationId,
      physicalQuantity: Number(row.cantidad_fisica), committedQuantity: Number(row.cantidad_comprometida),
      priceCents: Number(row.precio_centavos), lastReviewedAt: (row.ultima_revision_at as Date).toISOString(),
    };
    const result = reviewInventory(before, input);
    const updated = await this.client.query(`UPDATE f02.inventario SET precio_centavos=$3,cantidad_fisica=$4,
      ultima_revision_at=$5,version=version+1 WHERE id=$1 AND farmacia_id=$2
      RETURNING id,farmacia_id,medicamento_id,precio_centavos,cantidad_fisica,
        cantidad_comprometida,ultima_revision_at,version`,
    [row.id, this.pharmacyId, result.inventory.priceCents,
      result.inventory.physicalQuantity, result.inventory.lastReviewedAt]);
    if (updated.rows.length !== 1) throw new Error('Conflicto de inventario');
    await this.client.query(`INSERT INTO f02.movimiento
      (farmacia_id,inventario_id,medicamento_id,cantidad_antes,cantidad_despues,
       precio_antes_centavos,precio_despues_centavos,motivo,actor_usuario_id,correlacion_id)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [this.pharmacyId,row.id,medicationId,result.movement.beforeQuantity,
      result.movement.afterQuantity,result.movement.beforePriceCents,
      result.movement.afterPriceCents,result.movement.reason,input.actorUserId,randomUUID()]);
    return mapRow(updated.rows[0]);
  }
}
