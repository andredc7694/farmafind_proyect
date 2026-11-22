export interface PublicRateLimit { allow(key: string, now?: number): { allowed: boolean; retryAfter: number }; }

export class InMemoryPublicRateLimit implements PublicRateLimit {
  private readonly windows = new Map<string, { start: number; count: number }>();
  constructor(private readonly maximum = 60, private readonly windowMs = 60_000) {}
  allow(key: string, now = Date.now()): { allowed: boolean; retryAfter: number } {
    const current = this.windows.get(key);
    if (!current || now - current.start >= this.windowMs) {
      this.windows.set(key, { start: now, count: 1 }); return { allowed: true, retryAfter: 0 };
    }
    current.count += 1;
    return { allowed: current.count <= this.maximum, retryAfter: Math.max(1, Math.ceil((this.windowMs - (now - current.start)) / 1000)) };
  }
}
