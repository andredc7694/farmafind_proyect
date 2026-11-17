/** Compare every documented F00-F06 OpenAPI operation with an implemented Express route. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const contracts=[
  ['specs/001-f00-bootstrap-proyecto/contracts/bootstrap.openapi.yaml',''],
  ['specs/002-f01-identidad-multitenant/contracts/identity.openapi.yaml','/api/v1'],
  ['specs/003-f02-catalogo-inventario/contracts/inventory.openapi.yaml','/api/v1'],
  ['specs/004-f03-consultas-publicas/contracts/public-search.openapi.yaml','/api/v1'],
  ['specs/005-f04-reservas/contracts/reservations.openapi.yaml',''],
  ['specs/006-f05-notificaciones/contracts/notifications.openapi.yaml',''],
  ['specs/007-f06-asistente-ia/contracts/assistant.openapi.yaml',''],
];
const routeFiles=[
  ['backend/src/bootstrap/health.ts',''],
  ['notifications/src/bootstrap/health.ts',''],
  ['backend/src/modules/usuarios/presentation/auth-router.ts','/api/v1'],
  ['backend/src/modules/usuarios/presentation/membership-router.ts','/api/v1'],
  ['backend/src/modules/usuarios/presentation/admin-memberships-router.ts','/api/v1'],
  ['backend/src/modules/medicamentos/presentation/catalog-router.ts','/api/v1'],
  ['backend/src/modules/inventario/presentation/inventory-router.ts','/api/v1'],
  ['backend/src/modules/inventario/presentation/import-router.ts','/api/v1'],
  ['backend/src/modules/busqueda/presentation/public-search-router.ts','/api/v1'],
  ['backend/src/modules/busqueda/presentation/public-pharmacy-router.ts','/api/v1'],
  ['backend/src/modules/reservas/presentation/customer-reservations-router.ts','/api/v1'],
  ['backend/src/modules/reservas/presentation/pharmacy-reservations-router.ts','/api/v1'],
  ['backend/src/modules/asistente-ia/presentation/assistant-router.ts','/api/v1'],
  ['notifications/src/events/router.ts',''],
];
const normalize=value=>value.replace(/:\w+/g,'{}').replace(/\{[^}]+\}/g,'{}');
const key=(method,route)=>`${method.toUpperCase()} ${normalize(route)}`;

function contractOperations(file,prefix){
  const operations=[];let inPaths=false,currentPath='';
  for(const line of readFileSync(path.join(root,file),'utf8').split(/\r?\n/)){
    if(/^paths:\s*$/.test(line)){inPaths=true;continue;}
    if(inPaths&&/^\S/.test(line)){inPaths=false;currentPath='';}
    if(!inPaths)continue;
    const foundPath=line.match(/^  (\/[^:]+):\s*$/);if(foundPath){currentPath=foundPath[1];continue;}
    const foundMethod=line.match(/^    (get|post|put|patch|delete):\s*$/i);
    if(currentPath&&foundMethod)operations.push(key(foundMethod[1],`${prefix}${currentPath}`));
  }
  return operations;
}

function implementedOperations(file,prefix){
  const source=readFileSync(path.join(root,file),'utf8'),operations=[];
  const literal=/(?:router|app)\.(get|post|put|patch|delete)\(\s*(['"`])([^'"`$]+)\2/g;
  for(const match of source.matchAll(literal))operations.push(key(match[1],`${prefix}${match[3]}`));
  if(file.endsWith('pharmacy-reservations-router.ts')){
    const template=source.match(/router\.post\(`([^`]+\$\{name\})`/);
    assert(template,'Ruta dinámica de acciones F04 ausente');
    for(const match of source.matchAll(/action\('([^']+)'/g)){
      operations.push(key('post',`${prefix}${template[1].replace('${name}',match[1])}`));
    }
  }
  return operations;
}

const documented=new Set(contracts.flatMap(([file,prefix])=>contractOperations(file,prefix)));
const implemented=new Set(routeFiles.flatMap(([file,prefix])=>implementedOperations(file,prefix)));
const missing=[...documented].filter(operation=>!implemented.has(operation));
assert.deepEqual(missing,[],`Operaciones OpenAPI sin ruta Express: ${missing.join(', ')}`);
assert.equal(documented.size,33,'El inventario F00-F06 cambió; revisar contrato y validador');
console.log(`Contratos OpenAPI F00-F06: ${documented.size} operaciones documentadas con ruta Express.`);
