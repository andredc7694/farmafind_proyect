import type { SqlClient } from '../../usuarios/contracts/tenant.js';

export type F025Capability =
  | 'F025_APPLICATION_READ' | 'F025_APPLICATION_REVIEW' | 'F025_DOCUMENT_READ'
  | 'F025_APPLICATION_DECIDE' | 'F025_PHARMACY_ACTIVATE';

/** The SQL function checks a live F01 session, platform assignment and explicit F02.5 grant. */
export class PgPharmacyPlatformPermissions {
  constructor(private readonly client:SqlClient){}

  async has(capability:F025Capability):Promise<boolean>{
    const result=await this.client.query('SELECT f025.has_capability($1) AS allowed',[capability]);
    return result.rows.length===1&&result.rows[0].allowed===true;
  }

  async require(capability:F025Capability):Promise<void>{
    if(!await this.has(capability))throw new Error('No autorizado');
  }
}
