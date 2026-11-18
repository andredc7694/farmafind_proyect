import type { SqlClient } from '../../usuarios/contracts/tenant.js';
import type { LocationProposalInput } from '../domain/pharmacy-location.js';
import type { LocationRepository, StoredLocationProposal } from '../application/location-ports.js';

function row(value:Record<string,unknown>):StoredLocationProposal {
  return {id:String(value.id),pharmacyId:String(value.farmacia_id),proposerId:String(value.propuesta_por),
    reviewerId:value.revisada_por===null?null:String(value.revisada_por),status:value.estado as StoredLocationProposal['status'],
    version:Number(value.version),basePublicVersion:Number(value.base_public_version),
    address:String(value.direccion_publicable),city:String(value.ciudad),latitude:Number(value.latitud),
    longitude:Number(value.longitud),precisionMeters:value.precision_m===null?null:Number(value.precision_m),
    source:String(value.fuente),evidenceReference:value.evidencia_referencia===null?null:String(value.evidencia_referencia)};
}

export class PgLocationRepository implements LocationRepository {
  constructor(private readonly client:SqlClient,private readonly pharmacyId:string) {}
  private scope(id:string) { if(id!==this.pharmacyId) throw new Error('F07: tenant incorrecto'); }

  async publicVersion(pharmacyId:string):Promise<number|null> {
    this.scope(pharmacyId);
    const result=await this.client.query('SELECT public_version FROM f03.farmacia_publica WHERE farmacia_id=$1',[pharmacyId]);
    return result.rows.length===1 ? Number(result.rows[0].public_version) : null;
  }
  async insert(pharmacyId:string,actorId:string,input:LocationProposalInput,basePublicVersion:number):Promise<StoredLocationProposal> {
    this.scope(pharmacyId);
    const result=await this.client.query(`INSERT INTO f07.ubicacion_propuesta
      (farmacia_id,direccion_publicable,ciudad,latitud,longitud,precision_m,fuente,
        evidencia_referencia,propuesta_por,base_public_version)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [pharmacyId,input.address,input.city,input.latitude,input.longitude,input.precisionMeters,
        input.source,input.evidenceReference,actorId,basePublicVersion]);
    return row(result.rows[0]);
  }
  async find(pharmacyId:string,proposalId:string):Promise<StoredLocationProposal|null> {
    this.scope(pharmacyId);
    const result=await this.client.query(`SELECT * FROM f07.ubicacion_propuesta
      WHERE id=$1 AND farmacia_id=$2`,[proposalId,pharmacyId]);
    return result.rows.length===1 ? row(result.rows[0]) : null;
  }
  async decide(pharmacyId:string,proposalId:string,actorId:string,
    status:'PUBLICADA_VERIFICADA'|'RECHAZADA',version:number):Promise<StoredLocationProposal|null> {
    this.scope(pharmacyId);
    const result=await this.client.query(`UPDATE f07.ubicacion_propuesta
      SET estado=$4,revisada_por=$3,revisada_at=now(),version=version+1
      WHERE id=$1 AND farmacia_id=$2 AND estado='PENDIENTE' AND version=$5
      RETURNING *`,[proposalId,pharmacyId,actorId,status,version]);
    return result.rows.length===1 ? row(result.rows[0]) : null;
  }
  async publish(proposal:StoredLocationProposal):Promise<boolean> {
    this.scope(proposal.pharmacyId);
    const result=await this.client.query(`UPDATE f03.farmacia_publica
      SET direccion_texto=$2,ciudad=$3,latitud=$4,longitud=$5,precision_m=$6,fuente=$7,
        estado_ubicacion='PUBLICADA_VERIFICADA',propuesta_por=$8,revisada_por=$9,
        fecha_verificacion=now(),updated_at=now(),public_version=public_version+1
      WHERE farmacia_id=$1 AND public_version=$10 RETURNING farmacia_id`,
      [proposal.pharmacyId,proposal.address,proposal.city,proposal.latitude,proposal.longitude,
        proposal.precisionMeters,proposal.source,proposal.proposerId,proposal.reviewerId,proposal.basePublicVersion]);
    return result.rows.length===1;
  }
  async audit(pharmacyId:string,proposalId:string,actorId:string,
    action:'PROPUESTA'|'APROBACION'|'RECHAZO',evidenceConfirmed?:boolean,reason?:string|null):Promise<void> {
    this.scope(pharmacyId);
    await this.client.query(`INSERT INTO f07.ubicacion_auditoria
      (farmacia_id,propuesta_id,actor_usuario_id,accion,evidencia_confirmada,motivo)
      VALUES($1,$2,$3,$4,$5,$6)`,[pharmacyId,proposalId,actorId,action,evidenceConfirmed??null,reason??null]);
  }
}
