import type {NotificationEvent} from './contract.js';import type {Acceptance,EventRepository} from './repository.js';
export class ProcessEvent{constructor(private readonly repository:EventRepository,private readonly clock:{now():Date}){}execute(event:NotificationEvent,hash:string):Promise<Acceptance>{return this.repository.accept(event,hash,this.clock.now());}}
