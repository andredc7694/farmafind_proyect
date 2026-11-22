import type { SqlClient } from '../../usuarios/contracts/tenant.js';
import type { CatalogRow } from '../application/ports.js';

export class PgCatalogRepository {
  constructor(private readonly client: SqlClient) {}

  async list(query: string, page: number): Promise<readonly CatalogRow[]> {
    const escaped = query.toLocaleLowerCase('es-PE').replace(/[\\%_]/g, '\\$&');
    const result = await this.client.query(`SELECT id,nombre,concentracion,presentacion,clasificacion
      FROM f02.medicamento WHERE estado='ACTIVO'
        AND ($1='' OR nombre ILIKE $2 ESCAPE '\\' OR concentracion ILIKE $2 ESCAPE '\\'
          OR presentacion ILIKE $2 ESCAPE '\\' OR clasificacion ILIKE $2 ESCAPE '\\')
      ORDER BY nombre,concentracion,presentacion,id LIMIT 50 OFFSET $3`,
    [query, `%${escaped}%`, (page - 1) * 50]);
    return result.rows.map(row => ({ id: String(row.id), nombre: String(row.nombre),
      concentracion: String(row.concentracion), presentacion: String(row.presentacion),
      clasificacion: String(row.clasificacion) }));
  }
}
