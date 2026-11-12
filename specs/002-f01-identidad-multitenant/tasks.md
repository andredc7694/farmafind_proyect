# Tasks: F01 — Identidad y seguridad multi-tenant

**Input**: [spec.md](spec.md), [plan.md](plan.md), [research.md](research.md), [data-model.md](data-model.md), [authorization-decisions.md](authorization-decisions.md), [contracts/](contracts/) y [quickstart.md](quickstart.md).
**Status**: Plan F01 aprobado; T042–T049 verificadas localmente con PostgreSQL real para conceder/revocar exclusivamente TRABAJADOR en la farmacia propia. GLO-01 y BOOT-01 mantienen bloqueadas T050–T051. Playwright T062 y revisión humana T067 pendientes; F01 no está aceptada.
**Tests**: Obligatorios por F01-FR-018 y Constitución XIII: unitarias, HTTP, PostgreSQL RLS real, seguridad negativa/positiva y E2E en entorno oficialmente compatible.
**Organization**: Cuatro historias P1 independientes en su criterio de prueba, con dependencias técnicas explícitas. `[P]` solo indica archivos distintos y ausencia de dependencia inmediata.

## Format: `[ID] [P?] [Story] Description`

Cada tarea usa `- [ ] T### [P?] [US#?]` y una ruta exacta. `BLOQUEADA (gate)` significa que no puede implementarse ni marcarse hasta que el gate esté aprobado; la presencia de la tarea no constituye aprobación.

## Phase 1: Setup — F01 sobre F00

**Purpose**: Preparar el incremento sin alterar F00, los siete módulos ni Notificaciones.

- [X] T001 Registrar rama, revisión base, aprobación del plan, límites F01 y estado EXC-01/GLO-01/ROL-01/BOOT-01 en `specs/002-f01-identidad-multitenant/implementation-evidence.md` antes de cualquier código; detenerse si falta autorización de implementación. [F01-FR-020]
- [X] T002 Evaluar en Windows 10 y Node.js 24.17.0 una versión fijada del paquete `argon2`: instalación aislada, hash/verificación Argon2id con datos ficticios, licencia y auditoría; registrar versiones, comandos, esperado/obtenido y fallos en `specs/002-f01-identidad-multitenant/argon2-compatibility.md`; si falla, detener adopción y pedir alternativa aprobada. [ARG-01, F01-FR-013]
- [X] T003 Tras T002 satisfactorio y aprobación del plan, fijar `argon2` y `pg` auditados en `backend/package.json` y `package-lock.json`, sin cambiar versiones principales F00 ni introducir proveedor externo. [F01-FR-013, F01-FR-015]
- [X] T004 [P] Documentar variables ficticias de PostgreSQL, cookie, CSRF y orígenes sin secretos reales en `backend/.env.example` y `specs/002-f01-identidad-multitenant/implementation-evidence.md`. [F01-FR-013, F01-FR-020]
- [X] T005 Preparar scripts F01 de controles unitarios, HTTP y PostgreSQL sin sustituir los de F00 en `package.json` y `scripts/f01/check.mjs`. [F01-FR-018]
- [X] T006 [P] Registrar límites de Clean Architecture y que Farmacias, Administración y Notificaciones conservan sus responsabilidades en `backend/src/modules/usuarios/README.md`. [F01-FR-020, F01-SC-007]

**Checkpoint**: T001–T006 completadas para preparación F01; no acreditan aceptación funcional.

## Phase 2: Foundational — seguridad compartida

**Purpose**: Identidad, esquema, roles de BD y contexto transaccional mínimos para US1/US2/US4. Ninguna mutación delegada se habilita aquí.

- [X] T007 Crear pruebas de migración desde BD vacía, rollback, grants y ausencia de `BYPASSRLS` en `backend/tests/identity/migrations.test.ts` antes de escribir migraciones. [F01-FR-015–017]
- [X] T008 Crear migrador F01 reproducible que use una BD ficticia de prueba y se niegue a usar un rol runtime privilegiado en `backend/src/modules/usuarios/infrastructure/db/migrate.ts`. [F01-FR-015]
- [X] T009 Definir tablas globales de usuario y sesión con correo canónico único, `password_hash` versionable, huella de sesión, vencimientos y revocación en `backend/migrations/f01/001_identity.sql`. [F01-FR-001–003, F01-FR-013, F01-FR-015]
- [X] T010 Definir referencia mínima de farmacia, membresía usuario–farmacia, delegación y auditoría con FK, unicidad lógica por par usuario–farmacia e índices de consulta en `backend/migrations/f01/002_memberships.sql`; no crear inventario ni reservas. [F01-FR-005–007, F01-FR-014–015, F01-FR-020]
- [X] T011 Definir rol runtime `NOSUPERUSER NOBYPASSRLS` no propietario, grants mínimos y política RLS de lectura de membresías propias, sin políticas de mutación delegada ni permiso global universal, en `backend/migrations/f01/003_rls_base.sql`. [F01-FR-016–017]
- [X] T012 Crear pruebas de transacción con mismo cliente del pool, actor verificado, contexto tenant local, commit/rollback y conexión reutilizada en `backend/tests/identity/tenant-transaction.test.ts` antes del adaptador. [F01-FR-017–018]
- [X] T013 Implementar puerto y adaptador de transacción con `BEGIN`, contexto local validado, `COMMIT`/`ROLLBACK` y liberación segura de cliente en `backend/src/modules/usuarios/infrastructure/db/tenant-transaction.ts`. [F01-FR-017]
- [X] T014 [P] Definir entidades y estados `usuario`, `sesion`, `usuario_farmacia`, `delegacion` y `farmacia_referencia` sin Express/SQL en `backend/src/modules/usuarios/domain/identity.ts`; estados ACTIVO/INACTIVO, ACTIVA/SUSPENDIDA/REVOCADA y VIGENTE/EXPIRADA/REVOCADA según `data-model.md`. [F01-FR-005–007]
- [X] T015 [P] Definir puertos de repositorio, sesión, reloj, hashing y auditoría para las cuatro historias en `backend/src/modules/usuarios/application/ports.ts`; ninguna concesión global automática. [F01-FR-005, F01-FR-014]
- [X] T016 Validar configuración F01, origen/cookie local loopback y denegación de secretos en `VITE_*` en `backend/src/config/identity.ts`. [F01-FR-013, F01-FR-020]

**Checkpoint**: T007–T016 completadas como base técnica de identidad y RLS; las operaciones US3 conservan sus propias pruebas y puertas.

## Phase 3: User Story 1 — Registro, identidad y sesión (P1, MVP)

**Goal**: Registro ordinario sin membresía, login/logout, perfil propio y sesiones revocables.
**Independent Test**: Con datos ficticios, registro→login→perfil→logout; registro duplicado, cuenta inactiva, contraseña incorrecta, sesión vencida/revocada, CSRF y abuso se rechazan; consulta pública sigue accesible.

### Tests for US1 — antes de implementación

- [X] T017 [US1] Especificar pruebas unitarias de correo canónico, autorregistro solo CLIENTE, duplicados y estados de usuario en `backend/tests/identity/registration.unit.test.ts`. [F01-FR-001, F01-SC-001]
- [X] T018 [P] [US1] Especificar pruebas de hash Argon2id, sal individual, verificación y manejo de parámetros obsoletos con reloj/datos ficticios en `backend/tests/identity/password.unit.test.ts`; depende de T002 satisfactorio. [F01-FR-013]
- [X] T019 [P] [US1] Especificar pruebas de sesión opaca, expiración inactiva/absoluta, revocación, rotación y revalidación de usuario en `backend/tests/identity/session.unit.test.ts`. [F01-FR-003, F01-SC-002]
- [X] T020 [US1] Especificar contratos HTTP positivos/negativos de `/auth/csrf`, `/auth/register`, `/auth/login`, `/auth/logout`, `/auth/session` y perfil propio en `backend/tests/identity/auth.http.test.ts`, incluidos 400/401/403/429 y abuso repetido según umbral, ventana y ámbito aprobados, sin enumeración ni secretos. El 409 corresponde a las operaciones de membresía que lo definen en OpenAPI y se verifica en T043 tras sus puertas. [F01-FR-001–004, F01-FR-013, F01-FR-019]

### Implementation for US1

- [X] T021 [US1] Implementar adaptador de hash y verificación Argon2id solo después de T002/T003, con sal por credencial y formato versionado en `backend/src/modules/usuarios/infrastructure/argon2-password.ts`. [F01-FR-013]
- [X] T022 [US1] Implementar repositorios parametrizados de identidad global y sesión con PostgreSQL oficial en `backend/src/modules/usuarios/infrastructure/identity-repository.ts`. [F01-FR-001–003, F01-FR-015]
- [X] T023 [US1] Implementar casos de registro, login, logout, perfil y revocación/expiración en `backend/src/modules/usuarios/application/identity-use-cases.ts`, con usuario inactivo y duplicado denegados. [F01-FR-001–004, F01-FR-013]
- [X] T024 [US1] Implementar cookie opaca HttpOnly/Secure, excepción HTTP solo loopback, pre-sesión, token CSRF/Origin de mutaciones y control de intentos abusivos de login/registro en `backend/src/modules/usuarios/presentation/auth-middleware.ts`; aplicar únicamente umbral, ventana y ámbito aprobados y satisfacer T020 sin enumerar cuentas. [F01-FR-002–003, F01-FR-013]
- [X] T025 [US1] Exponer rutas y DTO mínimos de identidad del contrato OpenAPI, sin contraseñas ni token bruto, en `backend/src/modules/usuarios/presentation/auth-router.ts`; integrar en `backend/src/app.ts` sin alterar `/health`. [F01-FR-004, F01-FR-012, F01-FR-019]
- [X] T026 [P] [US1] Crear interfaz React de registro, acceso, estado de sesión y cierre con errores genéricos en `frontend/src/identity/AuthView.jsx`. [F01-FR-001–004]
- [X] T027 [US1] Integrar `AuthView` con cliente de sesión/CSRF sin guardar credenciales en `localStorage` ni bundle en `frontend/src/identity/session-client.js` y `frontend/src/main.jsx`. [F01-FR-003, F01-FR-013]
- [X] T028 [US1] Conectar auditoría mínima de registro/login/logout y denegaciones sin secretos en `backend/src/modules/usuarios/infrastructure/audit-repository.ts`. [F01-FR-014, F01-SC-005]
- [X] T029 [US1] Ejecutar pruebas US1 y registrar comando, versión, esperado/obtenido, fallos y estado de sesión/secretos en `specs/002-f01-identidad-multitenant/implementation-evidence.md`; no declarar US1 completa si falta PostgreSQL real. [F01-SC-001–002, F01-SC-005]

**Checkpoint**: T017–T029 completadas con pruebas locales US1; E2E y aceptación final siguen pendientes.

## Phase 4: User Story 2 — Membresías propias y farmacia activa (P1)

**Goal**: Seleccionar entre membresías propias activas sin trasladar permisos entre A y B.
**Independent Test**: Usuario con A/B ve ambas, cambia a B y conserva solo rol/delegaciones B; usuario de A, miembro revocado o farmacia inactiva no acceden a B.

### Tests for US2 — antes de implementación

- [X] T030 [US2] Especificar pruebas de membresía con cero/una/varias farmacias, estados y selector sin autoasignación en `backend/tests/identity/membership.unit.test.ts`. [F01-FR-005–007]
- [X] T031 [P] [US2] Especificar contratos HTTP de `/me/memberships` y `/me/active-pharmacy` para A/B, ID manipulado, revocación y farmacia inactiva en `backend/tests/identity/membership.http.test.ts`. [F01-FR-006–007, F01-FR-019]
- [X] T032 [US2] Especificar integración de lectura RLS de membresías propias y ausencia de filas ajenas con PostgreSQL y rol app real en `backend/tests/identity/membership.rls.test.ts`. [F01-FR-016–018, F01-SC-003–004]

### Implementation for US2

- [X] T033 [US2] Implementar repositorio de lectura de membresías propias y farmacia de referencia activa sobre política RLS acotada en `backend/src/modules/usuarios/infrastructure/membership-repository.ts`. [F01-FR-005–007, F01-FR-016]
- [X] T034 [US2] Implementar selección y revalidación en cada operación, sin autoridad procedente de `farmacia_id` del cliente, en `backend/src/modules/usuarios/application/active-pharmacy.ts`. [F01-FR-006–007, F01-FR-010]
- [X] T035 [US2] Exponer endpoints de membresías propias y farmacia activa con denegación uniforme de B en `backend/src/modules/usuarios/presentation/membership-router.ts`. [F01-FR-006, F01-FR-019]
- [X] T036 [P] [US2] Crear selector React que muestre solo establecimientos autorizados y estados denegado/expirado en `frontend/src/identity/PharmacySelector.jsx`. [F01-FR-006–007]
- [X] T037 [US2] Conectar selector y sesión visible sin persistir rol como autoridad en `frontend/src/identity/session-client.js`. [F01-FR-005–006]
- [X] T038 [US2] Demostrar en PostgreSQL real, API y pool concurrente que A/B no mezclan permisos y que revocación surte efecto en la siguiente operación en `backend/tests/identity/membership-isolation.test.ts`. [F01-FR-017–018, F01-SC-003–004]
- [X] T039 [US2] Registrar resultados A/B, rol, delegación, revocación y conexión reutilizada con datos ficticios en `specs/002-f01-identidad-multitenant/implementation-evidence.md`. [F01-SC-003–004]

**Checkpoint**: T030–T039 completadas con pruebas locales US2 y A/B; E2E y aceptación final siguen pendientes.

## Phase 5: User Story 3 — Concesión restringida y auditoría (P1)

**Goal**: Gestionar roles/membresías de terceros solo dentro del ámbito autorizado y sin autoelevación.
**Independent Test**: Tras ratificar puertas, dueño/admin de A con permiso modifica un trabajador de A y deja auditoría; trabajador, cliente, actor sobre sí mismo y admin de A sobre B quedan denegados sin cambio de fila.
**Puertas vigentes**: EXC-01 y ROL-01 aprobadas; T042–T049 completadas con pruebas locales de autorización, HTTP, RLS y UI. GLO-01 prohíbe concesiones globales y BOOT-01 permite solo diseño; T050–T051 siguen bloqueadas.

### Gates y tests para US3

- [X] T040 [US3] Obtener ratificación humana expresa de la discrepancia del maestro capítulo 27 y registrar su alcance sin reescribirlo en `specs/002-f01-identidad-multitenant/authorization-decisions.md`. Ratificada EXC-01 el 2026-11-12; tarea documental, no implementación. [F01-FR-008]
- [X] T041 [US3] Definir y aprobar catálogo exacto de roles delegables y jerarquía dueño/admin/trabajador en `specs/002-f01-identidad-multitenant/authorization-decisions.md`, sin inferir permisos del nombre del rol. Aprobado únicamente `TRABAJADOR` el 2026-11-12; tarea documental, no implementación. [F01-FR-008–011]
- [X] T042 [US3] Escribir primero pruebas de matriz local para `TRABAJADOR`: permiso explícito y membresía activa del actor en A, objetivo distinto, autoelevación, rol igual/superior, ausencia de permiso y B denegados, sin capacidades de negocio, en `backend/tests/identity/authorization.unit.test.ts`. [F01-FR-008–011, F01-SC-006]
- [X] T043 [US3] Revisar primero el contrato local para limitar positivos a listado, concesión y revocación de `TRABAJADOR`; probar por HTTP CSRF, 401/403/404/409, rol no delegable, cambio no autorizado y ausencia de fuga en `backend/tests/identity/admin-memberships.http.test.ts`. Las operaciones de delegación o concesión global no adquieren positivo por este contrato. [F01-FR-008–009, F01-FR-019]
- [X] T044 [US3] Escribir primero integración PostgreSQL de `USING`/`WITH CHECK` para concesión/revocación de `TRABAJADOR`, A/B, autoelevación, rol superior denegado, revocación y auditoría en `backend/tests/identity/admin-memberships.rls.test.ts`; no usar usuarios reales ni alta inicial privilegiada operativa. [F01-FR-008–009, F01-FR-016–018]

### Implementation for US3 — tras gates y tests

- [X] T045 [US3] Tras T042, implementar política de concesión/revocación local solo de `TRABAJADOR` que evalúe actor, objetivo distinto, permiso explícito, membresía activa, recurso y farmacia A en `backend/src/modules/usuarios/domain/grant-policy.ts`. [F01-FR-005, F01-FR-008–011]
- [X] T046 [US3] Tras T044 y T055, añadir políticas SQL de mutación de membresía `TRABAJADOR` por tenant validado con `USING`/`WITH CHECK`, sin mutación de delegaciones, bypass ni política global universal, en `backend/migrations/f01/009_membership_mutations.sql` (001–008 ya están ocupadas). [F01-FR-015–017]
- [X] T047 [US3] Tras T042–T046, implementar casos de uso de concesión/revocación de `TRABAJADOR` de otras personas y auditoría atómica en `backend/src/modules/usuarios/application/manage-memberships.ts`; cualquier cambio a dueño/admin o capacidad de negocio se deniega. [F01-FR-008–009, F01-FR-014]
- [X] T048 [US3] Tras T043/T047, exponer solo rutas locales de `TRABAJADOR` del contrato revisado, con denegación cruzada y sin aceptar rol arbitrario, en `backend/src/modules/usuarios/presentation/admin-memberships-router.ts`. [F01-FR-008–009, F01-FR-019]
- [X] T049 [P] [US3] Tras contratos y pruebas locales, preparar vista React de gestión de `TRABAJADOR` restringida a la farmacia propia, sin decidir permisos en cliente, en `frontend/src/identity/MembershipAdmin.jsx`. [F01-FR-008–009]
- [ ] T050 [US3] BLOQUEADA (GLO-01): definir y obtener aprobación separada de catálogo de acciones globales, autoridad otorgante y procedimiento aplicable; BOOT-01 permite solo diseñar el alta inicial de dueños/admins, sin ejecutarlo. Registrar diseño y autorizaciones pendientes en `specs/002-f01-identidad-multitenant/authorization-decisions.md`; no crear ruta global universal ni fixtures privilegiados fuera de BD ficticia. [F01-FR-008, F01-FR-011]
- [ ] T051 [US3] BLOQUEADA (GLO-01; ejecución BOOT-01 no autorizada): solo tras T050 y nuevo plan/contrato global aprobados, especificar y comprobar autorización global acotada y auditoría sin heredar membresías locales en `backend/tests/identity/global-authorization.test.ts`; no implementar concesión global en este incremento. [F01-FR-008, F01-FR-011, F01-SC-006]

**Checkpoint**: T042–T049 verificadas para el alcance local TRABAJADOR. T050–T051 siguen bloqueadas y US3/F01-SC-006 no tienen aceptación completa mientras falten operaciones globales aprobadas, Playwright y revisión humana.

## Phase 6: User Story 4 — RLS, datos públicos y trazabilidad (P1)

**Goal**: Segunda barrera PostgreSQL y respuestas/auditoría sin secretos ni fuga entre farmacias.
**Independent Test**: Con A/B ficticias, acceso autorizado A positivo, acceso B y sin contexto denegados en API y SQL real; pool, rollback y concurrencia no filtran tenant. Las pruebas de mutación delegada de US3 dependen de sus gates.

### Tests for US4 — antes de implementación

- [X] T052 [US4] Definir pruebas SQL directas con rol app real para SELECT/INSERT/UPDATE/DELETE propios y ajenos, ausencia de contexto y cambios de `farmacia_id` en `backend/tests/identity/rls-direct.test.ts`; usar solo tablas F01. Los positivos de escritura se limitan a operaciones F01 permitidas por políticas base aprobadas; INSERT/UPDATE/DELETE de membresías o delegaciones de terceros se prueban como denegados y sus positivos quedan en T044 después de EXC-01/ROL-01. [F01-FR-016–018, F01-SC-004]
- [X] T053 [P] [US4] Definir pruebas de salida pública/privada y registros sin contraseña, token, cookie, membresía ajena o payload sensible en `backend/tests/identity/data-minimization.test.ts`. [F01-FR-012–014, F01-SC-005]
- [X] T054 [US4] Definir pruebas de fallo, rollback, reutilización del mismo cliente y solicitudes A/B concurrentes en `backend/tests/identity/pool-isolation.test.ts`. [F01-FR-017–018, F01-SC-003–004]

### Implementation and evidence for US4

- [X] T055 [US4] Completar políticas RLS por operación y tabla privada F01, `ENABLE`/`FORCE` donde aplique, grants mínimos y rechazo sin contexto en `backend/migrations/f01/004_rls_private.sql`; excluir mutación delegada hasta EXC-01/ROL-01. [F01-FR-016–017]
- [X] T056 [US4] Limitar DTO públicos de farmacia a campos permitidos, dejando CRUD de Farmacias fuera de F01, en `backend/src/modules/usuarios/presentation/public-projection.ts`. [F01-FR-004, F01-FR-012, F01-FR-020]
- [X] T057 [US4] Registrar denegaciones y correlación minimizada sin secretos ni existencia de B en `backend/src/modules/usuarios/infrastructure/audit-repository.ts`. [F01-FR-014, F01-SC-005]
- [X] T058 [US4] Ejecutar batería AC04 positiva/negativa de US1/US2/US4 con PostgreSQL real, dejando escenarios US3 bloqueados expresamente, y registrar matriz esperada/obtenida en `specs/002-f01-identidad-multitenant/implementation-evidence.md`. [F01-FR-018, F01-SC-004]
- [X] T059 [US4] Comprobar que el rol runtime no sea propietario, superusuario ni `BYPASSRLS` y que el acceso SQL ajeno falle incluso si se omite filtro HTTP, documentándolo en `specs/002-f01-identidad-multitenant/implementation-evidence.md`. [F01-FR-016–017]
- [X] T060 [US4] Revisar resultados de seguridad de respuestas, auditoría y errores indirectos FK/UNIQUE sin fuga de existencia ajena en `specs/002-f01-identidad-multitenant/implementation-evidence.md`. [F01-FR-012–014, F01-SC-005]
- [X] T061 [US4] Registrar que el criterio US4 completo y F01-SC-004 permanecen pendientes si faltan mutaciones delegadas bloqueadas o cualquier caso AC04 obligatorio en `specs/002-f01-identidad-multitenant/implementation-evidence.md`. [F01-FR-018, F01-SC-004]

## Phase 7: Polish & cross-cutting

- [ ] T062 [P] Añadir suite E2E F01 de registro, login, selector A/B, denegación y logout en `frontend/tests/identity/f01.spec.js`; ejecutar solo en entorno oficialmente compatible y no declarar Windows 10 oficialmente soportado. [F01-FR-018, F01-SC-001–004]
- [X] T063 [P] Revisar límites de módulos, Notificaciones independiente y ausencia de negocio ajeno en `backend/src/modules/README.md` y `specs/002-f01-identidad-multitenant/implementation-evidence.md`. [F01-FR-020, F01-SC-007]
- [X] T064 Ejecutar controles `check`, `build`, unitarias, HTTP, PostgreSQL y seguridad, además de `npm audit` sin `--force`, y registrar resultados reales en `specs/002-f01-identidad-multitenant/implementation-evidence.md`; no atribuir pruebas no ejecutadas. [F01-FR-018, F01-SC-001–007]
- [X] T065 Vincular cada F01-FR-001–020, escenario de US1–US4 y F01-SC-001–007 con evidencias reales y 16 criterios docentes sin inventar puntajes en `specs/002-f01-identidad-multitenant/evidence-traceability.md`. [F01-FR-018, F01-SC-001–007]
- [X] T066 Revisar `quickstart.md` con comandos que realmente existan, prerequisitos Windows 10, PostgreSQL real y Playwright pendiente si no hay entorno compatible en `specs/002-f01-identidad-multitenant/quickstart.md`. [F01-FR-018]
- [ ] T067 Preparar revisión humana final de plan, puertas EXC-01/GLO-01/ROL-01/BOOT-01, siete SC y limitaciones de aceptación en `specs/002-f01-identidad-multitenant/implementation-evidence.md`; no declarar F01 aceptada por tareas parciales. [F01-SC-001–007]

## Dependencies & Execution Order

- El presente `tasks.md` fue borrador anticipado y se revalidó frente al plan aprobado antes de código o instalación. La aprobación humana del 2026-11-11 limitó el primer incremento a T001–T006; la instrucción posterior autorizó T007–T016. La instrucción más reciente permite continuar F01 dentro del alcance aprobado, salvo decisiones expresamente pendientes. T001 registra la puerta, no la concede. El umbral, ventana y ámbito del control de abuso deben quedar aprobados antes de T020/T024. T002 es condición de T003, T018 y T021; si `argon2` falla, detenerse sin cambiar algoritmo.
- Setup T001–T006 precede Foundational T007–T016. T007 precede migraciones T008–T011; T012 precede T013. La fundación necesaria precede US1, US2 y US4.
- US1 T017–T029 prueba identidad/sesión de forma autónoma. US2 requiere sesión US1 y RLS de lectura propia, pero su criterio independiente es el cambio A/B. US4 requiere transacción y tablas privadas F01; sus pruebas no acreditan las mutaciones US3 bloqueadas.
- **Puertas documentales resueltas:** T040/T041 acreditan EXC-01/ROL-01; T042–T049 acreditan únicamente la operación local TRABAJADOR con pruebas reales. T050–T051 siguen bloqueadas por GLO-01/BOOT-01; T062 y T067 pendientes.
- T062 requiere entorno de navegador oficialmente compatible. T067 requiere evidencia de siete SC y revisión humana; F00 conserva sus propios pendientes.

### Parallel Opportunities

- T004 y T006 usan archivos distintos; T014/T015 y T030/T031 o T052/T053 solo pueden realizarse en paralelo después de sus prerrequisitos. T026 y T028 afectan frontend y backend separados.
- T042/T043 se prepararon en archivos distintos; T044 verificó los controles de base antes de T046. T045–T049 se cerraron tras sus pruebas correspondientes. T050–T051 no pueden ejecutarse como operaciones globales o alta inicial real en este incremento.

### Independent Test Criteria

| Story | Resultado independiente | Condición de cierre |
|---|---|---|
| US1 | Registro ordinario, sesión y perfil propios; fallos y revocación denegados | PostgreSQL real, Argon2id verificado y pruebas positivas/negativas. |
| US2 | A/B seleccionadas sin mezclar roles; ajenas/inactivas denegadas | RLS de lectura propia, pool y revocación probados. |
| US3 | Mutaciones locales y globales acotadas, auditadas, sin autoelevación | EXC-01/ROL-01/GLO-01/BOOT-01 según operación, más tests API y SQL. |
| US4 | Filas F01 aisladas y salidas públicas/registro mínimos | AC04 completo, PostgreSQL real y ausencia de escenarios bloqueados sin evidencia. |

### Requirement and Success Criterion Coverage

| Key | Task IDs | State |
|---|---|---|
| F01-FR-001 | T009, T017, T020, T022–T023, T025–T026 | US1. |
| F01-FR-002 | T020, T023–T025 | US1; control de abuso depende de parámetros aprobados. |
| F01-FR-003 | T009, T019–T025, T027 | US1. |
| F01-FR-004 | T020, T023, T025, T056 | US1/US4. |
| F01-FR-005 | T010, T014–T015, T030, T033–T034, T045 | T045 verificada con matriz de autorización local; resto no afectado. |
| F01-FR-006 | T010, T030–T031, T033–T037 | US2. |
| F01-FR-007 | T010, T014, T030–T034 | US2. |
| F01-FR-008 | T040–T051 | T040/T041 documentales; T042–T049 verificadas localmente para TRABAJADOR; T050/T051 bloqueadas. |
| F01-FR-009 | T040–T049 | Gestión local TRABAJADOR verificada con PostgreSQL y HTTP; globales bloqueadas. |
| F01-FR-010 | T034, T042, T045, T052 | T042/T045 verificadas localmente. |
| F01-FR-011 | T011, T050–T051 | Denegación global por defecto; concesión global prohibida en este incremento. Requiere decisión, contrato y plan adicionales antes de implementación. |
| F01-FR-012 | T025, T053, T056, T060 | US1/US4. |
| F01-FR-013 | T002, T004, T016, T018–T024, T027 | Depende de ARG-01 satisfactorio para hashing. |
| F01-FR-014 | T010, T015, T028, T047, T057 | T047 verificada con auditoría atómica y rollback negativo. |
| F01-FR-015 | T003, T007–T010, T022, T046 | T046 aplicada y verificada en PostgreSQL local ficticio. |
| F01-FR-016 | T011, T032, T044, T052, T055, T059 | T044 verificada en PostgreSQL real. |
| F01-FR-017 | T011–T013, T038, T044, T046, T052, T054–T055, T059 | T044/T046 verificadas en PostgreSQL local. |
| F01-FR-018 | T005, T012, T029, T032, T038, T044, T052–T054, T058, T062, T064–T066 | Aceptación completa pendiente de alcance global bloqueado, navegador compatible y revisión humana. |
| F01-FR-019 | T020, T025, T031, T035, T043, T048 | T043/T048 verificadas con rutas locales limitadas. |
| F01-FR-020 | T001, T004, T006, T010, T016, T056, T063 | Alcance F01. |
| F01-SC-001 | T017, T020, T029, T062, T065 | Evidencia futura. |
| F01-SC-002 | T019–T020, T029, T062, T065 | Evidencia futura. |
| F01-SC-003 | T032, T038, T054, T062, T065 | Evidencia futura. |
| F01-SC-004 | T032, T038, T044, T052, T054, T058–T059, T061–T062, T065 | Parte global de US3 bloqueada; operación local verificada. |
| F01-SC-005 | T028, T053, T057, T060, T065 | Evidencia futura. |
| F01-SC-006 | T042–T044, T047, T050–T051, T065 | Operación local TRABAJADOR verificada; globales bloqueadas. No hay aceptación completa. |
| F01-SC-007 | T006, T063, T065 | Revisión futura. |

## Implementation Strategy

T001–T049 y T052–T061, junto con T063–T066 y T068–T069, tienen evidencia de incrementos locales; T050–T051 siguen bloqueadas. T062 requiere navegador oficialmente compatible y T067 revisión humana. Esta estrategia no autoriza despliegue ni aceptación completa.

## Phase 8: Convergence

- [X] T068 Conectar las rutas de identidad y membresías propias ya implementadas a un proceso API F01 local mediante composición explícita de casos de uso y dos pools PostgreSQL no privilegiados y separados (auth/tenant); validar configuración y claves solo en servidor, preservar `/health` y el modo F00, y no habilitar mutaciones delegadas bloqueadas. [F01-FR-001–007, F01-FR-013, F01-FR-016–017, plan: integración API local] (missing)
- [X] T069 Ejecutar una comprobación reproducible con PostgreSQL ficticio y el proceso F01 compuesto: registro, login, perfil, membresías propias, cambio A/B permitido, denegación cruzada y logout; registrar comandos, versiones, resultados reales y límites sin secretos en `specs/002-f01-identidad-multitenant/implementation-evidence.md` y actualizar la guía local. [F01-FR-018–019, F01-SC-001–004, plan: verificación local] (partial)
