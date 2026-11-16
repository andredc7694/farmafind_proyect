# Tasks: F05 — Notificaciones mediante Transactional Outbox

**Input:** spec.md, plan.md, research.md, data-model.md, contracts/ y quickstart.md.
**Status:** 48/48 tareas verificadas; cierre técnico provisional, revisión humana pendiente.
**Tests:** TDD obligatorio por F05-FR-019 y Constitution XIII.

## Phase 1: Setup

- [X] T001 Registrar alcance aprobado, F05-DEC-01 A y límites en `implementation-evidence.md`.
- [X] T002 Crear estructura Clean Architecture del publicador en `backend/src/modules/notificaciones/README.md`.
- [X] T003 [P] Crear configuración validada F05 en `backend/src/config/notifications.ts` y `notifications/src/config/index.ts`.
- [X] T004 [P] Añadir scripts F05 reproducibles en `package.json` y `scripts/f05/check.mjs`.
- [X] T005 Verificar exclusiones de secretos y artefactos F05 en `.gitignore`.

## Phase 2: Foundational

- [X] T006 Escribir pruebas del ejecutor de migraciones en `backend/tests/notifications/migrations.test.ts`.
- [X] T007 Crear migración de estado/reclamo Outbox y esquema F05 en `backend/migrations/f05/001_notifications.sql`.
- [X] T008 Crear roles mínimos y FORCE RLS F05 en `backend/migrations/f05/002_roles_rls.sql`.
- [X] T009 Crear índices y restricciones de orden, lease y deduplicación en `backend/migrations/f05/003_constraints_indexes.sql`.
- [X] T010 Implementar migrador TEST local e idempotente en `backend/src/modules/notificaciones/infrastructure/migrate.ts`.
- [X] T011 [P] Definir sobre, estados y errores en `backend/src/modules/notificaciones/domain/notification-event.ts`.
- [X] T012 [P] Definir puertos de Outbox, transporte, reloj y métricas en `backend/src/modules/notificaciones/application/ports.ts`.
- [X] T013 Ejecutar pruebas fundacionales y registrar resultados en `implementation-evidence.md`.

## Phase 3: User Story 1 — Publicar después del commit

- [X] T014 [P] [US1] Escribir unitarias de reclamo, orden y sobre en `backend/tests/notifications/outbox-publisher.test.ts`.
- [X] T015 [P] [US1] Escribir integración caída/Outbox pendiente en `backend/tests/notifications/notifications.integration.test.ts`.
- [X] T016 [US1] Implementar repositorio de reclamos PostgreSQL en `backend/src/modules/notificaciones/infrastructure/outbox-repository.ts`.
- [X] T017 [US1] Implementar cliente HTTP autenticado en `backend/src/modules/notificaciones/infrastructure/notifications-client.ts`.
- [X] T018 [US1] Implementar caso PublicarOutbox en `backend/src/modules/notificaciones/application/publish-outbox.ts`.
- [X] T019 [US1] Crear comando worker local seguro en `scripts/f05/publish.mjs`.
- [X] T020 [US1] Verificar que caída no revierte F04 y registrar evidencia en `implementation-evidence.md`.

## Phase 4: User Story 2 — Recepción idempotente

- [X] T021 [P] [US2] Escribir unitarias de firma, validación y huella en `notifications/tests/event-security.test.ts`.
- [X] T022 [P] [US2] Escribir contrato HTTP 202/200/401/409/413/422 en `notifications/tests/events.http.test.ts`.
- [X] T023 [US2] Implementar firma HMAC y ventana anti-replay en `notifications/src/events/signature.ts`.
- [X] T024 [US2] Implementar validación estricta en `notifications/src/events/contract.ts`.
- [X] T025 [US2] Implementar repositorio de recepción/entrega local en `notifications/src/events/repository.ts`.
- [X] T026 [US2] Implementar servicio idempotente en `notifications/src/events/process-event.ts`.
- [X] T027 [US2] Exponer `POST /internal/v1/events` sin alterar `/health` en `notifications/src/app.ts` y `notifications/src/main.ts`.
- [X] T028 [US2] Verificar reenvío e identidad/huella y registrar evidencia en `implementation-evidence.md`.

## Phase 5: User Story 3 — Recuperación controlada

- [X] T029 [P] [US3] Escribir unitarias de backoff/clasificación en `backend/tests/notifications/retry-policy.test.ts`.
- [X] T030 [P] [US3] Escribir prueba de lease abandonado/dos publicadores en `backend/tests/notifications/notifications.rls.test.ts`.
- [X] T031 [US3] Implementar política configurable en `backend/src/modules/notificaciones/domain/retry-policy.ts`.
- [X] T032 [US3] Completar reintento y bloqueo durable en `backend/src/modules/notificaciones/infrastructure/outbox-repository.ts`.
- [X] T033 [US3] Ejecutar caída simulada de cinco minutos y recuperación en `backend/tests/notifications/notifications.integration.test.ts`.
- [X] T034 [US3] Registrar métricas de pendientes/intentos/edad/latencia en `backend/src/modules/notificaciones/application/publish-outbox.ts`.
- [X] T035 [US3] Registrar evidencia de recuperación sin pérdida en `implementation-evidence.md`.

## Phase 6: User Story 4 — Seguridad multi-tenant

- [X] T036 [P] [US4] Escribir pruebas PostgreSQL reales de roles/RLS Alfa-Beta en `backend/tests/notifications/notifications.rls.test.ts`.
- [X] T037 [P] [US4] Escribir pruebas de logs/errores minimizados en `notifications/tests/event-security.test.ts`.
- [X] T038 [US4] Aplicar contexto tenant y grants mínimos en `notifications/src/events/repository.ts`.
- [X] T039 [US4] Verificar que roles F05 no modifican Reserva/Inventario en `backend/tests/notifications/notifications.rls.test.ts`.
- [X] T040 [US4] Ejecutar 100 eventos/dos publicadores y registrar p95/p99 en `backend/tests/notifications/notifications.rls.test.ts`.

## Phase 7: Integration and evidence

- [X] T041 Ejecutar unitarias y contrato F05 mediante `scripts/f05/check.mjs`.
- [X] T042 Ejecutar PostgreSQL/RLS y recuperación real con Docker local.
- [X] T043 Ejecutar build y regresión F00–F04 sin declarar pendientes humanos resueltos.
- [X] T044 Ejecutar `npm audit` sin `--force` y revisar secretos/artefactos.
- [X] T045 Vincular 22 requisitos, 8 criterios y rúbrica en `evidence-traceability.md`.
- [X] T046 Actualizar comandos y límites reales en `quickstart.md`.
- [X] T047 Ejecutar `git diff --check` y comprobar que F04/main permanecen intactas.
- [X] T048 Preparar cierre provisional sin declarar aceptación humana en `implementation-evidence.md`.

## Dependencies

T001–T005 → T006–T013 → T014–T020 → T021–T028 → T029–T035 → T036–T040 →
T041–T048. Las pruebas `[P]` usan archivos separados; ninguna autoriza saltarse
migraciones, autenticación o PostgreSQL real.

## Traceability

- F05-FR-001–006: T001–T013, T017 y T021–T027.
- F05-FR-007–013: T014–T035.
- F05-FR-014–018: T036–T040.
- F05-FR-019–022: T041–T048.
- F05-SC-001–008: T015, T020, T022, T028, T030, T033 y T036–T048.

F05-DEC-01 limita la entrega al registro local. **48/48 no equivale a aceptación humana
ni habilita un canal externo.**
