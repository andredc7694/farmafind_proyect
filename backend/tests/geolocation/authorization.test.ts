import { describe, expect, it } from 'vitest';
import { authorizeLocationContext } from '../../src/modules/farmacias/application/location-authorization.js';
import type { IdentityTransaction } from '../../src/modules/usuarios/application/ports.js';

const pharmacy='00000000-0000-4000-8000-000000000001';
const actor='00000000-0000-4000-8000-000000000002';
function transaction(capabilities:string[],active=true):IdentityTransaction {
  return {
    useAuthorizedPharmacy:async(_actorId:string,scopeId:string)=>{
      if(!active||scopeId!==pharmacy)throw new Error('Membresía inactiva');
      return{id:'membership',pharmacyId:pharmacy};
    },
    listOwnDelegations:async()=>capabilities.map(capabilityCode=>({pharmacyId:pharmacy,
      capabilityCode,state:'ACTIVA'})),
  } as unknown as IdentityTransaction;
}
describe('F07 autorización local',()=>{
  it('requiere membresía activa y capacidad exacta por farmacia',async()=>{
    expect(await authorizeLocationContext(transaction(['GEO_LOCATION_PROPOSE']),actor,pharmacy,
      'GEO_LOCATION_PROPOSE')).toMatchObject({pharmacyId:pharmacy,actorId:actor});
    await expect(authorizeLocationContext(transaction(['GEO_LOCATION_PROPOSE']),actor,pharmacy,
      'GEO_LOCATION_REVIEW')).rejects.toThrow();
    await expect(authorizeLocationContext(transaction(['GEO_LOCATION_REVIEW'],false),actor,pharmacy,
      'GEO_LOCATION_REVIEW')).rejects.toThrow();
  });
  it('no acepta delegación de otra farmacia',async()=>{
    const other=transaction(['GEO_LOCATION_REVIEW']);
    await expect(authorizeLocationContext(other,actor,'00000000-0000-4000-8000-000000000003',
      'GEO_LOCATION_REVIEW')).rejects.toThrow();
  });
});
