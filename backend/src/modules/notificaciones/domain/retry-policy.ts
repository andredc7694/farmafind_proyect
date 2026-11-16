export type FailureKind='TRANSIENT'|'PERMANENT';
export function classifyStatus(status:number):FailureKind{return status===408||status===429||status>=500?'TRANSIENT':'PERMANENT';}
export function retryDelaySeconds(attempt:number,base=1,max=60){if(!Number.isInteger(attempt)||attempt<1)throw new Error('F05: intento invalido');return Math.min(max,base*2**(attempt-1));}
