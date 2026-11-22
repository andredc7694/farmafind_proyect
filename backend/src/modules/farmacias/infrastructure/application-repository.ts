import type {SqlClient} from '../../usuarios/contracts/tenant.js';
import type {ApplicationRepository,ApplicationView} from '../application/manage-applications.js';
import type {PharmacyApplicationInput} from '../domain/pharmacy-application.js';

const columns='id,estado,version,nombre_comercial,farmacia_activada_id,created_at,contacto,direccion,departamento,provincia,distrito,representante,ruc';
function map(row:Record<string,unknown>):ApplicationView{return {
  id:String(row.id),estado:String(row.estado),version:Number(row.version),
  nombreComercial:String(row.nombre_comercial),
  farmaciaId:row.farmacia_activada_id?String(row.farmacia_activada_id):null,
  createdAt:(row.created_at as Date).toISOString(),contacto:String(row.contacto),
  direccion:String(row.direccion),departamento:String(row.departamento),provincia:String(row.provincia),
  distrito:String(row.distrito),representante:String(row.representante),
  ruc:row.ruc?String(row.ruc):null,
};}
export class PgApplicationRepository implements ApplicationRepository {
  constructor(private readonly client:SqlClient){}
  async create(actor:string,input:PharmacyApplicationInput){
    const r=await this.client.query(`INSERT INTO f025.solicitud(solicitante_id,nombre_comercial,
      contacto,direccion,departamento,provincia,distrito,representante,ruc)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING ${columns}`,
    [actor,input.nombreComercial,input.contacto,input.direccion,input.departamento,input.provincia,
      input.distrito,input.representante,input.ruc??null]);
    if(r.rows.length!==1)throw new Error('Conflicto');
    return map(r.rows[0]);
  }
  async listOwn(actor:string){
    const r=await this.client.query(`SELECT ${columns} FROM f025.solicitud
      WHERE solicitante_id=$1 ORDER BY created_at DESC,id`,[actor]);
    return r.rows.map(map);
  }
  async findOwn(actor:string,id:string){
    const r=await this.client.query(`SELECT ${columns} FROM f025.solicitud
      WHERE id=$1 AND solicitante_id=$2`,[id,actor]);
    return r.rows.length===1?map(r.rows[0]):null;
  }
  async edit(id:string,version:number,input:PharmacyApplicationInput){
    const r=await this.client.query('SELECT f025.edit_application($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) AS version',
      [id,version,input.nombreComercial,input.contacto,input.direccion,input.departamento,
        input.provincia,input.distrito,input.representante,input.ruc??null]);
    if(r.rows.length!==1)throw new Error('Conflicto');
  }
  async command(id:string,version:number,action:'ENVIAR'|'REENVIAR'|'CANCELAR',correlation:string){
    const r=await this.client.query('SELECT * FROM f025.change_application($1,$2,$3,NULL,$4)',
      [id,version,action,correlation]);
    if(r.rows.length!==1)throw new Error('Conflicto');
  }
}
