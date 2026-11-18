import { afterAll, describe, expect, it, vi } from 'vitest';
import { createClient, type RedisClientType } from 'redis';
import { RedisSearchInvalidator } from '../../src/modules/busqueda/infrastructure/search-invalidator.js';

describe('F07 invalidación F03 y fallback',()=>{
  it('fallo Redis no bloquea la publicación confirmada',async()=>{
    const fake={isOpen:true,incr:vi.fn().mockRejectedValue(new Error('Redis TEST caído'))} as unknown as RedisClientType;
    await expect(new RedisSearchInvalidator(fake).invalidate()).resolves.toBeUndefined();
    expect(fake.incr).toHaveBeenCalledWith('farmafind:f03:v1:generation');
  });
});

const group=process.env.F07_TEST_REDIS_URL?describe:describe.skip;
group('F07 Redis real local',()=>{
  let client:RedisClientType;
  afterAll(async()=>{if(client?.isOpen)await client.quit();});
  it('invalida la generación compartida sin almacenar coordenadas personales',async()=>{
    client=createClient({url:process.env.F07_TEST_REDIS_URL,socket:{reconnectStrategy:false,connectTimeout:1000}});
    client.on('error',()=>undefined);await client.connect();
    const before=Number((await client.get('farmafind:f03:v1:generation'))??0);
    await new RedisSearchInvalidator(client).invalidate();
    const after=Number((await client.get('farmafind:f03:v1:generation'))??0);
    expect(after).toBe(before+1);
    const keys=await client.keys('farmafind:f07:*');
    expect(keys).toEqual([]);
  });
});
