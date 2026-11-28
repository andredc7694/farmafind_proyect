# Tasks: F02.2 (casilla solo con evidencia real en evidence.md)

**Estado**: **pendientes de aprobación de Andre** (junto con el plan y el SQL). Sustituyen las 22 tareas del 2026-11-25; la T001 de entonces (enmienda F02.1 en `main`) sigue cumplida.
**Orden**: preparación → datos y seguridad → identidad → reimportación → proponer → revisar → mostrar → cierre. Un commit por lote probado.

## Preparación
- [X] T001 Enmienda F02.1 en `main` y línea base (cumplida el 2026-11-26; ver `evidence.md`).
- [ ] T002 Contratos: catálogo 0.2.0 (`contracts/catalog.openapi.yaml`: propuestas, revisión con filtros y conteos, muestra, decisiones), búsqueda 0.4.0 y conversación 2.1.0; verificación de rutas (FR-008, FR-012).

## Datos y seguridad (bloquean el resto)
- [ ] T003 Copiar el SQL aprobado a `backend/migrations` (copia literal con hashes iguales), agregar hashes a `F03_APPROVED`/`F07_APPROVED` y la verificación de hashes de F02 007/008; ejecutarlo en una base efímera. Si hubiera que corregirlo: detenerse y presentar hashes nuevos (FR-002, FR-014).
- [ ] T004 Pruebas de migración en base efímera con datos sintéticos (productos, inventarios, movimientos, reservas, importaciones): conteos y claves iguales; la unicidad nueva admite el mismo producto con distinto laboratorio (FR-002, SC-003).
- [ ] T005 **Permiso de Andre** para un `pg_dump` de solo lectura de la DEMO; `scripts/f022/verify-migration-copy.mjs`: restaurar en base efímera marcada, aplicar 007/008/004/011, comparar conteos y claves antes y después, borrar la base (condición de Andre; SC-003).
- [ ] T006 Matriz RLS Alfa/Beta con conexión reutilizada: propuestas, revisor sin inventario, revisor miembro denegado, sin segundo factor denegado, revocación inmediata, escritura directa del catálogo denegada, concurrencia al aprobar, y **D-09 sin datos privados de otra farmacia** (FR-010, FR-011, SC-002).
- [ ] T007 `scripts/f022/grant-catalog-reviewer.mjs` (offline, solo base TEST marcada) y su prueba (FR-010).

## US1 — Identidad y forma
- [ ] T008 Identidad nueva (`catalogKey` con forma, laboratorio y marca) y repositorios; formas en `medicamentos/contracts/dosage-form.ts` y el asistente importándolas de ahí; unitarias (FR-001, FR-005, FR-006).
- [ ] T009 Detector: columnas opcionales `codigo`, `laboratorio`, `marca`/`nombre_comercial`, `forma_farmaceutica`, `principio_activo`/`nombre_generico`; empate preguntado (FR-004).
- [ ] T010 Duplicado real por identidad o código con fila repetida y causa; forma por columna, deducción o «sin forma» con aviso; filas sin laboratorio solo con productos sin laboratorio (FR-003, FR-005, FR-006, SC-001).

## US2 — Reimportar sin perder ni duplicar
- [ ] T011 Reemplazo D-08 dentro de `ConfirmImport`: solo filas que entran, misma transacción, bloqueo en orden de id, 0 unidades con movimiento, reservas abiertas → no se reemplaza y se informa; anuncio en la vista previa (FR-007).
- [ ] T012 Pruebas de D-08: fallo a mitad (cero cambios), concurrencia con reserva y con otra confirmación, lector concurrente sin hueco, reservas abiertas (condición de Andre; FR-007, SC-004).

## US3 — Proponer
- [ ] T013 Casos de uso y rutas: proponer los pendientes de una vista previa (lotes de hasta 1000, principio activo obligatorio, forma por grupo) y consultar «Mis propuestas» (FR-012).
- [ ] T014 Interfaz «Proponer los pendientes» y «Mis propuestas», agrupada, paginada y accesible (FR-012).

## US4 — Revisar por lotes
- [ ] T015 Casos de uso y rutas del revisor: lista con filtros (farmacia, laboratorio, forma, aviso, texto), conteos y «quedan N»; revisión con muestra; decisiones individuales y en lote; resultado agrupado (FR-011).
- [ ] T016 Interfaz `/admin/catalogo/propuestas`: contadores, filtros, selección de página o de lo filtrado, muestra visible con Correcta/Incorrecta, Aprobar/Vincular/Rechazar selección, filas con aviso una a una; accesible en claro y oscuro (condición de Andre).

## US5 — Mostrar y asistente
- [ ] T017 Búsqueda con `search_public_offers_identity`, DTO con laboratorio, marca y forma, caché v3, sugerencias con marca (FR-008).
- [ ] T018 Comparables, reservas, historial/CSV e inventario con laboratorio y marca; `load-demo-catalog.mjs` con la unicidad nueva (FR-008).
- [ ] T019 Asistente: forma del catálogo para agrupar y alternativas (si vacía, deducción F06.2); tarjetas con laboratorio y marca; prueba «caja x 30» con forma en el catálogo (FR-009, SC-005).

## Cierre
- [ ] T020 E2E en la copia temporal 3001/5174 (`start-copy.mjs`): importar → proponer → revisar muestra → aprobar en lote → reimportar con reemplazo → buscar → asistente; Beta no ve nada; axe, celular, 0 llamadas externas (SC-001, SC-004, SC-005).
- [ ] T021 Regresión completa con resultados reales (F01–F08, F02.1, F03.1/F03.2, F06.2, F07.1/F07.2, contratos, `check`, build, frontend) (FR-013).
- [ ] T022 Revisión de seguridad de las migraciones y del reemplazo; `evidence.md`, `convergence.md`, `traceability.md`, `ESTADO.md` (FR-010, FR-014).
- [ ] T023 Aceptación de Andre en `acceptance.md` (**solo Andre decide**). Después: PR y merge; DEMO con copia de seguridad previa, reinicio por Andre, foto en solo lectura y, con su aprobación aparte, permiso de revisor de catálogo.
