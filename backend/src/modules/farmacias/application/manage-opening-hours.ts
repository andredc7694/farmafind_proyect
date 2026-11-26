import { parseOpeningHours } from '../domain/opening-hours.js';
import type { OpeningDay } from '../domain/opening-hours.js';

export class OpeningHoursForbiddenError extends Error {}
export class OpeningHoursConflictError extends Error {}

export interface StoredOpeningHours { readonly version:number; readonly dias:readonly OpeningDay[] }
export interface OpeningHoursRepository {
  read(pharmacyId:string):Promise<StoredOpeningHours>;
  /** Guarda los 7 días con versión+1 solo si la versión actual es `expected`; null si cambió. */
  replace(pharmacyId:string,actorId:string,expected:number,dias:readonly OpeningDay[]):Promise<StoredOpeningHours|null>;
}
export interface OpeningHoursUnitOfWork {
  run<T>(secret:string,pharmacyId:string,capability:'pharmacy.profile.read'|'pharmacy.profile.write',
    work:(repository:OpeningHoursRepository,actorId:string)=>Promise<T>):Promise<T>;
}
export interface PublicOpeningHoursReader {
  read(pharmacyIds:readonly string[]):Promise<Record<string,OpeningDay[]>>;
}
export interface OpeningHoursCache {
  get(pharmacyIds:readonly string[]):Promise<Record<string,OpeningDay[]>>;
  set(values:Record<string,OpeningDay[]>):Promise<void>;
  forget(pharmacyId:string):Promise<void>;
}

export class ManageOpeningHours {
  constructor(private readonly transactions:OpeningHoursUnitOfWork,private readonly cache?:OpeningHoursCache) {}

  read(secret:string,pharmacyId:string):Promise<StoredOpeningHours> {
    return this.transactions.run(secret,pharmacyId,'pharmacy.profile.read',repository=>repository.read(pharmacyId));
  }

  async replace(secret:string,pharmacyId:string,raw:unknown):Promise<StoredOpeningHours> {
    const input=parseOpeningHours(raw);
    const saved=await this.transactions.run(secret,pharmacyId,'pharmacy.profile.write',async(repository,actorId)=>{
      const result=await repository.replace(pharmacyId,actorId,input.version,input.dias);
      if (!result) throw new OpeningHoursConflictError('Versión obsoleta');
      return result;
    });
    await this.cache?.forget(pharmacyId).catch(()=>undefined);
    return saved;
  }
}

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Lectura pública con cache-aside (Redis); si la caché falla se lee la base. */
export class ReadPublicOpeningHours {
  constructor(private readonly reader:PublicOpeningHoursReader,private readonly cache?:OpeningHoursCache) {}
  async read(rawIds:unknown):Promise<Record<string,OpeningDay[]>> {
    const ids=[...new Set(String(rawIds ?? '').split(',').map(item=>item.trim()).filter(Boolean))];
    if (ids.length<1 || ids.length>50 || ids.some(id=>!uuid.test(id))) throw new RangeError('ids inválidos');
    const cached=this.cache ? await this.cache.get(ids).catch(()=>({} as Record<string,OpeningDay[]>)) : {};
    const missing=ids.filter(id=>!(id in cached));
    const fresh=missing.length ? await this.reader.read(missing) : {};
    const complete=Object.fromEntries(missing.map(id=>[id,fresh[id] ?? []]));
    if (this.cache && missing.length) await this.cache.set(complete).catch(()=>undefined);
    return {...cached,...complete};
  }
}
