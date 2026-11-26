# Tasks: F02.1 — Importación inteligente

**Input**: [spec.md](spec.md), [plan.md](plan.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/importacion-f021.md](contracts/importacion-f021.md).
**Estado**: plan aprobado expresamente el 2026-11-22; ejecutar y marcar solo tareas verificadas. Mantener F02.5 suspendida, no aceptada.

## Phase 1: Setup (alcance y contrato)

- [X] T001 Registrar aprobación humana del plan F02.1 y su revisión exacta en `specs/013-f021-importacion-inteligente/approval.md`; bloquear T002–T038 mientras falte.
- [X] T002 Revisar muestras CSV/XLSX ficticias y la compatibilidad con F02 en `specs/013-f021-importacion-inteligente/research.md` (F021-FR-001–004); no usar inventarios reales.
- [X] T003 Formalizar la extensión compatible de las rutas de importación en `specs/013-f021-importacion-inteligente/contracts/importacion-f021.md` y el OpenAPI F02 aplicable antes de implementar (F021-FR-014).

## Phase 2: Foundation (seguridad y migración)

- [X] T004 [P] Crear pruebas de límites CSV/XLSX y contenido no permitido en `backend/tests/inventory/f021-file-analysis.test.ts` (F021-FR-001–004; SC-001).
- [X] T005 [P] Diseñar migración aditiva de `f02.perfil_importacion`, `f02.importacion_incidencia` y metadatos de hoja/fila/huella en `f02.importacion`, con FKs, unicidad por farmacia y FORCE RLS, en `backend/migrations/f02/005_smart_import.sql` (FR-006–007/013); revisión SQL antes de ejecutar.
- [X] T006 Verificar T005 solo en PostgreSQL TEST efímero con rol runtime sin BYPASSRLS y pruebas Alfa/Beta en `backend/tests/inventory/f021-rls.test.ts`; bloquear rutas de perfiles hasta pasar (FR-007/013; SC-005).

## Phase 3: User Story 1 — Preparar archivos heterogéneos (P1)

**Independent Test**: XLSX mult hoja, encabezado desplazado y CSV con sinónimos producen propuesta corregible y cero escrituras de inventario.

- [X] T007 [P] [US1] Escribir pruebas de hojas, encabezados desplazados, ambigüedad y huella en `backend/tests/inventory/f021-file-analysis.test.ts` (FR-001–002; SC-001).
- [X] T008 [P] [US1] Escribir pruebas de sinónimos/mapeo sin equivalencias clínicas implícitas en `backend/tests/inventory/f021-mapping.test.ts` (FR-003–004/008; SC-001/003).
- [X] T009 [US1] Extender lectura acotada de todas las hojas y filas candidatas conservando líneas físicas CSV/XLSX, sin evaluar fórmulas, en `backend/src/modules/inventario/infrastructure/file-parser.ts` (FR-001, FR-002, FR-006); depende de T004/T007.
- [X] T010 [US1] Incorporar detector determinista, diccionario versionado y resolución explícita de empates en `backend/src/modules/inventario/domain/importacion.ts` (FR-003–004/008); depende de T008/T009.
- [X] T011 [US1] Añadir caso de uso de inspección sin persistencia en `backend/src/modules/inventario/application/inspect-import.ts` y puerto en `backend/src/modules/inventario/application/ports.ts` (FR-001–005, FR-009); depende de T010.
- [X] T012 [US1] Exponer análisis con cookie/CSRF/permiso y selección opcional compatible de preview en `backend/src/modules/inventario/presentation/import-router.ts` (FR-004/010/014); depende de T011.
- [X] T013 [US1] Mostrar hoja, encabezado, sugerencias y correcciones accesibles en `frontend/src/inventory/ImportPreview.jsx` y `frontend/src/inventory/inventory-client.js` (FR-001–005); depende de T012.
- [X] T014 [US1] Verificar contrato y resultado HTTP de análisis, preview cancelada y F02 legado en la suite de integración existente `backend/tests/inventory/rls-foundation.test.ts` y pruebas F02 (FR-005/009/014; SC-001).

## Phase 4: User Story 2 — Errores precisos (P1)

**Independent Test**: precio/cantidad vacíos generan dos incidencias localizables sin escritura de stock.

- [X] T015 [P] [US2] Escribir pruebas de múltiples incidencias, fila/columna real, duplicados y mensajes sin PII en `backend/tests/inventory/f021-incidents.test.ts` (FR-006; SC-002).
- [X] T016 [US2] Modelar incidencias separadas sin perder `errorCode` legado en `backend/src/modules/inventario/domain/importacion.ts` (FR-006/014); depende de T015.
- [X] T017 [US2] Persistir y recuperar incidencias minimizadas bajo farmacia/RLS en `backend/src/modules/inventario/infrastructure/import-repository.ts` (FR-006/013); depende de T005/T006/T016.
- [X] T018 [US2] Extender respuesta de preview y status con incidencias y códigos seguros en `backend/src/modules/inventario/application/preview-import.ts`, `backend/src/modules/inventario/application/confirm-import.ts` y `backend/src/modules/inventario/presentation/import-router.ts` (FR-006/014); depende de T017.
- [X] T019 [US2] Renderizar título, fila, campo, causa y acción con navegación accesible en `frontend/src/inventory/ImportPreview.jsx` (FR-006); depende de T018.
- [X] T020 [US2] Verificar caso DEMO precio/cantidad vacíos y respuesta HTTP sin trazas en `backend/tests/inventory/rls-foundation.test.ts`, `frontend/tests/f021-import-errors.test.jsx` y E2E F02.1 (FR-006; SC-002); depende de T019.

## Phase 5: User Story 4 — Confirmar íntegramente (P1)

**Independent Test**: archivo válido confirma todo; archivo inválido, revocación o conflicto confirma cero filas y no rompe F04.

- [X] T021 [P] [US4] Escribir pruebas de archivo inválido, revocación, reintento y concurrencia en `backend/tests/inventory/f021-confirm.test.ts` (FR-010–011; SC-004).
- [X] T022 [P] [US4] Verificar PostgreSQL de stock comprometido/reserva F04 y rollback reutilizando `backend/tests/inventory/rls-foundation.test.ts` y `scripts/f025/check-f04-rls.mjs` (FR-011/014; SC-007); sin duplicar suites existentes.
- [X] T023 [US4] Revalidar cero incidencias, digest, permisos, catálogo y compromisos actuales en `backend/src/modules/inventario/application/confirm-import.ts` (FR-008/010–011); depende de T018/T021.
- [X] T024 [US4] Mantener bloqueos y transacción F02, movimientos únicos e invalidación F03 posterior al commit en `backend/src/modules/inventario/infrastructure/tenant-unit-of-work.ts` y `backend/src/modules/inventario/application/confirm-import.ts` (FR-011, FR-012); depende de T023.
- [X] T025 [US4] Verificar HTTP de confirmación idempotente y Alfa/Beta manipulado en `backend/tests/inventory/rls-foundation.test.ts` (FR-010–013; SC-004/005); depende de T024.
- [X] T026 [US4] Ejecutar regresión TEST de F02, F03 Redis/fallback y F04 reservas/concurrencia en `specs/013-f021-importacion-inteligente/evidence.md` con comandos/resultados reales (FR-011–014; SC-007); depende de T022/T025.

## Phase 6: User Story 3 — Perfil por farmacia (P2)

**Independent Test**: Alfa reutiliza perfil compatible; Beta recibe denegación; cambios de formato obligan revisión.

- [X] T027 [P] [US3] Escribir pruebas de compatibilidad de encabezados, versión y aislamiento del perfil en `backend/tests/inventory/f021-profile.test.ts` (FR-007/013; SC-005).
- [X] T028 [US3] Implementar entidad/validación del perfil sin valores de archivo ni PII en `backend/src/modules/inventario/domain/importacion.ts` (FR-007); depende de T027.
- [X] T029 [US3] Implementar repositorio con farmacia, actor, RLS y versión en `backend/src/modules/inventario/infrastructure/import-repository.ts` (FR-007/013); depende de T006/T028.
- [X] T030 [US3] Exponer listado con `inventory.import.preview` y guardado explícito con `inventory.import.confirm` más CSRF en `backend/src/modules/inventario/presentation/import-router.ts` (FR-007/010/013); depende de T029.
- [X] T031 [US3] Añadir guardar/elegir perfil compatible sin aplicarlo a ciegas en `frontend/src/inventory/ImportPreview.jsx` y `frontend/src/inventory/inventory-client.js` (FR-007); depende de T030.
- [X] T032 [US3] Verificar perfiles propios/ajenos y formato incompatible en `backend/tests/inventory/rls-foundation.test.ts`, `backend/tests/inventory/f021-profile.test.ts` y `frontend/tests/f021-import-flow.test.jsx` (FR-007/013; SC-005); depende de T031.

## Phase 7: Polish, seguridad y aceptación

- [X] T033 [P] Completar pruebas E2E de archivo mult hoja, errores precisos, corrección, confirmación y proyección pública en `frontend/e2e/f021-import.spec.js` (SC-001–006, SC-003, SC-006); ejecutar solo en entorno compatible. Tres recorridos parciales ya pasaron en Linux.
- [X] T034 [P] Verificar arquitectura, TypeScript, build y OpenAPI contra contrato F02/F02.1 y registrar resultados en `specs/013-f021-importacion-inteligente/evidence.md` (FR-014).
- [X] T035 Ejecutar matriz PostgreSQL RLS Alfa/Beta, pool reutilizado y roles directos en TEST efímero; registrar evidencia en `specs/013-f021-importacion-inteligente/evidence.md` (FR-013; SC-005); depende de T026/T032.
- [X] T036 Ejecutar recorrido de navegador y archivos ficticios, registrar resultados/omisiones sin alterar base persistente en `specs/013-f021-importacion-inteligente/evidence.md` (SC-001–006); depende de T033/T035.
- [X] T037 Actualizar trazabilidad MEJ-001/HU11/RF22–24/AC13 y cobertura parcial MEJ-002/HU12/RF25/AC12–13, más 16 criterios docentes, en `specs/013-f021-importacion-inteligente/traceability.md` con evidencias reales (FR-001–014; SC-001–007); depende de T034–T036.
- [X] T038 Solicitar aceptación humana F02.1 y registrar decisión y pendientes MEJ-002 en `specs/013-f021-importacion-inteligente/acceptance.md`; nunca autoaprobar; depende de T037.

## Dependencies and parallel work

T001 es puerta SDD. T002/T003 preceden cambios de contrato; T004/T005 pueden prepararse en archivos distintos, pero T006 bloquea persistencia de incidencias/perfiles. US1: T007/T008 paralelos tras fundamento, luego T009–T014. US2: T015 puede paralelizar con US1; T016–T020 dependen del parser/preview y SQL. US4 depende de US2 para validar múltiples incidencias; T021/T022 pueden prepararse en paralelo. US3 depende de T006 y del análisis US1; su backend y UI siguen orden secuencial. T033/T034 son paralelos solo después de funcionalidades necesarias; T035–T038 cierran en orden.

**MVP sugerido**: US1 + US2 + US4 con pruebas de aislamiento y confirmación; US3 completa el perfil sin reducir criterios de aceptación finales. Ninguna casilla se marca sin prueba y evidencia; la aceptación humana T038 permanece separada.

## Phase 8: Enmienda 2026-11-25 (importación en un paso)
- [X] T039 Detector determinista por nombre y contenido en `backend/src/modules/inventario/domain/column-detector.ts` (FR-017)
- [X] T040 Lectura tolerante de celdas no textuales en la hoja elegida e incidencias por celda; análisis que ignora hojas sin inventario en `file-parser.ts`, `inspect-import.ts`, `importacion.ts` (FR-018)
- [X] T041 Mensajes específicos del lector y del cliente; vista previa repetible al reajustar (FR-020) en `preview-import.ts`, `import-router.ts`, `inventory-client.js`
- [X] T042 Interfaz en un paso con «Ajustar columnas», preguntas puntuales y estado «Pendiente de catálogo» en `ImportPreview.jsx` (FR-016, FR-019)
- [X] T043 Pruebas: archivo realista (3 hojas, 48 filas), encabezados inventados, empate, celda con fórmula, error específico, sin botón «Analizar» y recorridos de navegador F02/F02.1 (SC-008)
- [ ] T044 Repetición de T046 por Andre en la DEMO (verificación humana; no marcar por Claude)
- [X] T045 Resumen, filtros, paginación y avisos agrupados con «Ver detalle» en `PreviewResults.jsx`; causa del duplicado con la fila repetida (FR-021); prueba con 600 filas
- [X] T047 Script solo TEST `scripts/f025/load-demo-catalog.mjs` y comprobación de confirmación completa (517 filas) en la base técnica
- [X] T048 Lecturas con nombre del producto, autor, conteos y cambios por importación, sin migraciones ni permisos nuevos (FR-022, FR-024, FR-025)
- [X] T049 Inventario en tabla de solo lectura con búsqueda, filtros, paginación, detalle y revisión manual secundaria (FR-022)
- [X] T050 Importar solo con archivo, vista previa y confirmar (FR-023)
- [X] T051 Historial: tarjetas de importación, vistas previas agrupadas, detalle y movimientos legibles en la pestaña Historial (FR-024, FR-025)
- [X] T052 Aislamiento Alfa/Beta de las nuevas lecturas, regresión y recorrido en navegador con el inventario importado desde el archivo ficticio
- [X] T053 Confirmación con exclusión explícita: regla de dominio, servicio, cuerpo opcional en la ruta de confirmación y contrato (FR-026, FR-027, FR-029)
- [X] T054 Botón y confirmación con números exactos en la vista previa (FR-026)
- [X] T055 Historial con conteos, búsqueda en el detalle y filas excluidas (FR-028)
- [X] T056 Pruebas: exclusión, bloqueo por errores, cancelación, historial, Alfa/Beta, regresión y recorrido con el archivo ficticio original
