import type { RedisClientType } from 'redis';
import type { SearchInvalidator } from '../application/ports.js';

/** Best-effort post-commit generation invalidation; business writes never depend on Redis. */
export class RedisSearchInvalidator implements SearchInvalidator {
  constructor(private readonly client: RedisClientType) {}
  async invalidate(): Promise<void> {
    try {
      if (!this.client.isOpen) await this.client.connect();
      await this.client.incr('farmafind:f03:v1:generation');
    } catch { /* The short TTL bounds staleness while Redis is unavailable. */ }
  }
}
