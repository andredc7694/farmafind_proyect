import type { RedisClientType } from 'redis';
import type { SearchCache } from '../application/ports.js';

async function timeout<T>(operation: Promise<T>, milliseconds: number): Promise<T> {
  let handle: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([operation, new Promise<T>((_resolve, reject) => {
      handle = setTimeout(() => reject(new Error('F03: Redis timeout')), milliseconds);
    })]);
  } finally { if (handle) clearTimeout(handle); }
}

export class RedisSearchCache implements SearchCache {
  constructor(private readonly client: RedisClientType, private readonly timeoutMs: number) {}
  private async ready(): Promise<void> { if (!this.client.isOpen) await timeout(this.client.connect(), this.timeoutMs); }
  async generation(): Promise<string> {
    await this.ready();
    return (await timeout(this.client.get('farmafind:f03:v1:generation'), this.timeoutMs)) ?? '0';
  }
  async get(key: string): Promise<string | null> { await this.ready(); return timeout(this.client.get(key), this.timeoutMs); }
  async set(key: string, payload: string, ttlSeconds: number): Promise<void> {
    await this.ready(); await timeout(this.client.set(key, payload, { EX: ttlSeconds }), this.timeoutMs);
  }
}
