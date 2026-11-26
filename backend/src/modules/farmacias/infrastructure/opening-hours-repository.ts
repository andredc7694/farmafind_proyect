import type { RedisClientType } from 'redis';
import type { SqlClient, VerifiedTenantTransactions } from '../../usuarios/contracts/tenant.js';
import { shortTime } from '../domain/opening-hours.js';
import type { OpeningDay } from '../domain/opening-hours.js';
import { OpeningHoursForbiddenError } from '../application/manage-opening-hours.js';
import type { OpeningHoursCache, OpeningHoursRepository, OpeningHoursUnitOfWork, PublicOpeningHoursReader,
  StoredOpeningHours } from '../application/manage-opening-hours.js';

interface Queryable { query(sql:string,values?:unknown[]):Promise<{rows:Array<Record<string,unknown>>}> }

function days(rows:ReadonlyArray<Record<string,unknown>>):OpeningDay[] {
  return rows.map(row=>({dia:Number(row.dia),cerrado:row.cerrado===true,abre:shortTime(row.abre),cierra:shortTime(row.cierra)}));
}

/** Escritura y lectura privadas bajo RLS (f07.can_opening_hours exige app.farmacia_id y la delegación). */
export class PgOpeningHoursRepository implements OpeningHoursRepository {
  constructor(private readonly client:SqlClient) {}
  async read(pharmacyId:string):Promise<StoredOpeningHours> {
    const result=await this.client.query(`SELECT dia,cerrado,abre,cierra,version FROM f07.horario_atencion
      WHERE farmacia_id=$1 ORDER BY dia`,[pharmacyId]);
    return {version:result.rows.reduce((max,row)=>Math.max(max,Number(row.version)),0),dias:days(result.rows)};
  }
  async replace(pharmacyId:string,actorId:string,expected:number,dias:readonly OpeningDay[]):Promise<StoredOpeningHours|null> {
    const current=await this.client.query(`SELECT COALESCE(max(version),0) AS version FROM f07.horario_atencion
      WHERE farmacia_id=$1`,[pharmacyId]);
    if (Number(current.rows[0]?.version ?? 0)!==expected) return null;
    const next=expected+1;
    for (const day of dias) {
      await this.client.query(`INSERT INTO f07.horario_atencion(farmacia_id,dia,cerrado,abre,cierra,version,actualizado_por)
        VALUES($1,$2,$3,$4,$5,$6,$7)
        ON CONFLICT (farmacia_id,dia) DO UPDATE SET cerrado=EXCLUDED.cerrado,abre=EXCLUDED.abre,
          cierra=EXCLUDED.cierra,version=EXCLUDED.version,actualizado_por=EXCLUDED.actualizado_por,actualizado_at=now()`,
        [pharmacyId,day.dia,day.cerrado,day.abre,day.cierra,next,actorId]);
    }
    return this.read(pharmacyId);
  }
}

export class PgOpeningHoursUnitOfWork implements OpeningHoursUnitOfWork {
  constructor(private readonly identity:VerifiedTenantTransactions) {}
  run<T>(secret:string,pharmacyId:string,capability:'pharmacy.profile.read'|'pharmacy.profile.write',
    work:(repository:OpeningHoursRepository,actorId:string)=>Promise<T>):Promise<T> {
    return this.identity.runWithClient(secret,async(transaction,client,actorId)=>{
      let membership;
      try { membership=await transaction.useAuthorizedPharmacy(actorId,pharmacyId); }
      catch { throw new OpeningHoursForbiddenError('Farmacia no autorizada'); }
      const delegations=await transaction.listOwnDelegations(membership.id);
      if (!delegations.some(item=>item.pharmacyId===pharmacyId && item.capabilityCode===capability && item.state==='ACTIVA'))
        throw new OpeningHoursForbiddenError('Capacidad insuficiente');
      return work(new PgOpeningHoursRepository(client),actorId);
    });
  }
}

/** Lectura pública: función f07.public_opening_hours (solo farmacias activas, máximo 50). */
export class PgPublicOpeningHours implements PublicOpeningHoursReader {
  constructor(private readonly database:Queryable) {}
  async read(pharmacyIds:readonly string[]):Promise<Record<string,OpeningDay[]>> {
    const result=await this.database.query('SELECT * FROM f07.public_opening_hours($1::uuid[])',[pharmacyIds]);
    const grouped:Record<string,Array<Record<string,unknown>>>={};
    for (const row of result.rows) (grouped[String(row.farmacia_id)] ??= []).push(row);
    return Object.fromEntries(Object.entries(grouped).map(([id,rows])=>[id,days(rows)]));
  }
}

const key=(id:string)=>`farmafind:f071:v1:horario:${id}`;
/** Cache-aside con TTL corto; se borra la clave al guardar. */
export class RedisOpeningHoursCache implements OpeningHoursCache {
  constructor(private readonly client:RedisClientType,private readonly ttlSeconds=300) {}
  private async ready() { if (!this.client.isOpen) await this.client.connect(); }
  async get(pharmacyIds:readonly string[]):Promise<Record<string,OpeningDay[]>> {
    await this.ready();
    const values=await this.client.mGet(pharmacyIds.map(key));
    return Object.fromEntries(pharmacyIds.flatMap((id,index)=>{
      const value=values[index]; return value ? [[id,JSON.parse(value) as OpeningDay[]]] : [];
    }));
  }
  async set(values:Record<string,OpeningDay[]>):Promise<void> {
    await this.ready();
    for (const [id,value] of Object.entries(values)) await this.client.set(key(id),JSON.stringify(value),{EX:this.ttlSeconds});
  }
  async forget(pharmacyId:string):Promise<void> { await this.ready(); await this.client.del(key(pharmacyId)); }
}
