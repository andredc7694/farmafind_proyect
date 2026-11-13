# Tasks: F04 — Reservas y concurrencia

**Input**: [spec.md](spec.md), [plan.md](plan.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/](contracts/) y [quickstart.md](quickstart.md).

**Status**: 64/65 tareas verificadas localmente. T059 y la aceptación definitiva permanecen pendientes de Playwright en Linux compatible y revisión humana.

**Tests**: obligatorios por F04-FR-023/024 y Constitution XIII. TDD: cada bloque de pruebas debe fallar por ausencia de implementación antes de escribir el código correspondiente.

## Phase 1: Setup

- [x] T001 Registrar alcance, F04-TIME-01, gates F05/GLO-01/BOOT-01 y prerrequisitos en specs/005-f04-reservas/implementation-evidence.md
- [x] T002 Crear esqueleto Clean Architecture del módulo sin lógica en backend/src/modules/reservas/README.md
- [x] T003 [P] Añadir configuración segura F04: respuesta PENDIENTE 20 minutos y límites de idempotencia en backend/src/config/reservations.ts
- [x] T004 [P] Preparar ejecutor de migraciones limitado a BD TEST loopback y rol no runtime en backend/src/modules/reservas/infrastructure/migrate.ts
- [x] T005 [P] Preparar comandos F04 sin secretos en scripts/f04/check.mjs y scripts/f04/check-project.mjs
- [x] T006 Añadir scripts F04 previstos a package.json sin alterar los scripts F00–F03

## Phase 2: Foundational

- [x] T007 Escribir pruebas de migración vacía/repetida/rollback, CHECK 1–8, FK tenant y roles sin SUPERUSER/BYPASSRLS en backend/tests/reservations/migrations.test.ts
- [x] T008 Crear tablas configuración/reserva/transición/idempotencia/incidencia/outbox con default 4 y vencimiento inmutable en backend/migrations/f04/001_reservations.sql
- [x] T009 Crear capacidades reservation.read/accept/deliver/settings y verificación de sesión, membresía, farmacia y delegación en backend/migrations/f04/002_authorization.sql
- [x] T010 Crear políticas ENABLE/FORCE RLS de propietario y tenant, grants mínimos y worker de expiración NOLOGIN en backend/migrations/f04/003_rls.sql
- [x] T011 Crear restricciones e índices para estado, expiración, idempotencia, outbox y coherencia farmacia/inventario en backend/migrations/f04/004_constraints_indexes.sql
- [x] T012 [P] Escribir pruebas unitarias de estados exactos y terminales en backend/tests/reservations/reservation-domain.test.ts
- [x] T013 [P] Escribir pruebas unitarias de configuración entera 1–8, default 4 y snapshot de vencimiento en backend/tests/reservations/pickup-window.test.ts
- [x] T014 Implementar entidad, transiciones y efectos únicos sin dependencias externas en backend/src/modules/reservas/domain/reservation.ts
- [x] T015 Implementar regla F04-TIME-01 y reloj inyectable en backend/src/modules/reservas/domain/pickup-window.ts
- [x] T016 Definir puertos de repositorio, UoW, inventario, configuración, idempotencia, Outbox e incidencias en backend/src/modules/reservas/application/ports.ts
- [x] T017 Implementar UoW F04 sobre el cliente F01 verificado, contexto local y repositorios compartidos en backend/src/modules/reservas/infrastructure/reservation-unit-of-work.ts
- [x] T018 Ejecutar tests fundacionales y registrar fallos/correcciones reales en specs/005-f04-reservas/implementation-evidence.md

## Phase 3: User Story 1 — Solicitar una reserva

**Independent Test**: cliente autenticado crea una PENDIENTE; sin disponibilidad o reintento conflictivo no deja efectos parciales; AC05 crea exactamente 10/100.

- [x] T019 [P] [US1] Escribir pruebas de dominio para cantidad positiva, disponibilidad e idempotencia de creación en backend/tests/reservations/create-reservation.test.ts
- [x] T020 [P] [US1] Escribir contrato HTTP POST /api/v1/reservas con 201/200/401/409/422 e Idempotency-Key en backend/tests/reservations/customer-reservations.http.test.ts
- [x] T021 [US1] Escribir integración PostgreSQL consolidada de rollback y atomicidad reserva+compromiso+Outbox en backend/tests/reservations/reservations.rls.test.ts
- [x] T022 [US1] Implementar repositorio PostgreSQL con bloqueo de inventario, incremento de compromiso, PENDIENTE, idempotencia y Outbox en backend/src/modules/reservas/infrastructure/reservation-repository.ts
- [x] T023 [US1] Implementar CreateReservation con actor de sesión y plazo PENDIENTE 20 minutos configurable en backend/src/modules/reservas/application/create-reservation.ts
- [x] T024 [US1] Exponer creación validada, CSRF y errores genéricos en backend/src/modules/reservas/presentation/customer-reservations-router.ts
- [x] T025 [US1] Conectar router y UoW a la composición existente sin activar F05 en backend/src/identity-app.ts
- [x] T026 [US1] Crear cliente React de reservas sin almacenar sesión/autoridad en frontend/src/reservations/reservations-client.js
- [x] T027 [US1] Crear formulario mínimo de solicitud con aviso de confirmación física en frontend/src/reservations/CreateReservation.jsx
- [x] T028 [US1] Ejecutar pruebas US1 y registrar resultados sin declarar AC05 hasta T057 en specs/005-f04-reservas/implementation-evidence.md

## Phase 4: User Story 2 — Consultar y cancelar propias

**Independent Test**: dos clientes solo leen/cancelan sus reservas; cancelación vigente libera una vez y estados terminales no cambian.

- [x] T029 [P] [US2] Escribir pruebas HTTP de lista/detalle/cancelación propia, ajena y terminal en backend/tests/reservations/customer-reservations.http.test.ts
- [x] T030 [US2] Escribir pruebas PostgreSQL consolidadas de propiedad, RLS, liberación única y reintentos concurrentes en backend/tests/reservations/reservations.rls.test.ts
- [x] T031 [US2] Implementar listado/detalle por propietario en backend/src/modules/reservas/application/list-own-reservations.ts
- [x] T032 [US2] Implementar cancelación propia idempotente y transaccional en backend/src/modules/reservas/application/cancel-reservation.ts
- [x] T033 [US2] Completar rutas GET y cancelar del contrato en backend/src/modules/reservas/presentation/customer-reservations-router.ts
- [x] T034 [US2] Crear listado, estado, vencimiento exacto y cancelación propia en frontend/src/reservations/OwnReservations.jsx
- [x] T035 [US2] Ejecutar pruebas US2 y registrar propiedad/terminales/liberación única en specs/005-f04-reservas/implementation-evidence.md

## Phase 5: User Story 3 — Confirmar físicamente y configurar plazo

**Independent Test**: actor autorizado de Alfa confirma; sin delegación/Beta se deniega; configuración acepta 1–8, default 4 y no cambia vencimientos previos.

- [x] T036 [P] [US3] Escribir pruebas de autorización reservation.read/accept/settings, rol insuficiente y Alfa/Beta en backend/tests/reservations/pharmacy-authorization.test.ts
- [x] T037 [P] [US3] Escribir pruebas HTTP de listado, confirmar, falta física y configuración 1–8/default 4 en backend/tests/reservations/pharmacy-reservations.http.test.ts
- [x] T038 [US3] Escribir pruebas PostgreSQL RLS consolidadas de delegación, farmacia ajena, pool reutilizado y ausencia de contexto en backend/tests/reservations/reservations.rls.test.ts
- [x] T039 [US3] Implementar configuración por farmacia, permiso settings y snapshot al confirmar en backend/src/modules/reservas/application/manage-pickup-window.ts
- [x] T040 [US3] Implementar listado tenant y confirmación física con accept, bloqueo y vencimiento exacto en backend/src/modules/reservas/application/confirm-reservation.ts
- [x] T041 [US3] Implementar falta física con cancelación, liberación, incidencia, movimiento y Outbox atómicos en backend/src/modules/reservas/application/report-physical-shortage.ts
- [x] T042 [US3] Exponer rutas de farmacia y configuración sin aceptar rol/tenant del cliente como autoridad en backend/src/modules/reservas/presentation/pharmacy-reservations-router.ts
- [x] T043 [US3] Crear panel mínimo de cola, configuración 1–8, confirmación y falta física en frontend/src/reservations/PharmacyReservations.jsx
- [x] T044 [US3] Probar que cambiar 4→8 no altera CONFIRMADAS existentes y registrar evidencia en specs/005-f04-reservas/implementation-evidence.md

## Phase 6: User Story 4 — Registrar entrega

**Independent Test**: solo CONFIRMADA vigente y actor autorizado entregan; físico y comprometido bajan una vez; vencida o reintento no consumen.

- [x] T045 [P] [US4] Escribir pruebas unitarias/HTTP de entrega válida, estado inválido, vencida y autorización en backend/tests/reservations/deliver-reservation.test.ts
- [x] T046 [US4] Escribir pruebas PostgreSQL consolidadas de doble entrega, carrera con expiración y consumo único en backend/tests/reservations/reservations.rls.test.ts
- [x] T047 [US4] Implementar entrega transaccional con capacidad deliver, bloqueo, inventario, historial y Outbox en backend/src/modules/reservas/application/deliver-reservation.ts
- [x] T048 [US4] Añadir ruta entregar al router de farmacia en backend/src/modules/reservas/presentation/pharmacy-reservations-router.ts
- [x] T049 [US4] Añadir acción de entrega y bloqueo visual de vencidas en frontend/src/reservations/PharmacyReservations.jsx
- [x] T050 [US4] Ejecutar pruebas US4 y registrar consumo único y denegaciones en specs/005-f04-reservas/implementation-evidence.md

## Phase 7: User Story 5 — Expirar de forma segura

**Independent Test**: worker mínimo expira PENDIENTE/CONFIRMADA vencidas, ignora vigentes/terminales y compite sin doble efecto.

- [x] T051 [P] [US5] Escribir pruebas de expiración por ambos plazos, lotes, reintento y carreras en backend/tests/reservations/expire-reservations.test.ts
- [x] T052 [US5] Implementar expiración por lote con worker mínimo, bloqueo y liberación/Outbox únicos en backend/src/modules/reservas/application/expire-reservations.ts
- [x] T053 [US5] Crear comando local seguro sin endpoint público ni rol migrador en scripts/f04/expire.mjs
- [x] T054 [US5] Probar grants del worker, RLS y que no pueda confirmar/entregar/configurar en backend/tests/reservations/reservations.rls.test.ts
- [x] T055 [US5] Ejecutar expiración real y registrar vigentes/terminales/carreras en specs/005-f04-reservas/implementation-evidence.md

## Phase 8: Integración, seguridad y aceptación provisional

- [x] T056 Conectar /reservations y vistas cliente/farmacia a selección autorizada en frontend/src/main.jsx y frontend/src/identity/IdentityApp.jsx
- [x] T057 Ejecutar AC05 con 100 solicitudes independientes/10 unidades y registrar exactamente éxitos, compromisos, Outbox, p95/p99 y errores mediante scripts/f04/load.mjs
- [x] T058 [P] Crear E2E cliente crear/consultar/cancelar y farmacia confirmar/entregar/vencimiento visible en frontend/tests/reservations/f04.spec.js
- [ ] T059 Ejecutar Playwright en entorno Linux oficial y registrar resultados reales en specs/005-f04-reservas/implementation-evidence.md
- [x] T060 Ejecutar check, build, unitarias, API, PostgreSQL/RLS, seguridad, AC05 y npm audit sin --force y registrar resultados en specs/005-f04-reservas/implementation-evidence.md
- [x] T061 Ejecutar regresión F00–F03 y registrar omisiones condicionadas sin declararlas aprobadas en specs/005-f04-reservas/implementation-evidence.md
- [x] T062 Verificar ausencia de pagos, publicación F05, GLO-01, BOOT-01, AWS, IA y secretos en specs/005-f04-reservas/implementation-evidence.md
- [x] T063 Vincular F04-FR-001–026, US1–US5, F04-SC-001–009 y 16 criterios docentes con evidencias reales en specs/005-f04-reservas/evidence-traceability.md
- [x] T064 Actualizar comandos reales, versiones, roles y límites en specs/005-f04-reservas/quickstart.md
- [x] T065 Preparar cierre provisional y revisión humana sin declarar aceptación final en specs/005-f04-reservas/implementation-evidence.md

## Dependencies & execution order

- T001–T006 preparan el incremento. T007–T018 bloquean todas las historias.
- US1 T019–T028 habilita reserva base. US2 depende de US1; US3 depende de reserva persistida; US4 depende de US3; US5 depende de efectos de US2–US4.
- T039 debe preceder T040 y T044. T041 requiere T022. T047 requiere T040. T052 requiere T032/T047.
- T057 requiere US1 y PostgreSQL real. T058 requiere US1–US5 y UI. T059 requiere entorno oficial. T060–T065 requieren los bloques afectados completos.
- Las tareas [P] usan archivos distintos, pero ninguna prueba marcada [P] autoriza implementar antes de la fundación o saltar el gate del plan.

## Traceability summary

- F04-FR-001–006: T003, T007–T028, T057.
- F04-FR-007–011: T029–T035, T051–T055.
- F04-FR-012–017 y F04-FR-026: T009–T017, T036–T055.
- F04-FR-018–021: T008–T11, T021–T25, T041, T047, T052, T060.
- F04-FR-022: T026–T27, T034, T043, T049, T056, T058–T59.
- F04-FR-023–024: T007, T012–T13, T019–T21, T029–T30, T036–T38, T045–T46, T051, T054, T057–T61.
- F04-FR-025: T001, T002, T062.

## Implementation strategy

Primero fundación y US1; luego propiedad/cancelación, confirmación/configuración, entrega y expiración. Cada historia se valida antes de continuar. El incremento no se considera aceptado por marcar tareas: T059–T065 y revisión humana siguen obligatorios.

## Exact requirements and outcomes mapping

| ID | Tareas principales |
|---|---|
| F04-FR-001 | T020, T023–T025 |
| F04-FR-002 | T019, T021–T024 |
| F04-FR-003 | T008, T016–T17, T021–T23 |
| F04-FR-004 | T007, T021–T23 |
| F04-FR-005 | T011, T019–T24, T029–T33 |
| F04-FR-006 | T003, T008, T023 |
| F04-FR-007 | T029–T34 |
| F04-FR-008 | T029–T35 |
| F04-FR-009 | T051–T55 |
| F04-FR-010 | T030–T32, T051–T55 |
| F04-FR-011 | T012, T014, T029, T045, T051 |
| F04-FR-012 | T009–T10, T036–T43, T045–T50 |
| F04-FR-013 | T009, T036–T42 |
| F04-FR-014 | T008, T013, T015, T037–T44 |
| F04-FR-015 | T038, T041–T44 |
| F04-FR-016 | T045–T50 |
| F04-FR-017 | T021, T036–T38 |
| F04-FR-018 | T021–T25, T057, T061 |
| F04-FR-019 | T007–T11, T017, T021, T030, T038, T046, T054 |
| F04-FR-020 | T008, T016–T17, T021–T23, T041, T047, T052 |
| F04-FR-021 | T021, T060–T62 |
| F04-FR-022 | T024, T026–T27, T033–T34, T042–T43, T048–T49, T056, T058–T59 |
| F04-FR-023 | T007, T012–T13, T019–T21, T029–T30, T036–T38, T045–T46, T051, T054, T058–T61 |
| F04-FR-024 | T021, T057 |
| F04-FR-025 | T001–T02, T062 |
| F04-FR-026 | T013, T015, T037, T039–T40, T044–T49, T051–T55 |
| F04-SC-001 | T021, T057 |
| F04-SC-002 | T012, T029, T036–T55, T060 |
| F04-SC-003 | T030, T046, T051–T55 |
| F04-SC-004 | T030, T036–T38, T045–T46, T054, T060 |
| F04-SC-005 | T007, T021, T041, T047, T052, T060 |
| F04-SC-006 | T038, T041, T044, T060 |
| F04-SC-007 | T056, T058–T59 |
| F04-SC-008 | T018, T028, T035, T044, T050, T055, T060, T063 |
| F04-SC-009 | T013, T037, T039, T043–T44, T058–T60 |
