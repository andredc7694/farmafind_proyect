import type {OutboxClaim,NotificationEnvelope} from '../domain/notification-event.js';
export interface Clock{now():Date}
export interface OutboxRepository{
  queueStats(now:Date):Promise<{pending:number;attempts:number;oldestAgeMs:number}>;
  claim(now:Date,batch:number,leaseSeconds:number):Promise<OutboxClaim[]>;
  published(claim:OutboxClaim,now:Date):Promise<void>;
  failed(claim:OutboxClaim,now:Date,code:string,next:Date|null):Promise<void>;
}
export interface NotificationTransport{send(event:NotificationEnvelope):Promise<{status:number;latencyMs:number}>}
export interface PublicationMetrics{pending:number;attempts:number;oldestAgeMs:number;claimed:number;published:number;retried:number;blocked:number;latencies:number[]}
