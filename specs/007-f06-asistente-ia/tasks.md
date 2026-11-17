# Tasks: F06 — Asistente IA informativo

**Input:** spec, plan, research, ADR/C4, data-model, contrato y quickstart.
**Status:** 52/52 verificadas; aceptación humana formal registrada el 2026-11-17 para MockAIProvider determinista, sin proveedor externo.
**Tests:** obligatorios por F06-FR-022 y Constitution XIII.

## Phase 1: Approval and setup

- [X] T001 Registrar aprobación humana explícita de `spec.md`, `plan.md`, ADR y C4; detener código si falta.
- [X] T002 Crear `backend/src/modules/asistente-ia/README.md` con límites y capas.
- [X] T003 [P] Añadir scripts F06 reproducibles a `package.json` y `scripts/f06/check.mjs`.
- [X] T004 [P] Verificar `.gitignore`, cero credenciales/provider SDK y datos ficticios.
- [X] T005 Crear `implementation-evidence.md` con estado inicial sin resultados inventados.

## Phase 2: Foundational contracts and policies

- [X] T006 [P] Escribir pruebas de contrato y validación en `backend/tests/assistant/assistant-contract.test.ts`.
- [X] T007 [P] Escribir pruebas clínicas en `backend/tests/assistant/clinical-policy.test.ts`.
- [X] T008 [P] Escribir pruebas del mock en `backend/tests/assistant/mock-provider.test.ts`.
- [X] T009 Definir DTO y errores en `backend/src/modules/asistente-ia/domain/assistant-contract.ts`.
- [X] T010 Implementar política clínica conservadora en `backend/src/modules/asistente-ia/domain/clinical-policy.ts`.
- [X] T011 Definir puertos de proveedor, herramientas, reloj y métricas en `backend/src/modules/asistente-ia/application/ports.ts`.
- [X] T012 Implementar `MockAIProvider` determinista en `backend/src/modules/asistente-ia/infrastructure/mock-ai-provider.ts`.
- [X] T013 Implementar métricas sin contenido en `backend/src/modules/asistente-ia/infrastructure/assistant-metrics.ts`.
- [X] T014 Ejecutar pruebas fundacionales y registrar resultados reales.

## Phase 3: US1 — Búsqueda y comparación fundamentada

- [X] T015 [P] [US1] Escribir unitarias de grounding/ausencia en `backend/tests/assistant/grounding.test.ts`.
- [X] T016 [P] [US1] Escribir integración de herramientas públicas en `backend/tests/assistant/public-tools.integration.test.ts`.
- [X] T017 [US1] Implementar adaptador F03 en `backend/src/modules/asistente-ia/infrastructure/public-knowledge-tools.ts`.
- [X] T018 [US1] Implementar respuesta fundamentada en `backend/src/modules/asistente-ia/domain/grounded-response.ts`.
- [X] T019 [US1] Implementar `QueryAssistant` en `backend/src/modules/asistente-ia/application/query-assistant.ts`.
- [X] T020 [US1] Verificar búsqueda, comparación, ayuda y ausencia sin invención.

## Phase 4: US2 — Límites clínicos

- [X] T021 [P] [US2] Ampliar batería clínica y mixta en `backend/tests/assistant/clinical-policy.test.ts`.
- [X] T022 [P] [US2] Escribir casos prompt injection/sustitución en `backend/tests/assistant/assistant-security.test.ts`.
- [X] T023 [US2] Integrar política previa al proveedor en `query-assistant.ts`.
- [X] T024 [US2] Verificar que clínica no invoca proveedor/herramientas ni devuelve equivalencias.

## Phase 5: US3 — Proveedor desacoplado y resiliencia

- [X] T025 [P] [US3] Probar 100 repeticiones deterministas en `mock-provider.test.ts`.
- [X] T026 [P] [US3] Probar timeout/salida inválida/fallo en `backend/tests/assistant/provider-fallback.test.ts`.
- [X] T027 [US3] Implementar timeout y validación del puerto en `query-assistant.ts`.
- [X] T028 [US3] Implementar fallback seguro sin red en `mock-ai-provider.ts`.
- [X] T029 [US3] Verificar ausencia de SDK, DNS, HTTP saliente y selección de proveedor real.

## Phase 6: US4 — Endpoint público, abuso y privacidad

- [X] T030 [P] [US4] Escribir contrato HTTP 200/400/413/422/429/503 en `backend/tests/assistant/assistant.http.test.ts`.
- [X] T031 [P] [US4] Escribir rate-limit concurrente en `backend/tests/assistant/rate-limit.test.ts`.
- [X] T032 [P] [US4] Escribir inspección de PII/logs/métricas en `backend/tests/assistant/privacy.test.ts`.
- [X] T033 [US4] Implementar rate limit previo al trabajo en `backend/src/modules/asistente-ia/presentation/rate-limit.ts`.
- [X] T034 [US4] Implementar router y límite 4 KiB en `backend/src/modules/asistente-ia/presentation/assistant-router.ts`.
- [X] T035 [US4] Componer F06 en la aplicación existente sin ampliar rutas privadas.
- [X] T036 [US4] Verificar origen, campos extra, PII, errores y correlación minimizada.

## Phase 7: Minimal React journey

- [X] T037 [P] Escribir cliente React en `frontend/tests/assistant/assistant-client.test.js`.
- [X] T038 [P] Escribir recorrido UI en `frontend/tests/assistant/assistant-view.test.jsx`.
- [X] T039 Implementar `frontend/src/assistant/assistant-client.js`.
- [X] T040 Implementar `frontend/src/assistant/AssistantView.jsx` con estados y fuentes.
- [X] T041 Integrar ruta mínima sin rediseñar estilos ni navegación fuera de F06.
- [X] T042 Verificar accesibilidad básica, español, aviso y errores.

## Phase 8: Integration, load and evidence

- [X] T043 Ejecutar unitarias, HTTP, seguridad y frontend F06.
- [X] T044 Ejecutar integración F03 con PostgreSQL/Redis y fallback Redis caído.
- [X] T045 Ejecutar 100 consultas mock concurrentes y registrar p95/p99 local.
- [X] T046 Ejecutar `check`, build y regresión F00–F05 conservando pendientes humanos.
- [X] T047 Ejecutar `npm audit` sin `--force`, barrido de secretos y `git diff --check`.
- [X] T048 Vincular F06-FR-001–024, SC-001–008, IA-RF01, AC-IA01/02 y rúbrica en `evidence-traceability.md`.
- [X] T049 Actualizar `quickstart.md` solo con comandos y resultados realmente observados.
- [X] T050 Revisar ADR/C4 contra implementación sin modificar decisiones históricas.
- [X] T051 Ejecutar convergencia contra spec/plan/tasks y añadir trabajo faltante si existe.
- [X] T052 Preparar cierre provisional; revisión humana y aceptación F06 permanecen separadas.

## Dependencies

T001 bloquea todo código. T002–T014 bloquean historias. US1 T015–T020 alimenta US3 y el
endpoint; US2 puede avanzar tras fundamentos; US4 depende de US1–US3; UI depende del
contrato HTTP. T043–T052 requieren todas las historias.

## Traceability

- F06-FR-001–008: T015–T020, T030, T037–T042.
- F06-FR-009–010,017: T007, T010, T021–T024.
- F06-FR-011–013: T008, T012, T025–T029.
- F06-FR-014–019: T030–T036, T043–T047.
- F06-FR-020–024: T001–T005, T029, T046–T052.
- F06-SC-001–008: T015–T052.

Marcar tareas solo con evidencia real. 52/52 no equivale a aceptación humana.
