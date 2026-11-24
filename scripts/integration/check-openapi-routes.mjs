/** Compare every documented F00-F06 OpenAPI operation with an implemented Express route. */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
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
  ['specs/009-f061-asistente-conversacional/contracts/conversation.openapi.yaml',''],
];
const routeFiles=[
  ['backend/src/bootstrap/health.ts',''],
  ['notifications/src/bootstrap/health.ts',''],
  ['backend/src/modules/usuarios/presentation/auth-router.ts','/api/v1'],
  ['backend/src/modules/usuarios/presentation/membership-router.ts','/api/v1'],
  ['backend/src/modules/usuarios/presentation/admin-memberships-router.ts','/api/v1'],
  ['backend/src/modules/usuarios/presentation/platform-authorization-router.ts','/api/v1'],
  ['backend/src/modules/medicamentos/presentation/catalog-router.ts','/api/v1'],
  ['backend/src/modules/inventario/presentation/inventory-router.ts','/api/v1'],
  ['backend/src/modules/inventario/presentation/import-router.ts','/api/v1'],
  ['backend/src/modules/busqueda/presentation/public-search-router.ts','/api/v1'],
  ['backend/src/modules/busqueda/presentation/public-pharmacy-router.ts','/api/v1'],
  ['backend/src/modules/reservas/presentation/customer-reservations-router.ts','/api/v1'],
  ['backend/src/modules/reservas/presentation/pharmacy-reservations-router.ts','/api/v1'],
  ['backend/src/modules/asistente-ia/presentation/assistant-router.ts','/api/v1'],
  ['backend/src/modules/asistente-ia/presentation/conversation-router.ts','/api/v1'],
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
  if(file.endsWith('presentation/staff-access-router.ts')){
    // F01.1: aceptar y rechazar invitaciones comparten una ruta generada en un bucle.
    const template=source.match(/router\.post\(`([^`]+\$\{action\})`/);
    assert(template,'Ruta dinámica F01.1 de invitaciones ausente');
    const actions=source.match(/for\s*\(const action of \[([^\]]+)\] as const\)/)?.[1];
    assert(actions,'Acciones F01.1 de invitaciones ausentes');
    for(const match of actions.matchAll(/'([^']+)'/g))
      operations.push(key('post',`${prefix}${template[1].replace('${action}',match[1])}`));
  }
  if(file.endsWith('presentation/application-router.ts')){
    const template=source.match(/router\.post\(`([^`]+\$\{action\})`/);
    assert(template,'Ruta dinámica F02.5 de solicitante ausente');
    const actions=source.match(/for\(const action of \[([^\]]+)\] as const\)/)?.[1];
    assert(actions,'Acciones F02.5 de solicitante ausentes');
    for(const match of actions.matchAll(/'([^']+)'/g))
      operations.push(key('post',`${prefix}${template[1].replace('${action}',match[1])}`));
  }
  return operations;
}

if (process.argv.includes('--f041-contract') || process.argv.includes('--f041-routes')) {
  // F04.1 (specs/015): tres operaciones nuevas de lectura; las rutas se exigen con --f041-routes.
  const file='specs/015-f041-operacion-reservas/contracts/reservations-ops.openapi.yaml';
  const operations=contractOperations(file,'/api/v1');
  assert.equal(operations.length,3,'El inventario propuesto F04.1 cambió; revisar contrato');
  assert.equal(new Set(operations).size,operations.length,'Operación F04.1 duplicada');
  if(process.argv.includes('--f041-routes')){
    const implemented=new Set(implementedOperations('backend/src/modules/reservas/presentation/pharmacy-reservations-router.ts','/api/v1'));
    const missing=operations.filter(operation=>!implemented.has(operation));
    assert.deepEqual(missing,[],`F04.1: rutas pendientes: ${missing.join(', ')}`);
    console.log(`Contrato F04.1: ${operations.length} operaciones documentadas con ruta Express.`);
  } else console.log(`Contrato F04.1: ${operations.length} operaciones documentadas; implementación pendiente.`);
} else if (process.argv.includes('--f011-contract') || process.argv.includes('--f011-routes')) {
  // F01.1 (specs/014): contrato aditivo; las rutas se exigen solo con --f011-routes (tarea T049).
  const file='specs/014-f011-identidad-personal/contracts/identity-staff.openapi.yaml';
  const source=readFileSync(path.join(root,file),'utf8');
  const operations=contractOperations(file,'/api/v1');
  assert.equal(operations.length,26,'El inventario propuesto F01.1 cambió; revisar contrato');
  assert.equal(new Set(operations).size,operations.length,'Operación F01.1 duplicada');
  const defined=new Set([...source.matchAll(/^    ([A-Za-z][A-Za-z0-9]+):/gm)].map(match=>match[1]));
  for(const match of source.matchAll(/\$ref: '#\/components\/(?:schemas|parameters|responses)\/([^']+)'/g)){
    assert(defined.has(match[1]),`Referencia F01.1 sin definir: ${match[1]}`);
  }
  if(process.argv.includes('--f011-routes')){
    const proposedRoutes=[
      ['backend/src/modules/usuarios/presentation/auth-router.ts','/api/v1'],
      ['backend/src/modules/usuarios/presentation/staff-router.ts','/api/v1'],
      ['backend/src/modules/usuarios/presentation/staff-access-router.ts','/api/v1'],
      ['backend/src/modules/usuarios/presentation/profile-router.ts','/api/v1'],
      ['backend/src/modules/usuarios/presentation/mfa-router.ts','/api/v1'],
    ];
    const implemented=new Set(proposedRoutes.flatMap(([route,prefix])=>
      existsSync(path.join(root,route)) ? implementedOperations(route,prefix) : []));
    const missing=operations.filter(operation=>!implemented.has(operation));
    assert.deepEqual(missing,[],`F01.1: rutas pendientes: ${missing.join(', ')}`);
    console.log(`Contrato F01.1: ${operations.length} operaciones documentadas con ruta Express.`);
  } else console.log(`Contrato F01.1: ${operations.length} operaciones documentadas; implementación pendiente.`);
} else if (process.argv.includes('--f025-contract') || process.argv.includes('--f025-routes')) {
  const file='specs/012-f025-incorporacion-farmacias/contracts/f025.openapi.yaml';
  const source=readFileSync(path.join(root,file),'utf8');
  const operations=contractOperations(file,'/api/v1');
  assert.equal(operations.length,13,'El inventario propuesto F02.5 cambió; revisar contrato');
  assert.equal(new Set(operations).size,operations.length,'Operación F02.5 duplicada');
  const schemas=new Set([...source.matchAll(/^    ([A-Za-z][A-Za-z0-9]+):/gm)].map(match=>match[1]));
  for(const match of source.matchAll(/\$ref: '#\/components\/(?:schemas|parameters|responses)\/([^']+)'/g)){
    assert(schemas.has(match[1]),`Referencia F02.5 sin definir: ${match[1]}`);
  }
  if(process.argv.includes('--f025-routes')){
    const proposedRoutes=[
      ['backend/src/modules/farmacias/presentation/application-router.ts','/api/v1'],
      ['backend/src/modules/farmacias/presentation/platform-applications-router.ts','/api/v1'],
      ['backend/src/modules/farmacias/presentation/test-document-router.ts','/api/v1'],
      ['backend/src/modules/farmacias/presentation/pharmacy-profile-router.ts','/api/v1'],
    ];
    const implemented=new Set(proposedRoutes.flatMap(([route,prefix])=>
      existsSync(path.join(root,route)) ? implementedOperations(route,prefix) : []));
    const missing=operations.filter(operation=>!implemented.has(operation));
    assert.deepEqual(missing,[],`F02.5: rutas pendientes: ${missing.join(', ')}`);
    const internal=contractOperations('specs/012-f025-incorporacion-farmacias/contracts/application-events.openapi.yaml','');
    const internalRoutes=implementedOperations('notifications/src/events/application-router.ts','');
    assert.deepEqual(internal,['POST /internal/v1/pharmacy-application-events']);
    assert.deepEqual(internal.filter(operation=>!internalRoutes.includes(operation)),[],
      'F02.5: contrato interno de solicitudes sin ruta F05');
    console.log(`Contrato F02.5: ${operations.length} operaciones documentadas con ruta Express.`);
  } else console.log(`Contrato F02.5: ${operations.length} operaciones documentadas; implementación pendiente.`);
} else {
  const documented=new Set(contracts.flatMap(([file,prefix])=>contractOperations(file,prefix)));
  const implemented=new Set(routeFiles.flatMap(([file,prefix])=>implementedOperations(file,prefix)));
  const missing=[...documented].filter(operation=>!implemented.has(operation));
  assert.deepEqual(missing,[],`Operaciones OpenAPI sin ruta Express: ${missing.join(', ')}`);
  assert.equal(documented.size,41,'El inventario F00-F06/F06.1/F02.1 cambió; revisar contrato y validador');
  console.log(`Contratos OpenAPI F00-F06/F06.1/F02.1: ${documented.size} operaciones documentadas con ruta Express.`);
}
