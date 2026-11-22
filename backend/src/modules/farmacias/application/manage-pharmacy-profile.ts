import {randomUUID} from 'node:crypto';
import type {VerifiedTenantTransactions} from '../../usuarios/contracts/tenant.js';

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export interface PharmacyProfile {
  farmaciaId:string;contacto:string;direccion:string;departamento:string;
  provincia:string;distrito:string;version:number;updatedAt:string;
}
function profile(row:Record<string,unknown>):PharmacyProfile {
  return {farmaciaId:String(row.farmacia_id),contacto:String(row.contacto),
    direccion:String(row.direccion),departamento:String(row.departamento),
    provincia:String(row.provincia),distrito:String(row.distrito),
    version:Number(row.version),updatedAt:new Date(String(row.updated_at)).toISOString()};
}

/** F01 verifies the session and tenant in one transaction; PostgreSQL enforces grants and RLS. */
export class ManagePharmacyProfile {
  constructor(private readonly transactions:VerifiedTenantTransactions){}
  get(secret:string,farmaciaId:string):Promise<PharmacyProfile>{
    if(!uuid.test(farmaciaId))throw new Error('Entrada no válida');
    return this.transactions.runWithClient(secret,async(transaction,client,actor)=>{
      try { await transaction.useAuthorizedPharmacy(actor,farmaciaId); }
      catch { throw new Error('No visible'); }
      const result=await client.query(`SELECT farmacia_id,contacto,direccion,departamento,provincia,
        distrito,version,updated_at FROM f025.farmacia_perfil WHERE farmacia_id=$1`,[farmaciaId]);
      if(result.rows.length!==1)throw new Error('No visible');
      return profile(result.rows[0]);
    });
  }
  updateContact(secret:string,farmaciaId:string,contacto:string,version:number):Promise<PharmacyProfile>{
    if(!uuid.test(farmaciaId)||typeof contacto!=='string'||contacto.trim().length<1||
      contacto.trim().length>160||!Number.isSafeInteger(version)||version<1)
      throw new Error('Entrada no válida');
    return this.transactions.runWithClient(secret,async(transaction,client,actor)=>{
      try { await transaction.useAuthorizedPharmacy(actor,farmaciaId); }
      catch { throw new Error('No visible'); }
      await client.query("SELECT set_config('app.f025_profile_correlation',$1,true)",[randomUUID()]);
      const result=await client.query(`UPDATE f025.farmacia_perfil SET contacto=$2,version=version+1
        WHERE farmacia_id=$1 AND version=$3
        RETURNING farmacia_id,contacto,direccion,departamento,provincia,distrito,version,updated_at`,
      [farmaciaId,contacto.trim(),version]);
      if(result.rows.length===1)return profile(result.rows[0]);
      const visible=await client.query('SELECT version FROM f025.farmacia_perfil WHERE farmacia_id=$1',[farmaciaId]);
      if(visible.rows.length!==1)throw new Error('No visible');
      throw new Error('Conflicto');
    });
  }
}
