/** F07 contract-to-router check; historical OpenAPI checks run separately. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const contract=readFileSync(new URL('../../specs/010-f07-geolocalizacion/contracts/geolocation.openapi.yaml',import.meta.url),'utf8');
const publicRouter=readFileSync(new URL('../../backend/src/modules/busqueda/presentation/geolocation-router.ts',import.meta.url),'utf8');
const privateRouter=readFileSync(new URL('../../backend/src/modules/farmacias/presentation/location-router.ts',import.meta.url),'utf8');
const operations=[
  ['listPharmaciesByCity',publicRouter,"router.get('/geolocalizacion/farmacias'"],
  ['queryNearbyPharmacies',publicRouter,"router.post('/geolocalizacion/consultas'"],
  ['proposePharmacyLocation',privateRouter,"router.post('/farmacias/:farmaciaId/ubicacion/propuestas'"],
  ['reviewPharmacyLocation',privateRouter,"router.post('/farmacias/:farmaciaId/ubicacion/propuestas/:propuestaId/revision'"],
];
assert.equal([...contract.matchAll(/operationId:\s*\S+/g)].length,operations.length);
for(const [operation,router,route] of operations){
  assert.ok(contract.includes(`operationId: ${operation}`),`${operation} no documentada`);
  assert.ok(router.includes(route),`${operation} sin ruta Express`);
}
assert.ok(contract.includes('Cache-Control:'));
assert.ok(privateRouter.includes('security.requireCsrf'));
console.log(`F07 OpenAPI: ${operations.length} operaciones con ruta Express y controles privados documentados.`);
