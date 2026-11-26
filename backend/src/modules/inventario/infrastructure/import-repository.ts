import type { SqlClient } from '../../usuarios/contracts/tenant.js';
import type { ReconciledImportRow, ImportIncident } from '../domain/importacion.js';
import type { ImportRecord, ImportProfile, ImportSelectionMetadata, ImportHistoryRecord, ImportChange } from '../application/ports.js';

function mapImport(row: Record<string, unknown>): ImportRecord {
  return { id: String(row.id), pharmacyId: String(row.farmacia_id),
    actorUserId: String(row.actor_usuario_id), state: row.estado as ImportRecord['state'],
    errorCount: Number(row.error_count), createdAt: (row.created_at as Date).toISOString(),
    expiresAt: (row.expires_at as Date).toISOString(),
    confirmedAt: row.confirmed_at ? (row.confirmed_at as Date).toISOString() : null };
}

const columns = `id,farmacia_id,actor_usuario_id,estado,error_count,created_at,expires_at,confirmed_at`;

const isNew = (alias: string) => `(${alias}.cantidad_antes=0 AND ${alias}.precio_antes_centavos=0 AND NOT EXISTS (
  SELECT 1 FROM f02.movimiento p WHERE p.farmacia_id=${alias}.farmacia_id AND p.inventario_id=${alias}.inventario_id
    AND p.occurred_at<${alias}.occurred_at))`;

export class PgImportRepository {
  constructor(private readonly client: SqlClient, private readonly pharmacyId: string,
    private readonly actorUserId: string) {}

  async create(digest: Buffer, rows: readonly ReconciledImportRow[],
    metadata?: ImportSelectionMetadata): Promise<ImportRecord> {
    const errors = rows.filter(row => row.errorCode !== null).length;
    const created = await this.client.query(`INSERT INTO f02.importacion
      (farmacia_id,actor_usuario_id,digest,expires_at,error_count,
       hoja_seleccionada,fila_encabezado,huella_encabezados,mapeo)
      VALUES($1,$2,$3,now()+interval '30 minutes',$4,$5,$6,$7,$8) RETURNING ${columns}`,
    [this.pharmacyId, this.actorUserId, digest, errors, metadata?.sheet ?? null,
      metadata?.headerRow ?? null, metadata?.headerDigest ?? null,
      metadata ? JSON.stringify(metadata.mapping) : null]);
    if (created.rows.length !== 1) throw new Error('Vista previa no creada');
    const id = String(created.rows[0].id);
    for (const row of rows) {
      await this.client.query(`INSERT INTO f02.importacion_fila
        (importacion_id,farmacia_id,actor_usuario_id,numero_fila,medicamento_id,
         precio_centavos,cantidad_fisica,error_code)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
      [id,this.pharmacyId,this.actorUserId,row.line,row.medicationId,
        row.priceCents,row.physicalQuantity,row.errorCode]);
      for (const [index, item] of (row.incidents ?? []).entries()) {
        await this.client.query(`INSERT INTO f02.importacion_incidencia
          (importacion_id,farmacia_id,actor_usuario_id,numero_fila,ordinal,
           columna_origen,campo_destino,codigo)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
        [id,this.pharmacyId,this.actorUserId,row.line,index + 1,
          item.column,item.field,item.code]);
      }
    }
    return mapImport(created.rows[0]);
  }

  async findByDigest(digest: Buffer): Promise<ImportRecord | null> {
    const result = await this.client.query(`SELECT ${columns} FROM f02.importacion
      WHERE farmacia_id=$1 AND actor_usuario_id=$2 AND digest=$3`, [this.pharmacyId, this.actorUserId, digest]);
    return result.rows.length === 1 ? mapImport(result.rows[0]) : null;
  }

  async profiles(): Promise<readonly ImportProfile[]> {
    const result = await this.client.query(`SELECT id,nombre,version,encode(huella_encabezados,'hex') AS huella,
      hoja,fila_encabezado,mapeo FROM f02.perfil_importacion
      WHERE farmacia_id=$1 ORDER BY nombre LIMIT 100`, [this.pharmacyId]);
    return result.rows.map(row => ({ id: String(row.id), name: String(row.nombre),
      version: Number(row.version), headerDigest: String(row.huella), sheet: String(row.hoja),
      headerRow: Number(row.fila_encabezado), mapping: row.mapeo as ImportProfile['mapping'] }));
  }

  async saveProfile(importId: string, name: string): Promise<ImportProfile> {
    const result = await this.client.query(`INSERT INTO f02.perfil_importacion
      (farmacia_id,actor_usuario_id,nombre,huella_encabezados,hoja,fila_encabezado,mapeo)
      SELECT i.farmacia_id,i.actor_usuario_id,$4,i.huella_encabezados,i.hoja_seleccionada,
        i.fila_encabezado,i.mapeo FROM f02.importacion i
      WHERE i.id=$1 AND i.farmacia_id=$2 AND i.actor_usuario_id=$3
        AND i.estado='VISTA_PREVIA' AND i.error_count=0 AND i.expires_at>now()
        AND i.huella_encabezados IS NOT NULL AND i.mapeo IS NOT NULL
      RETURNING id,nombre,version,encode(huella_encabezados,'hex') AS huella,hoja,fila_encabezado,mapeo`,
    [importId,this.pharmacyId,this.actorUserId,name]);
    if (result.rows.length !== 1) throw new Error('Vista previa no guardable');
    const row = result.rows[0];
    return { id: String(row.id), name: String(row.nombre), version: Number(row.version),
      headerDigest: String(row.huella), sheet: String(row.hoja),
      headerRow: Number(row.fila_encabezado), mapping: row.mapeo as ImportProfile['mapping'] };
  }

  async incidents(id: string): Promise<readonly ImportIncident[]> {
    const result = await this.client.query(`SELECT numero_fila,columna_origen,campo_destino,codigo
      FROM f02.importacion_incidencia WHERE importacion_id=$1 AND farmacia_id=$2
      ORDER BY numero_fila,ordinal`, [id,this.pharmacyId]);
    return result.rows.map(row => {
      const code = String(row.codigo);
      const messages: Record<string, [string,string,string]> = {
        PRECIO_REQUERIDO: ['Falta el precio','La celda está vacía','Completa un precio válido y vuelve a validar'],
        PRECIO_INVALIDO: ['Precio inválido','El formato o rango no es válido','Corrige el precio y vuelve a validar'],
        CANTIDAD_REQUERIDA: ['Falta la cantidad','La celda está vacía','Completa la cantidad y vuelve a validar'],
        CANTIDAD_INVALIDA: ['Cantidad inválida','El formato o rango no es válido','Corrige la cantidad y vuelve a validar'],
        REFERENCIA_NO_CONCILIADA: ['Referencia no encontrada','No coincide con el catálogo autorizado','Revisa los datos del producto'],
        REFERENCIA_AMBIGUA: ['Referencia ambigua','Hay más de una coincidencia exacta','Resuelve la referencia antes de confirmar'],
        REFERENCIA_INVALIDA: ['Referencia inválida','Faltan atributos requeridos','Completa los campos del producto'],
        FILA_DUPLICADA: ['Fila duplicada','El producto aparece más de una vez','Elimina o corrige la fila repetida'],
        FARMACIA_AJENA: ['Farmacia distinta','La fila declara otra farmacia','Usa un archivo de la farmacia autorizada'],
      };
      const [title,cause,action] = messages[code] ?? ['Incidencia de importación','Revisa el archivo','Corrige y vuelve a validar'];
      return { line: Number(row.numero_fila), column: String(row.columna_origen),
        field: String(row.campo_destino), code, title, cause, action, supportCode: `F021-${code}` };
    });
  }

  async find(id: string, lock = false): Promise<ImportRecord | null> {
    const result = await this.client.query(`SELECT ${columns} FROM f02.importacion
      WHERE id=$1 AND farmacia_id=$2 ${lock ? 'FOR UPDATE' : ''}`, [id, this.pharmacyId]);
    return result.rows.length === 1 ? mapImport(result.rows[0]) : null;
  }

  async rows(id: string): Promise<readonly ReconciledImportRow[]> {
    const result = await this.client.query(`SELECT numero_fila,medicamento_id,precio_centavos,cantidad_fisica,error_code
      FROM f02.importacion_fila WHERE importacion_id=$1 AND farmacia_id=$2 ORDER BY numero_fila`,
    [id, this.pharmacyId]);
    return result.rows.map(row => ({ line: Number(row.numero_fila),
      medicationId: row.medicamento_id === null ? null : String(row.medicamento_id),
      priceCents: row.precio_centavos === null ? null : Number(row.precio_centavos),
      physicalQuantity: row.cantidad_fisica === null ? null : Number(row.cantidad_fisica),
      errorCode: row.error_code === null ? null : String(row.error_code) }));
  }

  async history(): Promise<readonly ImportHistoryRecord[]> {
    const result = await this.client.query(`WITH recientes AS (
        SELECT ${columns} FROM f02.importacion WHERE farmacia_id=$1 ORDER BY created_at DESC,id LIMIT 100),
      filas AS (
        SELECT f.importacion_id,count(*)::int AS filas,
          (count(*) FILTER (WHERE f.error_code IS NULL))::int AS listas,
          (count(*) FILTER (WHERE f.error_code='REFERENCIA_NO_CONCILIADA'))::int AS pendientes,
          (count(*) FILTER (WHERE f.error_code='FILA_DUPLICADA'))::int AS duplicadas
        FROM f02.importacion_fila f
        WHERE f.farmacia_id=$1 AND f.importacion_id IN (SELECT id FROM recientes) GROUP BY f.importacion_id),
      cambios AS (
        SELECT v.motivo,(count(*) FILTER (WHERE ${isNew('v')}))::int AS agregados,
          (count(*) FILTER (WHERE NOT ${isNew('v')} AND (v.cantidad_antes IS DISTINCT FROM v.cantidad_despues
            OR v.precio_antes_centavos IS DISTINCT FROM v.precio_despues_centavos)))::int AS actualizados
        FROM f02.movimiento v
        WHERE v.farmacia_id=$1 AND v.motivo IN (SELECT 'Importación ' || id::text FROM recientes WHERE estado='CONFIRMADA')
        GROUP BY v.motivo)
      SELECT r.*,COALESCE(f.filas,0) AS filas,COALESCE(f.listas,0) AS listas,COALESCE(f.pendientes,0) AS pendientes,
        COALESCE(f.duplicadas,0) AS duplicadas,COALESCE(c.agregados,0) AS agregados,COALESCE(c.actualizados,0) AS actualizados
      FROM recientes r LEFT JOIN filas f ON f.importacion_id=r.id
      LEFT JOIN cambios c ON c.motivo='Importación ' || r.id::text
      ORDER BY r.created_at DESC,r.id`, [this.pharmacyId]);
    return result.rows.map(row => ({ ...mapImport(row), counts: { rows: Number(row.filas), ready: Number(row.listas),
      pending: Number(row.pendientes), duplicated: Number(row.duplicadas), added: Number(row.agregados), updated: Number(row.actualizados) } }));
  }

  /** La confirmación registra cada movimiento con el motivo «Importación <id>» (ver ConfirmImport). */
  async changes(id: string): Promise<readonly ImportChange[]> {
    const result = await this.client.query(`SELECT m.nombre,m.concentracion,m.presentacion,${isNew('v')} AS agregado,
        v.precio_antes_centavos,v.precio_despues_centavos,v.cantidad_antes,v.cantidad_despues
      FROM f02.movimiento v JOIN f02.medicamento m ON m.id=v.medicamento_id
      WHERE v.farmacia_id=$1 AND v.motivo=$2 ORDER BY m.nombre,m.concentracion,m.presentacion,v.id LIMIT 5000`,
    [this.pharmacyId, `Importación ${id}`]);
    return result.rows.map(row => ({ nombre: String(row.nombre), concentracion: String(row.concentracion),
      presentacion: String(row.presentacion), added: row.agregado === true,
      priceBeforeCents: row.precio_antes_centavos === null ? null : Number(row.precio_antes_centavos),
      priceAfterCents: Number(row.precio_despues_centavos),
      quantityBefore: row.cantidad_antes === null ? null : Number(row.cantidad_antes),
      quantityAfter: Number(row.cantidad_despues) }));
  }

  async transition(id: string, state: 'CONFIRMADA' | 'RECHAZADA' | 'EXPIRADA'): Promise<boolean> {
    const result = await this.client.query(`UPDATE f02.importacion
      SET estado=$3,confirmed_at=CASE WHEN $3='CONFIRMADA' THEN now() ELSE NULL END
      WHERE id=$1 AND farmacia_id=$2 AND estado='VISTA_PREVIA' RETURNING id`,
    [id,this.pharmacyId,state]);
    return result.rows.length === 1;
  }
}
