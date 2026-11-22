import type { VerifiedTenantTransactions, SqlClient } from '../../usuarios/contracts/tenant.js';
import { PgPharmacyPlatformPermissions } from './platform-permissions.js';
import type {ApplicationUnitOfWork} from '../application/manage-applications.js';
import {PgApplicationRepository} from './application-repository.js';
import type {ReviewUnitOfWork} from '../application/review-applications.js';
import {PgPlatformReviewRepository} from './platform-review-repository.js';

export interface PharmacyOperationContext {
  readonly client:SqlClient;
  readonly actorUserId:string;
  readonly platform:PgPharmacyPlatformPermissions;
}

/** Reuses F01's verified transaction, role switch and transaction-local actor context. */
export class PgPharmacyUnitOfWork implements ApplicationUnitOfWork,ReviewUnitOfWork {
  constructor(private readonly identity:VerifiedTenantTransactions){}

  runWithContext<T>(sessionSecret:string,work:(context:PharmacyOperationContext)=>Promise<T>):Promise<T>{
    return this.identity.runWithClient(sessionSecret,async(_transaction,client,actorUserId)=>
      work({client,actorUserId,platform:new PgPharmacyPlatformPermissions(client)}));
  }

  run<T>(sessionSecret:string,work:(repository:PgApplicationRepository,actor:string)=>Promise<T>):Promise<T>{
    return this.runWithContext(sessionSecret,context=>
      work(new PgApplicationRepository(context.client),context.actorUserId));
  }

  runReview<T>(sessionSecret:string,work:(repository:PgPlatformReviewRepository)=>Promise<T>):Promise<T>{
    return this.runWithContext(sessionSecret,context=>
      work(new PgPlatformReviewRepository(context.client,context.platform)));
  }
}
