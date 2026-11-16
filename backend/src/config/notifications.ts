export interface NotificationPublisherConfig{batchSize:number;leaseSeconds:number;maxAttempts:number;baseDelaySeconds:number;maxDelaySeconds:number;requestTimeoutMs:number}
function integer(value:string|undefined,fallback:number,min:number,max:number,name:string){const parsed=value===undefined?fallback:Number(value);if(!Number.isInteger(parsed)||parsed<min||parsed>max)throw new Error(`F05: ${name} invalido`);return parsed;}
export function loadNotificationPublisherConfig(env:NodeJS.ProcessEnv):NotificationPublisherConfig{return{
  batchSize:integer(env.F05_BATCH_SIZE,25,1,100,'F05_BATCH_SIZE'),
  leaseSeconds:integer(env.F05_LEASE_SECONDS,30,5,300,'F05_LEASE_SECONDS'),
  maxAttempts:integer(env.F05_MAX_ATTEMPTS,12,1,30,'F05_MAX_ATTEMPTS'),
  baseDelaySeconds:integer(env.F05_BASE_DELAY_SECONDS,1,1,60,'F05_BASE_DELAY_SECONDS'),
  maxDelaySeconds:integer(env.F05_MAX_DELAY_SECONDS,60,1,600,'F05_MAX_DELAY_SECONDS'),
  requestTimeoutMs:integer(env.F05_REQUEST_TIMEOUT_MS,3000,100,30000,'F05_REQUEST_TIMEOUT_MS'),
};}
