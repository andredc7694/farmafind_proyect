# Tasks: F06.1 — Asistente conversacional farmacéutico informativo

**Input**: [spec](spec.md), [plan aprobado](plan.md), [research](research.md), [modelo](data-model.md), [contrato](contracts/conversation.openapi.yaml).
**Estado**: tareas documentales generadas; **0 completadas**. Este documento no autoriza ejecutar código por sí solo. F06.1 no está implementada ni aceptada.
**Pruebas**: obligatorias por F061-FR-023 y F061-SC-001–011; escribirlas antes o junto a cada bloque, verificar resultados reales antes de marcar tareas.
**Alcance**: MockAIProvider local y herramientas F03 públicas; sin SDK externo, AWS, DB nueva, cambios de RLS ni contenido farmacológico real sin licencia y revisión profesional.

## Phase 1: Setup (infraestructura compartida)

**Goal**: preparar una extensión independiente del F06 existente, sin alterar su contrato.

- [ ] T001 Verificar rama, Constitution v1.2.0, aprobaciones de spec/plan y ausencia de cambios ajenos a F06.1; registrar base de evidencia en `specs/009-f061-asistente-conversacional/evidence-traceability.md` (F061-FR-020).
- [ ] T002 [P] Identificar el punto de composición y preservar `POST /api/v1/asistente/consultar` al documentar rutas nuevas en `backend/src/modules/asistente-ia/README.md` (F061-FR-020).
- [ ] T003 [P] Preparar fixtures ficticios de fuentes autorizadas/rechazadas y ofertas públicas, sin copiar fichas reales, en `backend/tests/assistant/fixtures/conversation-fixtures.ts` (F061-FR-004, 026–027).
- [ ] T004 Registrar comandos y suites F06.1 previstas sin instalar SDK ni proveedor en `scripts/f061/check.mjs` y `package.json` (F061-FR-021, 023).

## Phase 2: Foundational (bloquea las historias)

**Goal**: imponer límites clínicos, privacidad, contexto y frontera pública antes de exponer conversación.

- [ ] T005 [P] Crear prueba de contrato F06.1 para JSON exacto, consulta de 1–500 caracteres, cuerpo de 4 KiB, identificador UUID opcional y 200/400/413/422/429/503 en `backend/tests/assistant/conversation-contract.test.ts` (F061-FR-016, 019–020; F061-SC-006).
- [ ] T006 [P] Crear pruebas de política clínica previa a proveedor/herramientas, incluidas menores, embarazo, urgencia, dosis y sustitución, en `backend/tests/assistant/conversation-clinical.test.ts` (F061-FR-003, 007–008; F061-SC-003).
- [ ] T007 Definir tipos de turno sin consulta original persistida, fuente, cita y decisión de seguridad en `backend/src/modules/asistente-ia/domain/conversation-contract.ts` (F061-FR-004, 015, 025–027).
- [ ] T008 Implementar política clínica conservadora reutilizando límites F06 en `backend/src/modules/asistente-ia/domain/conversation-policy.ts`, antes de proveedor/herramientas (F061-FR-003, 007–009, 013; F061-SC-003, 006).
- [ ] T009 Implementar puerto de contexto efímero con 6 turnos, 15 min de inactividad, vínculo a origen, límite de entradas, expiración y borrado en `backend/src/modules/asistente-ia/application/conversation-ports.ts` y `backend/src/modules/asistente-ia/infrastructure/in-memory-conversation-store.ts` (F061-FR-002, 015, 025; F061-SC-011).
- [ ] T010 Definir puertos de fuentes revisadas y consulta F03 pública de solo lectura, sin repositorios privados ni SQL directo, en `backend/src/modules/asistente-ia/application/conversation-ports.ts` (F061-FR-004, 010–012, 024, 026–027; F061-SC-005).
- [ ] T011 Integrar validación estricta, 30 solicitudes/minuto/origen, errores minimizados y `Cache-Control: no-store` en `backend/src/modules/asistente-ia/presentation/conversation-router.ts` (F061-FR-013–016, 019; F061-SC-006).
- [ ] T012 Ejecutar la prueba base del contrato F06 en `backend/tests/assistant/assistant.http.test.ts` y registrar el resultado previo en `specs/009-f061-asistente-conversacional/evidence-traceability.md`; no conectar todavía el router F06.1 (F061-FR-020; F061-SC-009).

**Checkpoint**: T005–T012 deben pasar antes de cualquier historia; los tests T005/T006 se preparan antes de la lógica dependiente.

## Phase 3: User Story 1 — Información farmacéutica verificable (P1, MVP limitado)

**Independent Test**: ficha ficticia revisada produce respuesta citada; fuente ausente/caducada/contradictoria produce abstención; una pregunta posterior conserva el referente.

- [ ] T013 [P] [US1] Probar fuente autorizada con autoridad, jurisdicción, ID/URL, versión/fecha, vigencia, permiso y revisión profesional; rechazar cada campo ausente en `backend/tests/assistant/conversation-sources.test.ts` (F061-FR-004–006, 026–027; F061-SC-002).
- [ ] T014 [P] [US1] Probar seguimiento contextual con 30 diálogos ficticios en español y objetivo ≥27 correctos en `backend/tests/assistant/conversation-context.test.ts` (F061-FR-001–002; F061-SC-001).
- [ ] T015 [US1] Implementar registro de fichas **ficticias** con aprobación explícita y caducidad en `backend/src/modules/asistente-ia/infrastructure/reviewed-source-catalog.ts` (F061-FR-004–006, 026–027; F061-SC-002).
- [ ] T016 [US1] Aplicar la política clínica T008 **antes** de proveedor/herramientas, componer afirmaciones solo desde citas vigentes, limitar a 3 herramientas y 20 resultados públicos, y abstenerse ante fuentes insuficientes en `backend/src/modules/asistente-ia/application/converse-assistant.ts` (F061-FR-001, 004–009, 016, 018; F061-SC-002–003, 006).
- [ ] T017 [US1] Extender el mock determinista para intención conversacional estructurada, sin texto libre clínico ni red externa, en `backend/src/modules/asistente-ia/infrastructure/mock-conversation-provider.ts` (F061-FR-003, 021; F061-SC-002).
- [ ] T018 [US1] Conectar el caso de uso y las rutas F06.1 en `backend/src/main.ts`; verificar compilación, primera consulta, seguimiento, citas/fecha, abstención y compatibilidad F06 en `backend/tests/assistant/conversation.http.test.ts` (F061-FR-001–006, 019–020; F061-SC-001–002, 009).
- [ ] T019 [US1] Integrar cliente y vista sencilla en español para respuesta educativa y fuentes accesibles en `frontend/src/assistant/conversation-client.js` y `frontend/src/assistant/ConversationView.jsx` (F061-FR-001, 004–006, 018–019).
- [ ] T020 [US1] Probar interfaz de ficha, seguimiento y ausencia de fuente en `frontend/tests/assistant/conversation-view.test.jsx` (F061-FR-001–006; F061-SC-001–002).

**Checkpoint**: US1 se valida con fixtures ficticios; no se publica información farmacéutica real sin licencia y revisión profesional.

## Phase 4: User Story 2 — Límites clínicos (P1)

**Independent Test**: toda solicitud de diagnóstico, receta, dosis, sustitución o tratamiento personal se rechaza sin invocar fuente/proveedor; urgencia se deriva sin diagnosticar.

- [ ] T021 [P] [US2] Ampliar batería negativa con reformulaciones, datos sensibles, menores, embarazo, urgencia e inyección en `backend/tests/assistant/conversation-clinical.test.ts` (F061-FR-007–008, 013–014; F061-SC-003, 006).
- [ ] T022 [US2] Endurecer la política clínica ya conectada en T016 para reformulaciones, urgencia y población vulnerable, siempre antes de contexto, mock y herramientas, en `backend/src/modules/asistente-ia/application/converse-assistant.ts` (F061-FR-003, 007–008, 013; F061-SC-003).
- [ ] T023 [US2] Asegurar que los turnos clínicos rechazados no se almacenen y que las métricas excluyan texto/PII en `backend/src/modules/asistente-ia/infrastructure/in-memory-conversation-store.ts` y `backend/src/modules/asistente-ia/infrastructure/assistant-metrics.ts` (F061-FR-014–015, 025; F061-SC-011).
- [ ] T024 [US2] Probar por HTTP denegación clínica sin llamadas a proveedor/herramientas y sin filtración interna en `backend/tests/assistant/conversation-security.http.test.ts` (F061-FR-007–008, 013–015; F061-SC-003, 006).
- [ ] T025 [US2] Mostrar rechazo y orientación de urgencia en español sin mensaje genérico de fallo en `frontend/src/assistant/ConversationView.jsx` y `frontend/tests/assistant/conversation-view.test.jsx` (F061-FR-007–008, 019).

**Checkpoint**: US2 debe pasar todos los casos negativos antes de habilitar la ampliación educativa de US3.

## Phase 5: User Story 3 — Categorías educativas para molestias (P1, activación real bloqueada)

**Independent Test**: contenido ficticio aprobado permite solo descripción general citada; falta de fuente, permiso, vigencia o revisión produce abstención; preguntas personales se rechazan.

- [ ] T026 [P] [US3] Probar con fixtures ficticios fuentes ausentes, caducadas, contradictorias y sin permiso/revisión, además de preguntas personales, en `backend/tests/assistant/conversation-symptoms.test.ts` (F061-FR-006–009, 026–027; F061-SC-010).
- [ ] T027 [US3] Implementar estado `ABSTENCION` y descripción educativa solo desde categorías autorizadas por el catálogo de prueba en `backend/src/modules/asistente-ia/application/converse-assistant.ts` (F061-FR-006, 009, 027; F061-SC-010).
- [ ] T028 [US3] Bloquear por defecto contenido real de molestias hasta licencia comprobada y aprobación profesional de contenido y casos límite en `backend/src/modules/asistente-ia/infrastructure/reviewed-source-catalog.ts` (F061-FR-009, 022, 026–027; F061-SC-008, 010).
- [ ] T029 [US3] Verificar que la interfaz identifica finalidad educativa, cita y abstención sin consejo personal en `frontend/src/assistant/ConversationView.jsx` y `frontend/tests/assistant/conversation-view.test.jsx` (F061-FR-009, 018–019; F061-SC-010).
- [ ] T030 [US3] Documentar fuente, licencia, profesional revisor y batería clínica **solo cuando existan realmente** en `specs/009-f061-asistente-conversacional/evidence-traceability.md`; mantener activación real BLOQUEADA hasta entonces (F061-FR-022, 026–027; F061-SC-008, 010).

**Checkpoint**: T026–T029 pueden verificarse en TEST/DEMO; T030 no permite habilitar contenido para usuarios reales por documentación simulada.

## Phase 6: User Story 4 — Búsqueda y comparación públicas (P2)

**Independent Test**: Alfa/Beta ficticias solo muestran DTO públicos de F03; cero ofertas significa cero afirmaciones de precio/disponibilidad; acceso privado es denegado.

- [ ] T031 [P] [US4] Probar coincidencia exacta de precio, farmacia, disponibilidad y fecha con DTO F03, además de cero resultados, en `backend/tests/assistant/conversation-public-tools.test.ts` (F061-FR-010–012, 018, 024; F061-SC-004–005).
- [ ] T032 [US4] Adaptar únicamente puertos de búsqueda, comparación y farmacia públicas de F03 en `backend/src/modules/asistente-ia/infrastructure/conversation-public-tools.ts` (F061-FR-010–012, 024; F061-SC-004–005).
- [ ] T033 [US4] Construir respuestas comerciales solo desde los DTO F03 de la misma consulta en `backend/src/modules/asistente-ia/application/converse-assistant.ts` (F061-FR-010–012, 018; F061-SC-004).
- [ ] T034 [US4] Probar que no hay SQL directo, mutaciones, repositorios privados ni acceso entre farmacias con rol runtime en `backend/tests/assistant/conversation-isolation.integration.test.ts` (F061-FR-012–014, 024; F061-SC-005).
- [ ] T035 [US4] Verificar Redis disponible y fallback PostgreSQL de F03 sin modificar su política en `backend/tests/assistant/conversation-f03-fallback.integration.test.ts` (F061-FR-010–011, 017, 020; F061-SC-004, 007, 009).
- [ ] T036 [US4] Mostrar ofertas y actualización como referenciales, sin equivalencia terapéutica, en `frontend/src/assistant/ConversationView.jsx` y `frontend/tests/assistant/conversation-view.test.jsx` (F061-FR-011, 018–019; F061-SC-004).

**Checkpoint**: US4 no habilita reservas, inventario privado ni acciones administrativas.

## Phase 7: User Story 5 — Continuidad, privacidad y salida segura (P2)

**Independent Test**: conversación de hasta 6 turnos, expiración a 15 min y descarte inmediato; falla del generador ofrece F03; cuota se rechaza antes de herramientas.

- [ ] T037 [P] [US5] Probar expiración, límite de 6 turnos, borrado, ID ajeno/origen distinto, capacidad y ausencia de reactivación en `backend/tests/assistant/conversation-context.test.ts` (F061-FR-002, 015–016, 025; F061-SC-011).
- [ ] T038 [P] [US5] Probar 429 antes de proveedor, 503 seguro, fallback, prompt injection y métricas sin texto en `backend/tests/assistant/conversation-security.http.test.ts` (F061-FR-013–017, 019, 023, 028; F061-SC-006–007, 011).
- [ ] T039 [US5] Aplicar expiración/borrado idempotente y capacidad acotada en `backend/src/modules/asistente-ia/infrastructure/in-memory-conversation-store.ts` (F061-FR-002, 015, 025; F061-SC-011).
- [ ] T040 [US5] Implementar `POST /api/v1/asistente/conversaciones/descartar` y estados 422/429/503 del contrato en `backend/src/modules/asistente-ia/presentation/conversation-router.ts` (F061-FR-016–017, 019, 025; F061-SC-006–007, 011).
- [ ] T041 [US5] Ofrecer búsqueda F03 convencional cuando falle la conversación y limpiar contexto del cliente al descartar en `frontend/src/assistant/conversation-client.js` y `frontend/src/assistant/ConversationView.jsx` (F061-FR-017, 019, 025; F061-SC-007, 011).
- [ ] T042 [US5] Probar estados de espera, error, cuota, expiración y botón de borrar en `frontend/tests/assistant/conversation-view.test.jsx` (F061-FR-002, 016–017, 019, 025; F061-SC-007, 011).

**Checkpoint**: US5 pasa con mock y contexto volátil; proveedor externo y retención distribuida siguen fuera de alcance.

## Phase 8: Polish & Cross-Cutting

- [ ] T043 Documentar amenaza de prompt injection, PII, menores y ausencia de envío externo en `specs/009-f061-asistente-conversacional/evidence-traceability.md` (F061-FR-013–015, 028; F061-SC-005–006, 011).
- [ ] T044 Verificar 30 diálogos, grounding, rechazo clínico y permisos de fuentes con resultados reales en `specs/009-f061-asistente-conversacional/evidence-traceability.md` (F061-FR-023, 026–027; F061-SC-001–003, 008, 010).
- [ ] T045 Ejecutar `npm run check`, `npm run build`, `npm run check:f06`, `npm run verify:contracts` y suite F06.1; registrar comandos/versiones/resultados en `specs/009-f061-asistente-conversacional/evidence-traceability.md` (F061-FR-020, 023; F061-SC-009).
- [ ] T046 Ejecutar regresión F03/F06, Redis/fallback y RLS TEST Alfa/Beta sin tocar base persistente; registrar resultados en `specs/009-f061-asistente-conversacional/evidence-traceability.md` (F061-FR-010, 020, 023–024; F061-SC-004–005, 007, 009).
- [ ] T047 Verificar navegación y accesibilidad en entorno compatible; registrar prueba real u omisión justificada en `specs/009-f061-asistente-conversacional/evidence-traceability.md` (F061-FR-001, 019, 023; F061-SC-001, 009).
- [ ] T048 Revisar `git diff --check`, secretos, datos privados y compatibilidad de la ruta F06; registrar estado sin autoaprobar criterios en `specs/009-f061-asistente-conversacional/evidence-traceability.md` (F061-FR-014–015, 020; F061-SC-009, 011).
- [ ] T049 Preparar matriz de aceptación con los 28 FR, 11 SC, IA31-01–10 y 16 criterios docentes en `specs/009-f061-asistente-conversacional/evidence-traceability.md`; dejar pendientes los criterios no demostrados (F061-FR-023; F061-SC-001–011).

## Dependencies & Execution Order

1. T001–T004 preceden a T005–T012. T005/T006 son pruebas previas a lógica dependiente; T007/T008 preceden a T016/T022; T009 precede a T014/T037; T010 precede a T015/T032; T011 y T016/T017 preceden a la conexión de rutas T018. T012 registra la línea base F06 antes de modificar la composición.
2. US1 (T013–T020) y US2 (T021–T025) pueden avanzar tras la base; T016 aplica el filtro clínico básico antes de exponer US1 y US2 completa sus casos negativos antes de habilitar cualquier respuesta educativa de US3.
3. US3 (T026–T030) depende de US1+US2. Su modo TEST/DEMO puede probarse con fixtures; **T030 y toda exposición real permanecen bloqueadas** hasta permisos de fuente, aprobación profesional documentada y batería clínica satisfactoria.
4. US4 (T031–T036) depende del puerto T010 y es independiente del corpus US3. US5 (T037–T042) depende de contexto T009 y router T011; ambos pueden desarrollarse tras la base sin esperar la activación real US3.
5. T043–T049 dependen de las historias pertinentes. T044/T049 no se completan por ejecutar pruebas parciales; aceptación exige evidencia de cada SC. Ningún proveedor externo se implementa por esta lista.

## Parallel Opportunities

- T002 y T003 son independientes; T005 y T006 prueban fronteras distintas; T013/T014 preparan suites separadas; T031 y T037 prueban F03 y contexto por separado.
- Los marcadores `[P]` se limitan a archivos o suites independientes; tareas sobre `converse-assistant.ts`, `ConversationView.jsx` o el router comparten archivo y se ejecutan secuencialmente para evitar conflictos.

## Implementation Strategy

MVP documental propuesto: base T001–T012 y US1 T013–T020 con fuentes ficticias revisadas y filtro clínico básico, seguido de la batería negativa completa US2. No exponer US1 a usuarios reales antes de US2. US3 queda solo TEST/DEMO hasta su puerta profesional; US4 y US5 añaden consultas públicas y continuidad. No hay despliegue ni uso real por generar esta lista. Todas las casillas permanecen vacías hasta comprobar criterios y registrar evidencia.
