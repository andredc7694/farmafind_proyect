# Tasks: F02.5 — Incorporación y administración de farmacias

**Input**: [spec.md](spec.md), [plan.md](plan.md), [data-model.md](data-model.md), [contracts/](contracts/), [traceability.md](traceability.md).
**Status**: implementación TEST/DEMO en curso; **61/64 tareas marcadas**, 3 pendientes de demostración y aceptación humanas, según [auditoría individual](task-audit.md). Las migraciones aditivas 011–015 se verificaron solo en PostgreSQL TEST aislado; 014–015 se aplicaron únicamente en hijos efímeros propios. La Constitution XVIII exige aprobación humana expresa de spec y plan antes de cualquier código, migración o prueba ejecutable; consta en [approval.md](approval.md). DEC-01–03 solo permiten ejecución en TEST/DEMO aislado. La demostración humana y la aceptación final siguen pendientes.
**Tests**: solicitadas explícitamente; los resultados se registrarán después de ejecutarlas, no por preparar esta lista.

## Phase 1: Setup y puertas

- [X] T001 Registrar la aprobación humana de la revisión final de `specs/012-f025-incorporacion-farmacias/spec.md` y `plan.md`, y la resolución normativa de inserción F02.5 antes de F09 frente a Constitution XV/ADR-ROADMAP-V3-001, en `specs/012-f025-incorporacion-farmacias/approval.md`; bloquear T002–T063 mientras falte.
- [X] T002 Comprobar rama F02.5, cambios DEMO previos, hash de maestros y ausencia de secretos sin modificar F08; registrar línea base en `specs/012-f025-incorporacion-farmacias/evidence.md` (FR-021/028).
- [X] T003 Preparar configuración de base F02.5 efímera TEST y guardas contra `farmafind_f01_test` en `scripts/f025/test-env.mjs`; no crear ni migrar base persistente (FR-009/021).
- [X] T004 [P] Añadir verificaciones de contrato F02.5 a `scripts/integration/check-openapi-routes.mjs` sin cambiar operaciones históricas (FR-007/020).
- [X] T005 [P] Preparar fixtures sintéticos, sin credenciales versionadas ni inventario precargado, en `scripts/f025/fixtures.mjs` (FR-004/021).

## Phase 2: Fundamentos de autorización y esquema

**Prerequisito**: T001–T003 y revisión humana del SQL antes de ejecutarlo; usar solo base TEST efímera. Esta fase bloquea US1–US6.

- [X] T006 Definir migración de `f025.solicitud`, `revision`, `documento`, `activacion` y `farmacia_perfil` con estados, FK, versión y unicidad en `backend/migrations/f025/001_applications.sql` (FR-005/008/018/023).
- [X] T007 Definir grants F02.5 cerrados y expediente offline TEST, separados de GLO-01, en `backend/migrations/f025/002_platform_permissions.sql` (FR-007/009/012; DEC-01).
- [X] T008 Definir RLS/FORCE RLS `USING`/`WITH CHECK` para solicitud, revisión, perfil y grants, con actor o capacidad verificados y denegación sin contexto, en `backend/migrations/f025/003_rls.sql` (FR-010/011/020).
- [X] T009 Definir función estrecha de activación, rol `NOLOGIN NOSUPERUSER NOBYPASSRLS`, políticas específicas y protección contra dos aprobaciones en `backend/migrations/f025/004_activation.sql` (FR-008/012; DEC-02).
- [X] T010 Definir Outbox F02.5 y permisos mínimos del worker sin alterar `f04.outbox_evento` en `backend/migrations/f025/005_outbox.sql` (FR-017/019).
- [X] T011 [P] Crear pruebas de esquema, roles, RLS y fuga de conexión en `backend/tests/pharmacies/f025-foundation.rls.test.ts` para Alfa/Beta y contexto nulo (FR-010/011/020).
- [X] T012 Crear ejecutor de migraciones F02.5 con revisión de destino TEST y control de versiones en `backend/src/modules/farmacias/infrastructure/migrate-f025.ts`; probar que rechaza base persistente (FR-009/021).
- [X] T013 Crear adaptador de permisos F02.5 que exija sesión F01, asignación global activa y grant específico vigente en `backend/src/modules/farmacias/infrastructure/platform-permissions.ts` (FR-007, FR-012).
- [X] T014 Integrar la unidad de trabajo F01 verificada sin introducir otro pool privilegiado en `backend/src/modules/farmacias/infrastructure/pharmacy-unit-of-work.ts`; probar rollback y limpieza (FR-008/010/011).

## Phase 3: US1 — Solicitar incorporación (P1) 🎯 primer slice

**Prueba independiente**: usuario normal crea BORRADOR, envía PENDIENTE y consulta solo lo suyo; cero farmacias/membresías creadas.

- [X] T015 [P] [US1] Escribir pruebas de transiciones, duplicados y reenvío en `backend/tests/pharmacies/application-domain.test.ts` (FR-005/006/023; SC-003).
- [X] T016 [P] [US1] Escribir pruebas HTTP negativas de sesión, CSRF, enumeración y propiedad en `backend/tests/pharmacies/applications.http.test.ts` (FR-002/003/006/025).
- [X] T017 [US1] Implementar estado, validaciones y política de deduplicación sin afirmar identidad legal en `backend/src/modules/farmacias/domain/pharmacy-application.ts` (FR-004, FR-005, FR-023, FR-028).
- [X] T018 [US1] Implementar casos de uso de borrador, envío, consulta propia, corrección y cancelación en `backend/src/modules/farmacias/application/manage-applications.ts` (FR-003/005/006/023).
- [X] T019 [US1] Implementar repositorio con RLS por solicitante y versión en `backend/src/modules/farmacias/infrastructure/application-repository.ts` (FR-006/011).
- [X] T020 [US1] Exponer las rutas propias, carga opcional de adjuntos sintéticos TEST, errores minimizados y CSRF en `backend/src/modules/farmacias/presentation/application-router.ts` (FR-003, FR-006, FR-018, FR-025).
- [X] T021 [US1] Integrar router solo en composición TEST F02.5 mediante `backend/src/identity-app.ts` y gate de base efímera (FR-009/021).
- [X] T022 [US1] Construir formulario, borrador, envío y seguimiento accesibles en `frontend/src/pharmacies/PharmacyApplication.jsx` y cliente en `frontend/src/pharmacies/application-client.js` (FR-003, FR-027).
- [X] T023 [US1] Verificar US1 con API y PostgreSQL real TEST, incluido solicitante B sin acceso a A; registrar comandos/resultados en `specs/012-f025-incorporacion-farmacias/evidence.md` (FR-020; AC02).

## Phase 4: US2 — Revisión y activación (P1)

**Prueba independiente**: revisor TEST explícito observa/rechaza/aprueba; cliente, dueño ajeno y solicitante no deciden; una sola activación ante concurrencia.

- [X] T024 [P] [US2] Escribir pruebas de permisos F02.5 y denegación de administrador global sin grant en `backend/tests/pharmacies/platform-authorization.test.ts` (FR-007/012; AC03/07).
- [X] T025 [P] [US2] Escribir pruebas RLS reales de solicitudes/documentos A/B, roles runtime/ejecutor y contexto nulo en `backend/tests/pharmacies/applications.rls.test.ts` o verificador PostgreSQL TEST equivalente (`scripts/f025/verify-rls.mjs`); conservar prueba de pool separada (FR-011/020).
- [X] T026 [P] [US2] Escribir prueba de 2+ aprobaciones concurrentes, repetición, rollback y una membresía DUENO en `scripts/f025/verify-activation-concurrency.mjs`, equivalente ejecutable en PostgreSQL TEST (FR-008; SC-004).
- [X] T027 [US2] Implementar `ReviewApplication` y `ActivatePharmacy` con revisor distinto del solicitante, versión y capacidades dobles en `backend/src/modules/farmacias/application/review-application.ts` (FR-005/007/008/019).
- [X] T028 [US2] Implementar activación atómica en repositorio estrecho y perfiles/relación F01 en `backend/src/modules/farmacias/infrastructure/activation-repository.ts` (FR-008/011; DEC-02).
- [X] T029 [US2] Implementar registro de revisión y auditoría sin secretos ni adjuntos en `backend/src/modules/farmacias/infrastructure/application-audit.ts` (FR-019; SC-008).
- [X] T030 [US2] Implementar Outbox mínimo de solicitud en `backend/src/modules/farmacias/infrastructure/application-outbox.ts` dentro de la misma unidad transaccional (FR-017).
- [X] T031 [US2] Conectar los cuatro eventos de solicitud `f025.outbox_evento` al servicio F05 mediante contrato interno separado y firmado, recepción/entrega local privada por usuario, reintentos, deduplicación, registro de procesamiento y retención configurable de 30 días TEST en `notifications/src/events/{contract,router,repository,process-event}.ts` y el publicador F02.5; preparar migraciones TEST aditivas de reclamo, recepción y entrega con RLS, y actualizar OpenAPI interno sin alterar F04. Verificar Outbox atómico, fallo F05 sin cambio de solicitud, repetición/conflicto, destinatario y ausencia de PII mediante SQL/HTTP/regresión F05 (FR-008/017/019; SC-004/008).
- [X] T032 [US2] Exponer panel HTTP de lista, detalle, lectura autorizada de adjuntos sintéticos y decisiones con respuestas 401/403/404/409 y CSRF en `backend/src/modules/farmacias/presentation/platform-applications-router.ts` (FR-007/018/024/025).
- [X] T033 [US2] Construir panel de revisión TEST y estados accesibles en `frontend/src/pharmacies/PlatformApplications.jsx` y cliente en `frontend/src/pharmacies/platform-client.js` (FR-024/027).
- [X] T034 [US2] Verificar activación RLS, concurrencia, eventos y ausencia de acceso del revisor a F02/F04; registrar evidencia en `specs/012-f025-incorporacion-farmacias/evidence.md` (FR-008/012/020; AC03/04/07).

## Phase 5: US3 — Portal y aislamiento de farmacia propia (P1)

**Prueba independiente**: dueño Alfa administra solo Alfa; IDs, cabeceras y sesión de Beta no conceden acceso cruzado.

- [X] T035 [P] [US3] Escribir pruebas API/RLS de inventario, trabajadores, reservas, ubicación y documentos Alfa/Beta mediante verificadores PostgreSQL/HTTP TEST equivalentes (`scripts/f025/verify-rls.mjs`, `verify-sql-matrix.mjs`, `verify-http-isolation.mjs`) (FR-010/011/020; AC06/10).
- [X] T036 [US3] Exponer `GET /api/v1/farmacias/{farmaciaId}/perfil` bajo sesión, membresía activa, `pharmacy.profile.read` y RLS en `backend/src/modules/farmacias/presentation/pharmacy-profile-router.ts`, sin duplicar `/me/memberships`; actualizar OpenAPI y verificar GET Alfa, denegación Beta/usuario sin membresía/revisor global, revocación y pool reutilizado (FR-010/011/013; SC-002).
- [X] T037 [US3] Implementar `PATCH /api/v1/farmacias/{farmaciaId}/perfil` solo para `contacto`, con versión esperada, CSRF, membresía activa, `pharmacy.profile.read/write`, auditoría y RLS en `backend/src/modules/farmacias/application/manage-pharmacy-profile.ts`; preparar migración TEST de delegaciones tenant y sustitución de SELECT permisivo más UPDATE acotado `USING/WITH CHECK`, sin UPDATE general al runtime. Verificar 200 propio, 409 de versión, denegación Beta/revisor/trabajador/revocado y ausencia de cambios en campos protegidos (FR-010/011/013/019/020; SC-002/008).
- [X] T038 [US3] Construir panel de farmacia activa que reutilice selector F01 y navegación F08 en `frontend/src/pharmacies/PharmacyDashboard.jsx` (FR-013/022/027).
- [X] T039 [US3] Añadir rutas y enlaces según sesión/capacidades sin confiar en ocultación como seguridad en `frontend/src/app/routes.js` y `frontend/src/main.jsx` (FR-022/024).
- [X] T040 [US3] Verificar cambio Alfa→Beta, revocación y fuga de pool con rol runtime en `scripts/f025/verify-pool-isolation.mjs`, equivalente ejecutable en PostgreSQL TEST (FR-010/011/020; AC10).
- [X] T041 [US3] Registrar evidencia real de denegación horizontal/vertical en `specs/012-f025-incorporacion-farmacias/evidence.md` (FR-020; SC-002).

## Phase 6: US4 — Importación y publicación (P2)

**Prueba independiente**: dueño Alfa importa CSV y XLSX mediante F02; Beta no puede acceder; solo ofertas públicas autorizadas aparecen en F03.

- [X] T042 [P] [US4] Escribir pruebas de CSV/XLSX, tamaño, fórmulas, columnas/tenant falsificados y rollback F02 mediante unitarias F02 y verificadores HTTP TEST equivalentes (`scripts/f025/verify-import-rollback.mjs`, `verify-http-isolation.mjs`) (FR-014/020; AC05/06).
- [X] T043 [US4] Enlazar el panel F02 y plantilla CSV existente, sin cambiar contratos de importación, en `frontend/src/pharmacies/PharmacyDashboard.jsx` y `frontend/src/inventory/InventoryView.jsx` (FR-013/014/027).
- [X] T044 [US4] Integrar actualización de proyección autorizada e invalidación Redis posterior a activación/importe en `backend/src/modules/farmacias/infrastructure/publication-invalidator.ts` (FR-015).
- [X] T045 [US4] Verificar ofertas solo de farmacias activas, datos públicos depurados y fallback PostgreSQL mediante `backend/tests/pharmacies/publication.test.ts`, SQL TEST equivalente y recorrido HTTP TEST previo (FR-015/020; AC08).
- [X] T046 [US4] Registrar resultados reales de importación manual desde navegador y errores por fila en `specs/012-f025-incorporacion-farmacias/evidence.md` (FR-014; SC-005).

## Phase 7: US5 — Público y reservas (P2)

**Prueba independiente**: visitante busca sin login, retoma reserva tras autenticarse y no ve inventario privado.

- [X] T047 [P] [US5] Escribir prueba E2E pública de búsqueda/comparación y ausencia de campos privados en `frontend/tests/pharmacies/public-journey.spec.js` o verificador Playwright Linux equivalente (`scripts/f025/browser-public.mjs` y `browser-five.mjs`) (FR-001/015; AC01/08).
- [X] T048 [US5] Conservar selección de oferta al pasar por login sin persistir datos privados en `frontend/src/reservations/CreateReservation.jsx` y `frontend/src/identity/AuthView.jsx` (FR-016; AC11).
- [X] T049 [US5] Revalidar condiciones y pertenencia F04 en el flujo de reserva, con prueba de farmacia no activa en `backend/tests/pharmacies/reservation-integration.test.ts` (FR-015/016/017).
- [X] T050 [US5] Verificar F06/F06.1 solo informativos y F07 con ubicación DEMO sin proveedor nuevo mediante Playwright Linux público equivalente (`scripts/f025/browser-public.mjs`) (FR-001/013).
- [X] T051 [US5] Registrar resultados del recorrido público y reserva en `specs/012-f025-incorporacion-farmacias/evidence.md` (FR-016/017; SC-006, SC-007).

## Phase 8: US6 — Cinco farmacias desde navegador (P2)

**Prueba independiente**: cinco cuentas normales solicitan, revisor TEST aprueba, dueños importan manualmente y cliente compara/reserva; sin SQL por farmacia.

- [X] T052 [US6] Preparar entorno TEST reproducible con provisión **única** del revisor por BOOT-01/GLO-01 autorizados y expediente F02.5 offline ignorado en `scripts/f025/demo-start.ps1`; rechazar destino persistente (FR-009/021).
- [X] T053 [US6] Crear datos sintéticos mínimos sin farmacias ni inventarios precargados en `scripts/f025/fixtures.mjs`; las cinco altas deben ocurrir en navegador (FR-004/021).
- [X] T054 [US6] Ejecutar recorrido Playwright de cinco solicitudes, aprobaciones, paneles, importaciones y comparaciones mediante `scripts/f025/browser-five.mjs` en Linux oficialmente compatible y con montajes limitados (FR-020/021/027; AC09/12).
- [X] T055 [US6] Ejecutar 20 casos negativos de tenant desde HTTP y rol runtime y documentar matriz Alfa/Beta en `specs/012-f025-incorporacion-farmacias/acceptance.md` (FR-020; SC-002).
- [X] T056 [US6] Preparar guía con URL/comandos reales, acceso seguro a credenciales ficticias, arranque/parada sin borrar volúmenes en `docs/demo-manual-f025.md` (FR-021).
- [X] T057 [US6] Realizar demostración humana de cinco farmacias sin scripts de alta individual y registrar resultados/omisiones en `specs/012-f025-incorporacion-farmacias/evidence.md` (FR-021; SC-001/005). _Hecha por Andre el 2026-11-27._

## Phase 9: Cierre, regresión y límites

- [X] T058 [P] Ejecutar unitarias/API, PostgreSQL RLS, Redis/fallback, OpenAPI, TypeScript/build, arquitectura y npm audit; registrar comandos/versiones/resultados reales en `specs/012-f025-incorporacion-farmacias/evidence.md` (FR-020).
- [X] T059 [P] Tras T064, ejecutar regresión F00–F08/F06.1 y Playwright en entorno compatible; registrar resultados u omisiones justificadas en `specs/012-f025-incorporacion-farmacias/evidence.md` (FR-020/027; AC12).
- [X] T060 Registrar la suspensión/desactivación F025-RF23 como **bloqueada** sin crear endpoint ni migración operativa, y verificar que no se habilitó en `specs/012-f025-incorporacion-farmacias/acceptance.md` (FR-026).
- [X] T061 Construir matriz FR/SC/AC→prueba/evidencia y 16 criterios sin puntajes inventados en `specs/012-f025-incorporacion-farmacias/acceptance.md` y `traceability.md` (FR-020/028).
- [X] T062 Ejecutar `git diff --check`, revisar archivos privados, datos TEST y secretos, y registrar estado de `farmafind_f01_test` solo mediante lectura en `specs/012-f025-incorporacion-farmacias/evidence.md` (FR-021).
- [X] T063 Solicitar aceptación humana final de F02.5 con límites TEST y registrar decisión, sin autoaprobar, en `specs/012-f025-incorporacion-farmacias/acceptance.md` (SC-001–008). _Decisión de Andre el 2026-11-27: ACEPTO CON OBSERVACIONES (alcance TEST/DEMO)._

## Adenda SDD aprobada 2026-11-21 — preparación de suites F06.1

- [X] T064 [P] Adaptar `backend/tests/assistant/fixtures/conversation-real-fixture.ts` y `scripts/f061/check.mjs` para usar exclusivamente madre F06.1 TEST con identidad de clúster y marcador de propiedad verificados, crear hijos efímeros por ejecución y limpiar solo los hijos y roles propios sin `CASCADE`; proteger `farmafind_f01_test` y la DEMO manual, ocultar secretos y aislar Redis TEST. Verificar guardas de destino y limpieza, ejecutar las dos suites F06.1 solo cuando exista madre TEST identificada, y registrar resultados reales antes de T059 (FR-020; AC12).

## Dependencies & Execution Order

T001 es una puerta humana y normativa obligatoria. T002–T005 son setup; T006–T014 bloquean todas las historias y requieren revisión SQL/TEST. US1 requiere T006–T014. US2 requiere US1 y capacidades DEC-01; T027–T034 requieren T009/013/014. US3 requiere aprobación US2. US4 requiere US3 y reutiliza F02/F03. US5 puede preparar pruebas públicas tras fundamentos, pero el recorrido de reserva depende de US4. US6 requiere US1–US5 y navegador compatible. T058–T063 cierran el incremento; T063 nunca se autoejecuta.

**Paralelismo real**: T004/T005; T011 con revisión de migraciones; T015/T016; T024/T025/T026; T042 con preparación de UI; T058/T059 sobre artefactos ya terminados. Las tareas que escriben el mismo archivo o requieren migraciones/servicios son secuenciales. El principio constitucional de una funcionalidad activa impide delegar otra feature en paralelo.

**MVP**: US1 permite solicitar y seguir sin activar. US2 habilita revisión/activación TEST tras pruebas RLS y concurrencia. US3–US6 conectan el uso manual completo. Ningún checkpoint intermedio equivale a aceptación final.

**Bloqueos explícitos**: aprobación formal de spec/plan y resolución normativa del roadmap satisfechas en T001; sin revisión humana del SQL ni base PostgreSQL TEST real no se cierran T006–T014 ni RLS/activación; sin permiso F02.5 explícito no se habilita revisión; sin entorno Playwright compatible no se cierra T054/T059; F025-RF23 y producción no son implementables con las autorizaciones actuales.

**Puertas actuales tras T026/T040:** la adenda de `spec.md` y `plan.md` para T031/T036/T037/T064 fue aprobada expresamente el 2026-11-21; su implementación fue autorizada expresamente y verificada en PostgreSQL TEST efímero. T031 depende del contrato F02.5 Outbox y recepción F05; T036 depende de grants/RLS de lectura; T037 depende de T036, grants/RLS de escritura y control de versión. T064 precede a la regresión F06.1 de T059. T031/T036/T037/T064 están marcadas tras pruebas reales. T063 sigue siendo aceptación humana y la base manual de cinco farmacias requiere intervención del propietario (T057).
