import {describe,expect,it,vi} from 'vitest';
import {migrateF025TestDatabase} from '../../src/modules/farmacias/infrastructure/migrate-f025.js';
import {PgPharmacyPlatformPermissions} from '../../src/modules/farmacias/infrastructure/platform-permissions.js';
import {PgPharmacyUnitOfWork} from '../../src/modules/farmacias/infrastructure/pharmacy-unit-of-work.js';

describe('F02.5 foundation boundaries',()=>{
  it('rejects persistent, remote and runtime migration targets before opening a connection',async()=>{
    const connect=vi.fn();
    for(const url of [
      'postgresql://f01_migrator:test@127.0.0.1:55431/farmafind_f01_test',
      'postgresql://f01_migrator:test@example.org:55431/farmafind_f01_test_abcdef123456',
      'postgresql://f01_runtime:test@127.0.0.1:55431/farmafind_f01_test_abcdef123456',
    ])await expect(migrateF025TestDatabase(url,connect)).rejects.toThrow();
    expect(connect).not.toHaveBeenCalled();
  });

  it('refuses a correctly named database on the wrong cluster or without marker',async()=>{
    const end=vi.fn(async()=>undefined);
    const connect=vi.fn(async()=>({query:vi.fn(async()=>({rows:[{
      database:'farmafind_f01_test_abcdef123456',role:'f01_migrator',
      cluster:'unrelated-test',marker:null,
    }]})),end}));
    await expect(migrateF025TestDatabase(
      'postgresql://f01_migrator:test@127.0.0.1:55431/farmafind_f01_test_abcdef123456',connect))
      .rejects.toThrow('clúster');
    expect(end).toHaveBeenCalledOnce();
  });

  it('requires an explicit capability result from the database',async()=>{
    const client={query:vi.fn(async()=>({rows:[{allowed:false}]})),release:vi.fn()};
    const permissions=new PgPharmacyPlatformPermissions(client);
    await expect(permissions.require('F025_APPLICATION_DECIDE')).rejects.toThrow('No autorizado');
    expect(client.query).toHaveBeenCalledWith('SELECT f025.has_capability($1) AS allowed',
      ['F025_APPLICATION_DECIDE']);
  });

  it('uses the verified F01 transaction instead of a privileged second pool',async()=>{
    const client={query:vi.fn(),release:vi.fn()};
    const identity={runWithClient:vi.fn(async(_secret:string,work:Function)=>
      work({},client,'00000000-0000-4000-8000-000000000001'))};
    const uow=new PgPharmacyUnitOfWork(identity);
    const actor=await uow.runWithContext('synthetic',async context=>{
      expect(context.client).toBe(client);
      return context.actorUserId;
    });
    expect(actor).toBe('00000000-0000-4000-8000-000000000001');
    expect(identity.runWithClient).toHaveBeenCalledOnce();
  });
});
