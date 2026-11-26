# Tasks: F02.2 (casilla solo con evidencia real en evidence.md)

**Puerta previa**: la enmienda F02.1 integrada en `main` (T001).

## Preparación
- [ ] T001 Confirmar que la enmienda F02.1 está en `main`, actualizar la rama y registrar la línea base de pruebas (dependencia)
- [ ] T002 Contrato OpenAPI y su verificación de rutas (`--f022-routes`) en `contracts/catalog.openapi.yaml` y `scripts/integration/check-openapi-routes.mjs` (FR-009)

## Datos y seguridad (bloquean el resto)
- [ ] T003 Pruebas rojas de migración: base con productos, inventarios, reservas e importaciones previas que deben sobrevivir (FR-002, SC-003)
- [ ] T004 `f02/007_product_identity.sql`: columnas, índice único nuevo y retiro de la restricción anterior en una transacción (FR-001, FR-002)
- [ ] T005 Matriz RLS roja Alfa/Beta, revisor, sin segundo factor, revisor miembro de la farmacia, escritura directa y concurrencia (FR-007, FR-008, FR-010, SC-002)
- [ ] T006 `f02/008_catalog_proposals.sql`: tablas, RLS + FORCE, rol ejecutor sin BYPASSRLS, funciones y auditoría (FR-007, FR-008)
- [ ] T007 `catalog.propose`: `f01/017_catalog_capability.sql`, `staff-policy.ts` y alta offline TEST de `CATALOG_REVIEW` (FR-007)
- [ ] T008 `f025/016_owner_catalog_test.sql` y registro de su hash para revisión de Andre, sin tocar los demás (FR-007)

## US1 — Identidad y duplicados (P1)
- [ ] T009 Identidad nueva en `medicamento.ts` y repositorios; unitarias (FR-001, FR-005)
- [ ] T010 Detector: columnas `codigo`, `laboratorio`, `marca`, `forma_farmaceutica` con empate preguntado (FR-004)
- [ ] T011 Duplicado real por identidad o código, con fila repetida y causa; conciliación sin equivalencias (FR-003, FR-005, SC-001)

## US2 — Mostrar laboratorio y marca (P1)
- [ ] T012 `f03/003_public_search_identity.sql`, repositorio, sugerencias, comparables y versión de caché (FR-006)
- [ ] T013 Reservas, historial/CSV e inventario muestran laboratorio y marca sin cambiar comportamiento (FR-006)

## US3 — Proponer (P1)
- [ ] T014 Casos de uso y rutas: proponer los pendientes de una vista previa y consultar estados (FR-007, FR-009)
- [ ] T015 Interfaz «Proponer los pendientes» y estado de propuestas, agrupado y paginado (FR-009)

## US4 — Revisar (P1)
- [ ] T016 Casos de uso y rutas del revisor: lotes, muestra aleatoria obligatoria, decisión individual y en lote (aprobar, rechazar, vincular), filas con aviso fuera del lote (FR-008)
- [ ] T017 Interfaz `/admin/catalogo/propuestas` con resumen, filtros, muestra y resultado agrupado, accesible en claro y oscuro (FR-008)

## US5 y cierre
- [ ] T018 E2E: proponer → revisar muestra → aprobar en lote → reimportar → confirmar → buscar; Beta no ve nada (SC-004, FR-010)
- [ ] T019 Migración probada sobre una copia de la base TEST con datos (conteos y claves antes y después) (FR-002, SC-003)
- [ ] T020 Regresión F02, F03 (con y sin Redis), F04, F08.1, F01.1/F01.2, F02.1, contratos, check, build, frontend (FR-010)
- [ ] T021 Revisión de seguridad de las migraciones; `evidence.md`, `convergence.md`, `traceability.md`, ESTADO.md (FR-011)
- [ ] T022 DEMO y `acceptance.md`; aceptación humana, nunca autoaprobar

**Orden**: T001 → T002–T008 → US1 → US2 y US3 → US4 → cierre. Un commit por lote probado.
