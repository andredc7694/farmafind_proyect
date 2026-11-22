import type {PublicationInvalidator} from '../application/review-applications.js';
import type {SearchInvalidator} from '../../busqueda/contracts/search-invalidator.js';

/** Resolve F03's cache only after the F02.5 activation transaction commits. */
export class PharmacyPublicationInvalidator implements PublicationInvalidator {
  constructor(private readonly current:()=>SearchInvalidator|undefined){}
  async invalidate():Promise<void>{await this.current()?.invalidate();}
}
