import type {Clock,NotificationTransport,OutboxRepository,PublicationMetrics} from './ports.js';
import {classifyStatus,retryDelaySeconds} from '../domain/retry-policy.js';
import type {NotificationPublisherConfig} from '../../../config/notifications.js';

export class PublishOutbox{
  constructor(private readonly repository:OutboxRepository,private readonly transport:NotificationTransport,
    private readonly clock:Clock,private readonly config:NotificationPublisherConfig){}
  async run():Promise<PublicationMetrics>{
    const queue=await this.repository.queueStats(this.clock.now());const metrics:PublicationMetrics={...queue,claimed:0,published:0,retried:0,blocked:0,latencies:[]};
    const claims=await this.repository.claim(this.clock.now(),this.config.batchSize,this.config.leaseSeconds);metrics.claimed=claims.length;
    for(const claim of claims){
      try{
        const result=await this.transport.send(claim.envelope);metrics.latencies.push(result.latencyMs);
        if(result.status>=200&&result.status<300){await this.repository.published(claim,this.clock.now());metrics.published++;continue;}
        const transient=classifyStatus(result.status)==='TRANSIENT';const retry=transient&&claim.attempt<this.config.maxAttempts;
        const next=retry?new Date(this.clock.now().getTime()+retryDelaySeconds(claim.attempt,this.config.baseDelaySeconds,this.config.maxDelaySeconds)*1000):null;
        await this.repository.failed(claim,this.clock.now(),`HTTP_${result.status}`,next);retry?metrics.retried++:metrics.blocked++;
      }catch{
        const retry=claim.attempt<this.config.maxAttempts;const next=retry?new Date(this.clock.now().getTime()+retryDelaySeconds(claim.attempt,this.config.baseDelaySeconds,this.config.maxDelaySeconds)*1000):null;
        await this.repository.failed(claim,this.clock.now(),'TRANSPORT_ERROR',next);retry?metrics.retried++:metrics.blocked++;
      }
    }return metrics;
  }
}
