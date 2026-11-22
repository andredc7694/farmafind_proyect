import type {SqlClient} from '../../usuarios/contracts/tenant.js';
import type {ReviewAction,ReviewRepository,ReviewSummary,ReviewDetail,ReviewResult} from '../application/review-applications.js';
import {PgPharmacyPlatformPermissions} from './platform-permissions.js';

function summary(row:Record<string,unknown>):ReviewSummary{return {
  id:String(row.id),estado:String(row.estado),version:Number(row.version),
  nombreComercial:String(row.nombre_comercial),solicitanteId:String(row.solicitante_id),
};}
export class PgPlatformReviewRepository implements ReviewRepository {
  constructor(private readonly client:SqlClient,private readonly platform:PgPharmacyPlatformPermissions){}
  async list(state:string|null,limit:number){
    await this.platform.require('F025_APPLICATION_READ');
    const r=await this.client.query('SELECT * FROM f025.list_applications($1,$2)',[state,limit]);
    return r.rows.map(summary);
  }
  async detail(id:string){
    await this.platform.require('F025_APPLICATION_REVIEW');
    const r=await this.client.query('SELECT * FROM f025.read_application($1)',[id]);
    if(r.rows.length!==1)return null;
    const row=r.rows[0];
    return {...summary(row),contacto:String(row.contacto),direccion:String(row.direccion),
      departamento:String(row.departamento),provincia:String(row.provincia),
      distrito:String(row.distrito),representante:String(row.representante),
      ruc:row.ruc?String(row.ruc):null,documentos:[]} satisfies ReviewDetail;
  }
  async decide(id:string,version:number,action:ReviewAction,reason:string,key:string|null,
    correlation:string):Promise<ReviewResult>{
    if(action==='APROBAR'){
      await this.platform.require('F025_APPLICATION_DECIDE');
      await this.platform.require('F025_PHARMACY_ACTIVATE');
      const r=await this.client.query('SELECT * FROM f025.activate_application($1,$2,$3,$4,$5)',
        [id,version,key,reason,correlation]);
      if(r.rows.length!==1)throw new Error('Conflicto');
      return {solicitudId:id,estado:'APROBADA',version:version+1,
        farmaciaId:String(r.rows[0].activated_farmacia_id)};
    }
    await this.platform.require(action==='RECHAZAR'?'F025_APPLICATION_DECIDE':'F025_APPLICATION_REVIEW');
    const r=await this.client.query('SELECT * FROM f025.change_application($1,$2,$3,$4,$5)',
      [id,version,action,reason,correlation]);
    if(r.rows.length!==1)throw new Error('Conflicto');
    return {solicitudId:id,estado:String(r.rows[0].new_state),version:Number(r.rows[0].new_version)};
  }
}
