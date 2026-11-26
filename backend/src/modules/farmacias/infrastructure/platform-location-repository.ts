import type { SqlClient, VerifiedTenantTransactions } from '../../usuarios/contracts/tenant.js';
import type { LocationRepository, StoredLocationProposal } from '../application/location-ports.js';
import type { PendingLocationView, PlatformLocationRepository,
  PlatformLocationUnitOfWork } from '../application/platform-location-review.js';
import { PgLocationRepository } from './location-repository.js';

function stored(value:Record<string,unknown>):StoredLocationProposal {
  return {id:String(value.id),pharmacyId:String(value.farmacia_id),proposerId:String(value.propuesta_por),
    reviewerId:value.revisada_por===null?null:String(value.revisada_por),status:value.estado as StoredLocationProposal['status'],
    version:Number(value.version),basePublicVersion:Number(value.base_public_version),
    address:String(value.direccion_publicable),city:String(value.ciudad),latitude:Number(value.latitud),
    longitude:Number(value.longitud),precisionMeters:value.precision_m===null?null:Number(value.precision_m),
    source:String(value.fuente),evidenceReference:value.evidencia_referencia===null?null:String(value.evidencia_referencia)};
}

/**
 * Todo pasa por f01_runtime con la sesión verificada: las políticas F07.1 deciden qué filas ve
 * el revisor (solo pendientes, nunca de farmacias de las que es miembro). Sin contexto de farmacia.
 */
export class PgPlatformLocationRepository implements PlatformLocationRepository {
  constructor(private readonly client:SqlClient) {}

  async isReviewer():Promise<boolean> {
    // Un id aleatorio nunca es una farmacia del actor: equivale a «tiene rol y concesión activos».
    const result=await this.client.query('SELECT f07.can_platform_location_review(gen_random_uuid()) AS allowed');
    return result.rows[0]?.allowed===true;
  }

  async listLatestPending(limit:number):Promise<PendingLocationView[]> {
    const result=await this.client.query(`SELECT DISTINCT ON (p.farmacia_id)
        p.id,p.farmacia_id,f.nombre_publico,p.direccion_publicable,p.ciudad,p.latitud,p.longitud,
        p.precision_m,p.fuente,p.evidencia_referencia,p.version,p.propuesta_at
      FROM f07.ubicacion_propuesta p JOIN f01.farmacia_referencia f ON f.id=p.farmacia_id
      WHERE p.estado='PENDIENTE' AND f.estado='ACTIVA'
      ORDER BY p.farmacia_id,p.propuesta_at DESC,p.id DESC LIMIT $1`,[limit]);
    return result.rows.map(row=>({propuestaId:String(row.id),farmaciaId:String(row.farmacia_id),
      farmaciaNombre:String(row.nombre_publico),direccionPublicable:String(row.direccion_publicable),
      ciudad:String(row.ciudad),latitud:Number(row.latitud),longitud:Number(row.longitud),
      precisionMetros:row.precision_m===null?null:Number(row.precision_m),fuente:String(row.fuente),
      evidenciaReferencia:row.evidencia_referencia===null?null:String(row.evidencia_referencia),
      version:Number(row.version),propuestaAt:new Date(String(row.propuesta_at)).toISOString()}))
      .sort((a,b)=>a.propuestaAt.localeCompare(b.propuestaAt));
  }

  async find(proposalId:string):Promise<StoredLocationProposal|null> {
    const result=await this.client.query('SELECT * FROM f07.ubicacion_propuesta WHERE id=$1',[proposalId]);
    return result.rows.length===1 ? stored(result.rows[0]) : null;
  }

  async isLatestPending(proposal:StoredLocationProposal):Promise<boolean> {
    const result=await this.client.query(`SELECT NOT EXISTS (SELECT 1 FROM f07.ubicacion_propuesta n
      WHERE n.farmacia_id=$1 AND n.estado='PENDIENTE' AND n.id<>$2
        AND (n.propuesta_at,n.id) > (SELECT propuesta_at,id FROM f07.ubicacion_propuesta WHERE id=$2)) AS latest`,
      [proposal.pharmacyId,proposal.id]);
    return result.rows[0]?.latest===true;
  }

  forPharmacy(pharmacyId:string):LocationRepository { return new PgLocationRepository(this.client,pharmacyId); }
}

export class PgPlatformLocationUnitOfWork implements PlatformLocationUnitOfWork {
  constructor(private readonly identity:VerifiedTenantTransactions) {}
  run<T>(secret:string,work:(repository:PlatformLocationRepository,actorId:string)=>Promise<T>):Promise<T> {
    return this.identity.runWithClient(secret,(_transaction,client,actorId)=>work(new PgPlatformLocationRepository(client),actorId));
  }
}
