# Tasks: F02 — Catálogo e inventario por farmacia

**Input**: [spec.md](spec.md), [plan.md](plan.md), [research.md](research.md), [data-model.md](data-model.md), [inventory.openapi.yaml](contracts/inventory.openapi.yaml).

**Estado de ejecución local**: marcar únicamente tareas verificadas; la aprobación del plan no acredita pruebas F02. Solo usar base aislada y datos ficticios; GLO-01 y BOOT-01 siguen cerrados. T040 se verificó en la imagen Linux oficial y T044 recibió revisión humana global el 2026-11-12.

**Tests**: obligatorios por F02-FR-019 y los siete F02-SC; escribirlos antes de los casos de uso correspondientes. La suite Playwright se conserva para entorno oficialmente compatible.

**Organization**: Setup, Foundational y cuatro historias P1, luego controles transversales. `[P]` indica archivos independientes y ninguna dependencia incompleta.

## Phase 1: Setup

- [X] T001 Auditar el árbol, licencia, versiones y alertas de `csv-parse` y `@excel.js/exceljs` con Node 24.17.0/Windows 10, registrar decisión y detener XLSX si no hay opción segura en `specs/003-f02-catalogo-inventario/research.md`. [F02-FR-011, F02-FR-019]
- [X] T002 Tras T001, fijar solo dependencias aprobadas en `backend/package.json` y `package-lock.json`, comprobar instalación, parseo benigno/malformado y `npm audit` sin `--force`. [F02-FR-011, F02-FR-019]
- [X] T003 [P] Preparar módulos F02 con `domain`, `application`, `infrastructure` y `presentation` en `backend/src/modules/medicamentos/README.md` y `backend/src/modules/inventario/README.md`, preservando Farmacias/Usuarios/Notificaciones. [F02-FR-001, F02-FR-020]
- [X] T004 [P] Definir nombres de capacidades `inventory.read`, `inventory.write`, `inventory.import.preview`, `inventory.import.confirm`, `inventory.history` y matriz dueño/admin con permiso explícito, trabajador denegado, sin ruta otorgante, en `specs/003-f02-catalogo-inventario/authorization-matrix.md`. [F02-FR-004–006, F02-FR-017]
- [X] T005 Revisar el contrato F01 de cookie (`ff_session`) contra runtime (`ff-session-local`/`__Host-ff-session`) y registrar ajuste mínimo autorizado para F02 en `specs/003-f02-catalogo-inventario/contracts/inventory.openapi.yaml`, sin duplicar sesión. [F02-FR-017]

## Phase 2: Foundational — bloquea historias

- [X] T006 Tras T003/T004, definir pruebas de permisos por acción, actor ajeno y membresía revocada en `backend/tests/inventory/authorization.test.ts`; deben fallar antes de implementación. [F02-FR-004, F02-FR-005, F02-FR-006, F02-FR-007, F02-FR-019, F02-SC-004]
- [X] T007 Tras T004, crear migración F02 de roles/grants mínimos, función SQL de autorización ligada a sesión/membresía/capacidad y política sin bypass en `backend/migrations/f02/001_permissions.sql`; no otorgar catálogo global ni BOOT-01. [F02-FR-002, F02-FR-004–007]
- [X] T008 Tras T007, exponer puerto F02 que reutilice la sesión y transacción tenant F01, sin leer `farmacia_id` como autoridad, en `backend/src/modules/inventario/application/authorized-context.ts` y adaptador en `backend/src/modules/inventario/infrastructure/tenant-unit-of-work.ts`. [F02-FR-004–007, F02-FR-017]
- [X] T009 Tras T007/T008, crear fixture FIX-01 exclusivo de base nueva de prueba, con dos farmacias, responsables ficticios y capacidades F02, sin tocar `farmafind_f01_test`, en `scripts/f02/fixture.mjs`. [F02-FR-017, F02-FR-019]
- [X] T010 Tras T007–T009, ejecutar prueba PostgreSQL real de `NOSUPERUSER`, `NOBYPASSRLS`, contexto ausente, sesión falsa, A/B y pool reutilizado en `backend/tests/inventory/rls-foundation.test.ts`; no avanzar si alguna denegación falla. [F02-FR-006–007, F02-SC-004]

## Phase 3: User Story 1 — Catálogo común (P1)

**Goal**: referencias normalizadas distinguibles, lectura interna y cero mutación global operativa.

**Independent Test**: dos presentaciones distintas se consultan sin mezcla; referencia ambigua/inexistente no puede asociarse; rol sin permiso global no cambia catálogo.

- [X] T011 [US1] Escribir pruebas de normalización, unicidad y referencia ambigua en `backend/tests/inventory/catalog-domain.test.ts`. [F02-FR-001–002, F02-SC-001]
- [X] T012 [US1] Crear dominio de referencia con nombre, concentración, presentación y clasificación obligatorios, combinación normalizada única y estado en `backend/src/modules/medicamentos/domain/medicamento.ts`. [F02-FR-001, F02-SC-001]
- [X] T013 [US1] Crear migración de catálogo común de lectura y unicidad sin permiso de mutación runtime en `backend/migrations/f02/002_catalog.sql`. [F02-FR-001–002]
- [X] T014 [US1] Implementar consulta paginada de referencias mediante puerto/SQL y ruta interna del contrato en `backend/src/modules/medicamentos/application/list-catalog.ts`, `backend/src/modules/medicamentos/infrastructure/catalog-repository.ts` y `backend/src/modules/medicamentos/presentation/catalog-router.ts`. [F02-FR-001–002, F02-FR-018]
- [X] T015 [US1] Probar contrato HTTP, ausencia de mutación global y distinción de presentaciones con PostgreSQL ficticio en `backend/tests/inventory/catalog-api.test.ts`; registrar resultado real. [F02-FR-001–002, F02-FR-019, F02-SC-001]

## Phase 4: User Story 2 — Revisión manual (P1)

**Goal**: precio/cantidad propios, fecha veraz y movimiento atómico.

**Independent Test**: actor Alfa autorizado corrige artículo; trabajador y Beta son denegados; lectura no altera fecha y cantidad bajo compromiso se rechaza.

- [X] T016 [US2] Escribir pruebas de cantidad física ≥ comprometida ≥ 0, precio no negativo y fecha solo por revisión efectiva en `backend/tests/inventory/inventory-domain.test.ts`. [F02-FR-003, F02-FR-008–010, F02-SC-002, F02-SC-005–006]
- [X] T017 [US2] Crear dominio de inventario y movimiento inmutable con validación antes/después, motivo, responsable y fecha en `backend/src/modules/inventario/domain/inventario.ts` y `backend/src/modules/inventario/domain/movimiento.ts`. [F02-FR-003, F02-FR-008, F02-FR-009, F02-FR-010]
- [X] T018 [US2] Crear migración de inventario/movimientos con `farmacia_id`, unique(farmacia_id,medicamento_id), FK compuestas, checks, RLS `ENABLE`/`FORCE`, `USING`/`WITH CHECK` por acción e índices en `backend/migrations/f02/003_inventory.sql`. [F02-FR-003, F02-FR-006–009]
- [X] T019 [US2] Implementar lectura y cambio manual con bloqueo de fila, revalidación de permisos y escritura conjunta de inventario/movimiento en `backend/src/modules/inventario/application/manual-review.ts` y `backend/src/modules/inventario/infrastructure/inventory-repository.ts`. [F02-FR-004–010]
- [X] T020 [US2] Exponer GET/PUT privados y GET de movimientos con cookie/CSRF F01, validación y errores minimizados en `backend/src/modules/inventario/presentation/inventory-router.ts`; registrar ruta fija antes de `{medicamentoId}`. [F02-FR-004–010, F02-FR-018]
- [X] T021 [US2] Probar API/SQL real A/B, trabajador sin permiso, sin contexto, valor inválido, compromisos, movimiento atómico y fecha invariable en `backend/tests/inventory/manual-review.rls.test.ts`. [F02-FR-006–010, F02-FR-019, F02-SC-002, F02-SC-004–006]
- [X] T022 [US2] Añadir vista React mínima en español de catálogo, inventario propio y cambio manual sin otorgar permisos en cliente en `frontend/src/inventory/InventoryView.jsx` y cliente en `frontend/src/inventory/inventory-client.js`. [F02-FR-018, F02-SC-007]

## Phase 5: User Story 3 — Vista previa de .csv/.xlsx (P1)

**Goal**: mapear, validar y conciliar sin escribir inventario.

**Independent Test**: archivos ficticios .csv/.xlsx muestran filas y errores; una referencia ambigua o farmacia ajena no modifica stock.

- [X] T023 [US3] Escribir pruebas de formato, encabezados, mapeo, duplicados, rangos, ambigüedad, archivo ajeno y cero escrituras en `backend/tests/inventory/import-preview.test.ts`. [F02-FR-011, F02-FR-012, F02-FR-019, F02-SC-003]
- [X] T024 [US3] Crear dominio de fila normalizada/conciliación y estados de vista previa con errores por fila en `backend/src/modules/inventario/domain/importacion.ts`. [F02-FR-011–012]
- [X] T025 [US3] Tras T002, implementar adaptadores acotados de CSV y XLSX sin evaluar fórmulas/vínculos y con límites propuestos 5 MiB/5 000 filas en `backend/src/modules/inventario/infrastructure/file-parser.ts`. [F02-FR-011–012, F02-FR-016]
- [X] T026 [US3] Crear migración de importación/filas de vista previa tenant-scoped, digest, actor, estados e incidencias mínimas con RLS `ENABLE`/`FORCE` en `backend/migrations/f02/004_imports.sql`. [F02-FR-007, F02-FR-011–012, F02-FR-015–016]
- [X] T027 [US3] Implementar vista previa ligada a actor/farmacia, caducidad de 30 minutos, archivo descartado tras parsear y cero stock escrito en `backend/src/modules/inventario/application/preview-import.ts` y `backend/src/modules/inventario/infrastructure/import-repository.ts`. [F02-FR-011–012, F02-FR-014–016]
- [X] T028 [US3] Exponer POST de vista previa con CSRF, límites y errores minimizados en `backend/src/modules/inventario/presentation/import-router.ts`. [F02-FR-011–012, F02-FR-016, F02-FR-018]
- [X] T029 [US3] Probar HTTP/PostgreSQL de vista previa sin escrituras, A/B, revocación y archivos malformados en `backend/tests/inventory/import-preview.rls.test.ts`. [F02-FR-006–007, F02-FR-011–012, F02-FR-019, F02-SC-003–004]
- [X] T030 [US3] Añadir formulario React de archivo, mapeo, vista previa y errores en español en `frontend/src/inventory/ImportPreview.jsx`. [F02-FR-018, F02-SC-007]

## Phase 6: User Story 4 — Confirmación atómica e historial (P1)

**Goal**: todas las filas válidas aplican una vez o ninguna; historial propio y auditable.

**Independent Test**: un archivo válido de Alfa confirma todo; otro con una fila inválida o conflicto confirma cero; Beta no ve importación de Alfa.

- [X] T031 [US4] Escribir pruebas de expiración, reintento idempotente, concurrencia, rollback total y consulta ajena en `backend/tests/inventory/import-confirm.test.ts`. [F02-FR-013–015, F02-FR-019, F02-SC-003–005]
- [X] T032 [US4] Implementar confirmación con revalidación de sesión/membresía/capacidad, bloqueo ordenado, comparación de compromisos y una transacción para inventario, movimientos y estado en `backend/src/modules/inventario/application/confirm-import.ts`. [F02-FR-008–009, F02-FR-013–014]
- [X] T033 [US4] Completar repositorio de importaciones para transición única a CONFIRMADA o rechazo/expiración, consulta propia e incidencias sin archivo bruto en `backend/src/modules/inventario/infrastructure/import-repository.ts`. [F02-FR-013–016]
- [X] T034 [US4] Exponer POST confirmar y GET historial/estado en `backend/src/modules/inventario/presentation/import-router.ts`, con 401/404/409 y sin diferencias que revelen Beta. [F02-FR-013–015, F02-FR-018]
- [X] T035 [US4] Probar PostgreSQL RLS y API con A/B, rollback ante fila inválida o conflicto, concurrencia y ausencia de movimientos duplicados en `backend/tests/inventory/import-confirm.rls.test.ts`. [F02-FR-006–007, F02-FR-013–015, F02-FR-019, F02-SC-003–005]
- [X] T036 [US4] Añadir confirmación e historial React en español, mostrando resultado y errores sin datos ajenos, en `frontend/src/inventory/ImportHistory.jsx` e integrar en `frontend/src/inventory/InventoryView.jsx`. [F02-FR-015, F02-FR-018, F02-SC-007]

## Phase 7: Polish & cross-cutting

- [X] T037 Componer routers F02 sobre API F01 sin romper `/health`, identidad ni selector y activar ruta UI propia sin alterar Bootstrap F00 en `backend/src/identity-app.ts` y `frontend/src/main.jsx`. [F02-FR-017–018, F02-FR-020]
- [X] T038 [P] Crear pruebas de interacción React para consulta, cambio, vista previa, error y confirmación en `frontend/tests/inventory/inventory-view.test.jsx`. [F02-FR-018–019, F02-SC-007]
- [X] T039 Ejecutar `check`, `build`, unitarias, API, PostgreSQL RLS, archivos, suite base y `npm audit`; corregir fallos dentro del plan y registrar comandos/versiones/resultados en `specs/003-f02-catalogo-inventario/implementation-evidence.md`. [F02-FR-019, F02-SC-001–007]
- [X] T040 Preparar suite Playwright F02 de cambio manual, importación, rollback y A/B en `frontend/tests/inventory/f02.spec.js`; ejecutarla solo en entorno oficialmente compatible y mantener pendiente si no está disponible. [F02-FR-019, F02-SC-003–004, F02-SC-007]
- [X] T041 Verificar base persistente F01 intacta, fixture aislado, exclusión de `.env*`, `.cache`, archivos y secretos; registrar evidencia en `specs/003-f02-catalogo-inventario/implementation-evidence.md`. [F02-FR-016–017, F02-FR-020]
- [X] T042 Trazar F02-FR-001–020, cuatro historias y F02-SC-001–007 a pruebas reales y 16 criterios sin puntajes inventados en `specs/003-f02-catalogo-inventario/evidence-traceability.md`. [F02-FR-019, F02-SC-001–007]
- [X] T043 Revisar `specs/003-f02-catalogo-inventario/quickstart.md` contra comandos realmente implementados, distinguir local/overall/acceptance y pendientes Playwright/BOOT-01/GLO-01. [F02-FR-019–020]
- [X] T044 Preparar revisión humana final sin declarar F02 aceptada si falta algún SC o permiso real, en `specs/003-f02-catalogo-inventario/implementation-evidence.md`. [F02-SC-001–007]

## Dependencies & Execution Order

Setup T001–T005 → fundamento T006–T010 → US1 T011–T015 → US2 T016–T022 → US3 T023–T030 → US4 T031–T036 → integración y evidencia T037–T044. T002 requiere auditoría satisfactoria de T001. T007 requiere matriz T004; T009 requiere infraestructura T007/T008. T010 y pruebas RLS reales son puertas obligatorias antes de cualquier operación F02 privilegiada. T025 requiere T002. T032 requiere T027 y T031; T037 requiere rutas de US1–US4. Si PostgreSQL o parser no están disponibles/son inseguros, solo continúan trabajos independientes; nunca se marca la tarea bloqueada como hecha.

### Parallel Opportunities

T003/T004 pueden prepararse simultáneamente. Después de fundamentos, pruebas de dominio/contrato de historias distintas pueden redactarse en archivos separados, pero la integración sigue el orden US1→US4. No paralelizar migraciones ni ediciones de los mismos repositorios/routers. T038 puede ejecutarse independientemente de evidencias documentales tras existir UI.

### Independent Test Criteria

- US1: referencias normalizadas distintas y catálogo sin mutación global.
- US2: cambio manual propio, movimiento único, fecha veraz y denegación ajena.
- US3: vista previa .csv/.xlsx mapeada con errores y cero stock escrito.
- US4: archivo válido completo una vez; inválido o concurrente revierte todo; historial aislado.

## Implementation Strategy

El MVP técnico comienza con fundamentos y US1; después se valida cada historia antes de la siguiente. El alcance funcional aprobado exige US1–US4, pero F02 no se declara aceptada hasta completar pruebas obligatorias y revisión humana. No hay commits ni despliegues automáticos implícitos en estas tareas.
