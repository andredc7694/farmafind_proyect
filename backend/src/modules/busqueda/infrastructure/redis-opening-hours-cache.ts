import type { RedisClientType } from 'redis';
import type { OpeningDay, OpeningHoursCache } from '../../farmacias/contracts/opening-hours.js';

/** F07.1: caché pública del horario (Redis solo en la infraestructura de búsqueda F03). */
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
