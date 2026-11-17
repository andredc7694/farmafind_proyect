export interface AssistantRateLimitResult { readonly allowed: boolean; readonly retryAfter: number; }
export interface AssistantRateLimit { allow(key: string, now?: number): AssistantRateLimitResult; }
export class InMemoryAssistantRateLimit implements AssistantRateLimit {
  private readonly entries = new Map<string,{ start: number; count: number }>();
  constructor(private readonly maximum=30, private readonly windowMs=60_000) {}
  allow(key: string, now=Date.now()): AssistantRateLimitResult {
    const current=this.entries.get(key);
    if (!current || now-current.start>=this.windowMs) { this.entries.set(key,{start:now,count:1}); return {allowed:true,retryAfter:0}; }
    if (current.count>=this.maximum) return {allowed:false,retryAfter:Math.max(1,Math.ceil((current.start+this.windowMs-now)/1000))};
    current.count+=1; return {allowed:true,retryAfter:0};
  }
}
