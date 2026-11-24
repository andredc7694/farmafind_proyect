# Tasks: F01.1 — Identidad y personal de farmacia

**Input**: [spec.md](spec.md), [plan.md](plan.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/identity-staff.openapi.yaml](contracts/identity-staff.openapi.yaml), [contracts/security.md](contracts/security.md), [quickstart.md](quickstart.md).
**Estado**: borrador de tareas — **pendiente de aprobación (Puerta 3)**. Spec y plan aprobados el 2026-11-23 (ver [approval.md](approval.md)). Ninguna tarea de código se ejecuta ni se marca sin aprobación de este archivo y sin evidencia real en `evidence.md`.
**Reglas**: solo PostgreSQL TEST efímero o fixture marcado; nunca `farmafind_f01_test`. Sin dependencias nuevas, sin AWS, sin correo real, sin Gemini. Un commit por lote probado. Pruebas desde PowerShell.

Formato: `- [ ] Txxx [P] [USn] descripción con ruta (requisitos)`. `[P]` = paralelizable (archivos distintos y sin dependencia incompleta).

## Phase 1: Setup y puertas

- [X] T001 Registrar la aprobación humana de `tasks.md` y su alcance en `specs/014-f011-identidad-personal/approval.md`; bloquear T002–T058 mientras falte (puerta SDD).
- [X] T002 Crear `specs/014-f011-identidad-personal/evidence.md` y `traceability.md` con la estructura MEJ→HU→RF→FR→prueba→evidencia, vacías de resultados (F011-FR-016).
- [X] T003 Registrar el contrato `specs/014-f011-identidad-personal/contracts/identity-staff.openapi.yaml` en `scripts/integration/check-openapi-routes.mjs` para que `npm run verify:contracts` lo contraste con las rutas Express (todas las FR); dejarlo en modo «pendiente de rutas» hasta T049.
- [X] T004 [P] Definir la configuración externa `F01_MFA_KEY_HEX` y su validación (longitud, no vacía, nunca registrada) en `backend/src/config/` y documentarla en `quickstart.md` sin valor real (F011-FR-012; Constitution XX).

## Phase 2: Foundation (migración, RLS y dominio compartido) — bloquea todas las historias

- [X] T005 [P] Escribir pruebas de la migración (aditiva, idempotente, CHECK «correo o alias», columnas nuevas) en `backend/tests/identity/f011-migration.test.ts` (FR-001, FR-015).
- [X] T006 Crear `backend/migrations/f01/011_staff_identity.sql` según [data-model.md](data-model.md): alteraciones de `usuario`, `sesion`, `abuse_attempt` y tablas `credencial_temporal`, `invitacion_personal`, `token_cuenta`, `mfa_totp`, `perfil_usuario`, `auditoria_identidad`, con `FORCE ROW LEVEL SECURITY`, permisos mínimos por columna a `f01_auth`/`f01_runtime` y sin `BYPASSRLS` (FR-001–016); depende de T005.
- [X] T007 Verificar T006 **solo** en PostgreSQL TEST efímero: roles sin `BYPASSRLS`, matriz Alfa/Beta, conexión reutilizada sin contexto residual, rechazo de lecturas/escrituras cruzadas, en `backend/tests/identity/f011-rls.test.ts` (FR-015; SC-004); bloquea las rutas de las historias hasta pasar; depende de T006.
- [X] T008 [P] Regresión de F01 con la migración aplicada: registro, login por correo, membresías y autorización global siguen igual, en `backend/tests/identity/f011-f01-regression.test.ts` reutilizando las suites existentes de `backend/tests/identity/` (SC-009); depende de T006.
- [X] T009 [P] Dominio: normalización y validación de alias (`^[a-z0-9][a-z0-9._-]{2,39}$`) con pruebas en `backend/src/modules/usuarios/domain/alias.ts` y `backend/tests/identity/f011-alias.unit.test.ts` (FR-001).
- [X] T010 [P] Dominio: política de clave temporal (generación con CSPRNG ≥128 bits, vigencia 24 h, un solo uso, bloqueo 15 min tras 5 fallos) con pruebas en `backend/src/modules/usuarios/domain/temporary-key-policy.ts` y `backend/tests/identity/f011-temporary-key.unit.test.ts` (FR-002–003).
- [X] T011 [P] Dominio: TOTP RFC 6238 con `node:crypto` (HMAC-SHA1, 6 dígitos, paso 30 s, ventana ±1, anti-repetición) y pruebas con los vectores oficiales del RFC en `backend/src/modules/usuarios/domain/totp.ts` y `backend/tests/identity/f011-totp.unit.test.ts` (FR-012).
- [X] T012 [P] Infraestructura: cifrado AES-256-GCM del secreto TOTP (nonce único, clave externa) con pruebas de ida y vuelta y de manipulación en `backend/src/modules/usuarios/infrastructure/secret-box.ts` y `backend/tests/identity/f011-secret-box.unit.test.ts` (FR-012); depende de T004.
- [X] T013 [P] Dominio: política de invitaciones y de permisos de personal (catálogo `reservation.*`, `inventory.*`; `personal.gestionar` no delegable; sin auto-concesión ni creación de propietario/administrador) con pruebas en `backend/src/modules/usuarios/domain/staff-policy.ts` y `backend/tests/identity/f011-staff-policy.unit.test.ts` (FR-005, FR-007; D-09).
- [X] T014 Infraestructura: repositorio de `auditoria_identidad` (catálogo cerrado, solo inserción, sin secretos) y ampliación de los ámbitos de abuso (`TEMP_KEY_ACCOUNT`, `RESET_ACCOUNT`, `RESET_IP`, `TOTP_ACCOUNT`, `STAFF_CREATE_IP`) en `backend/src/modules/usuarios/infrastructure/identity-audit-repository.ts` y `abuse-repository.ts`, con pruebas en `backend/tests/identity/f011-audit.test.ts` (FR-008; SC-008); depende de T006.
- [X] T015 [P] Infraestructura: puerto `AccountMessageDelivery` y adaptador simulador local (JSON-lines en `.cache/f01-mailbox/`, ignorado por Git, llamado después del commit, fallo no revierte) más `scripts/f01/mailbox.mjs`, con pruebas en `backend/src/modules/usuarios/infrastructure/mailbox-simulator.ts` y `backend/tests/identity/f011-mailbox.test.ts` (FR-010; D-06 opción A).
- [X] T016 Middleware de sesión restringida (`CAMBIO_CLAVE`, `MFA_PENDIENTE`): solo rutas permitidas por [security.md](contracts/security.md) §6, con pruebas HTTP en `backend/src/modules/usuarios/presentation/auth-middleware.ts` y `backend/tests/identity/f011-restricted-session.http.test.ts` (FR-003, FR-012); depende de T006.

## Phase 3: User Story 1 — El propietario crea la cuenta de un trabajador (P1) 🎯 MVP

**Objetivo**: alta de personal con alias, clave temporal de un solo uso y primer ingreso con cambio obligatorio.
**Prueba independiente**: en Alfa se crea `alfa.caja1`, entra con la clave temporal, queda restringido hasta cambiarla y luego solo ve Alfa.

- [X] T017 [P] [US1] Pruebas HTTP de creación de personal (201 con clave una sola vez, 409 genérico, límites, 403 a trabajador, 404 a propietario de Beta) en `backend/tests/identity/f011-staff-create.http.test.ts` (FR-001–002, FR-007).
- [X] T018 [US1] Caso de uso `CreateStaffAccount` con Unit of Work: usuario con alias y hash ficticio inutilizable, membresía `TRABAJADOR`, capacidades iniciales, `credencial_temporal`, perfil y auditoría atómicos, en `backend/src/modules/usuarios/application/create-staff-account.ts` y su repositorio SQL (FR-001–002, FR-008, FR-015); depende de T007, T009, T010, T013, T014.
- [X] T019 [US1] Login por «usuario o correo» manteniendo el campo `email` histórico; con clave temporal vigente la consume (un solo uso) y abre sesión `CAMBIO_CLAVE`; respuesta uniforme ante fallo y bloqueo por intentos, en `backend/src/modules/usuarios/application/identity-use-cases.ts` y `presentation/auth-router.ts` (FR-002–003; SC-002); depende de T016, T018.
- [X] T020 [US1] Caso de uso y ruta `POST /auth/password/change-temporary` (nueva clave Argon2id, libera la restricción, cierra otras sesiones, auditoría `PASSWORD_CHANGE`), en `backend/src/modules/usuarios/application/change-password.ts` y `presentation/auth-router.ts` (FR-003); depende de T019.
- [X] T021 [US1] Rutas `GET/POST /pharmacies/{id}/staff` y `GET` de personal sin hashes ni claves, con CSRF y contexto tenant validado en servidor, en `backend/src/modules/usuarios/presentation/staff-router.ts` (FR-001, FR-015); depende de T018.
- [X] T022 [P] [US1] Interfaz: «Mi farmacia > Personal» (crear, ver la clave temporal una sola vez con advertencia) en `frontend/src/identity/StaffAdmin.jsx` y `staff-client.js`, ampliando `MembershipAdmin.jsx` sin romperla (FR-001–002); depende de T021.
- [X] T023 [P] [US1] Interfaz: login con «Usuario o correo» y pantalla de cambio obligatorio de clave en `frontend/src/identity/AuthView.jsx` y `ForcedPasswordChange.jsx` (FR-003); depende de T020.
- [X] T024 [US1] Verificar US1 en PostgreSQL TEST: alta, primer ingreso, reuso/vencimiento (avance de reloj controlado), bloqueo 15 min, aislamiento Alfa/Beta, en `backend/tests/identity/f011-us1.rls.test.ts` y `frontend/tests/f011-staff-create.test.jsx` (SC-001–002, SC-004); depende de T021–T023.

## Phase 4: User Story 2 — Vincular cuenta existente y gestionar permisos (P1)

**Objetivo**: invitación aceptada por la persona, permisos granulares y revocación inmediata.
**Prueba independiente**: una cuenta existente acepta una invitación de Alfa; el propietario concede y revoca un permiso; la siguiente petición del trabajador se deniega.

- [X] T025 [P] [US2] Pruebas HTTP de invitaciones (respuesta 202 uniforme exista o no la cuenta, solo el destinatario las ve, aceptar/rechazar/vencer/revocar, doble aceptación concurrente) en `backend/tests/identity/f011-invitations.http.test.ts` (FR-004; SC-007).
- [X] T026 [US2] Casos de uso `InviteStaff`, `RespondInvitation` y `RevokeInvitation` (membresía creada solo al aceptar, sin fusión de identidades, auditoría) con repositorio SQL y RLS en `backend/src/modules/usuarios/application/invitations.ts` (FR-004, FR-008); depende de T007, T013, T014, T015.
- [X] T027 [US2] Caso de uso `UpdateStaffCapabilities` (reemplazo atómico sobre `delegacion`, sin auto-concesión, auditoría `CAPABILITY_GRANT/REVOKE`) y revocación de membresía con cierre de sesiones si queda sin membresías y limpieza de farmacia activa (D-08), en `backend/src/modules/usuarios/application/manage-staff-capabilities.ts` (FR-005–007); depende de T026.
- [X] T028 [US2] Rutas de invitaciones (`/pharmacies/{id}/staff/invitations`, `/me/invitations*`) y de capacidades en `backend/src/modules/usuarios/presentation/staff-router.ts` (FR-004–006); depende de T026–T027.
- [X] T029 [P] [US2] Interfaz: lista y gestión de invitaciones y permisos en `frontend/src/identity/StaffAdmin.jsx` y «Mis invitaciones» en `frontend/src/identity/MyInvitations.jsx` (FR-004–005); depende de T028.
- [X] T030 [US2] Verificar US2: revocar y reintentar en la siguiente petición (reservas e inventario F02/F04), intentos de elevación, cruce Alfa/Beta, en `backend/tests/identity/f011-us2.rls.test.ts` y `frontend/tests/f011-invitations.test.jsx` (SC-003–004); depende de T028–T029.

## Phase 5: User Story 3 — Acceso reforzado y recuperación segura (P1)

**Objetivo**: verificación de correo, restablecimiento y recuperación de personal sin correo.
**Prueba independiente**: con simulador local, un usuario con correo restablece su clave; un trabajador sin correo recupera acceso con una nueva clave temporal.

- [X] T031 [P] [US3] Pruebas HTTP de restablecimiento y verificación (respuestas indistinguibles, un solo uso, caducidad 30 min/24 h, otras sesiones cerradas, límites) en `backend/tests/identity/f011-recovery.http.test.ts` (FR-010; SC-007).
- [X] T032 [US3] Casos de uso `RequestPasswordReset`, `ConfirmPasswordReset` y `VerifyEmail` con `token_cuenta` (solo hash SHA-256), comparación ficticia cuando la cuenta no existe y entrega por el puerto, en `backend/src/modules/usuarios/application/account-recovery.ts` (FR-010); depende de T007, T014, T015.
- [X] T033 [US3] Caso de uso y ruta `POST /pharmacies/{id}/staff/{userId}/temporary-key` (reemisión que invalida la anterior, solo propietario/administrador autorizado de esa farmacia) en `backend/src/modules/usuarios/application/issue-temporary-key.ts` y `presentation/staff-router.ts` (FR-011); depende de T018.
- [X] T034 [US3] Rutas `/auth/password/reset/request|confirm` y `/auth/email/verify` con CSRF y `no-store` en `backend/src/modules/usuarios/presentation/auth-router.ts` (FR-010); depende de T032.
- [X] T035 [P] [US3] Interfaz: «Olvidé mi clave», confirmación con token y botón «Emitir nueva clave temporal» en `frontend/src/identity/PasswordReset.jsx` y `StaffAdmin.jsx` (FR-010–011); depende de T033–T034.
- [X] T036 [US3] Verificar US3 con el simulador (`scripts/f01/mailbox.mjs`) y negativos de enumeración y reuso en `backend/tests/identity/f011-us3.rls.test.ts` y `frontend/tests/f011-recovery.test.jsx` (SC-002, SC-007–008); depende de T034–T035.

## Phase 6: User Story 4 — Administradores solo por provisión técnica y con segundo factor (P2)

**Objetivo**: cero vías de ascenso desde la aplicación y TOTP obligatorio para administradores generales.
**Prueba independiente**: un administrador provisionado en TEST no opera `/platform/**` sin segundo factor; ninguna ruta crea administradores.

- [X] T037 [P] [US4] Pruebas HTTP de enrolamiento, verificación y exigencia de MFA en `/platform/**`, reuso de código, límites y ausencia de rutas de ascenso en `backend/tests/identity/f011-mfa.http.test.ts` y `f011-no-elevation.http.test.ts` (FR-009, FR-012; SC-005–006).
- [X] T038 [US4] Casos de uso `EnrollMfa`, `ActivateMfa` y `VerifyMfa` con secreto cifrado, `ultimo_paso_usado` y límite `TOTP_ACCOUNT`, en `backend/src/modules/usuarios/application/mfa.ts` y repositorio SQL (FR-012); depende de T007, T011, T012, T014.
- [X] T039 [US4] Marcar sesiones de administrador general como `MFA_PENDIENTE` al iniciar y exigir `mfa_verificada_at` en las rutas `/platform/**` existentes, sin cambiar sus contratos, en `backend/src/modules/usuarios/presentation/platform-authorization-router.ts` y `auth-middleware.ts` (FR-012); depende de T016, T038.
- [X] T040 [US4] Rutas `/me/mfa/enroll`, `/me/mfa/activate` y `/auth/mfa/verify` en `backend/src/modules/usuarios/presentation/mfa-router.ts` (FR-012); depende de T038.
- [X] T041 [US4] Procedimiento técnico offline de reinicio del segundo factor `scripts/f01/reset-mfa.mjs` (expediente local ignorado por Git, solo bases TEST marcadas, auditoría `MFA_RESET`, sin ruta ni pantalla) y su documentación en `quickstart.md`, con prueba en `backend/tests/identity/f011-reset-mfa.test.ts` (FR-009, FR-012; D-05); depende de T038.
- [X] T042 [P] [US4] Interfaz mínima de enrolamiento y verificación del segundo factor en `frontend/src/identity/MfaEnroll.jsx` (FR-012); depende de T040.
- [X] T043 [US4] Verificar US4: matriz de elevación (propietario, trabajador, cliente), administrador con y sin MFA, reuso de código y reinicio técnico en TEST, en `backend/tests/identity/f011-us4.rls.test.ts` (SC-004–006); depende de T039–T042.

## Phase 7: User Story 5 — Perfil y seguridad personal (P2)

**Objetivo**: perfil editable y gestión de la propia seguridad sin tocar permisos.
**Prueba independiente**: un usuario cambia datos, correo (con reverificación), clave y cierra otras sesiones.

- [ ] T044 [P] [US5] Pruebas HTTP del perfil, cambio de correo, cambio de clave y sesiones propias (reautenticación, no editar roles, no ver sesiones ajenas) en `backend/tests/identity/f011-profile.http.test.ts` (FR-013–014).
- [ ] T045 [US5] Casos de uso `GetProfile`, `UpdateProfile`, `RequestEmailChange`, `ChangeOwnPassword` y `ManageOwnSessions` con `perfil_usuario`, `token_cuenta` y auditoría, en `backend/src/modules/usuarios/application/profile.ts` (FR-013–014); depende de T007, T015, T032.
- [ ] T046 [US5] Rutas `/me/profile`, `/me/email/change`, `/me/password` y `/me/sessions*` en `backend/src/modules/usuarios/presentation/profile-router.ts` (FR-013); depende de T045.
- [ ] T047 [P] [US5] Interfaz: pantalla «Mi perfil» (datos, avatar predefinido, tema, notificaciones, correo, clave, sesiones) en `frontend/src/identity/Profile.jsx` y `profile-client.js` (FR-013–014); depende de T046.
- [ ] T048 [US5] Verificar US5 incluyendo el cierre de otras sesiones y la imposibilidad de editar permisos, en `backend/tests/identity/f011-us5.rls.test.ts` y `frontend/tests/f011-profile.test.jsx` (SC-004, SC-008); depende de T046–T047.

## Phase 8: Polish, seguridad y aceptación

- [ ] T049 [P] Registrar las 25 operaciones nuevas en `backend/src/` (composición Express) y completar el contrato si la implementación difiere, ejecutando `npm run verify:contracts` hasta que cada operación tenga ruta (FR-001–014); depende de T021, T028, T034, T040, T046.
- [ ] T050 [P] Prueba transversal «sin secretos»: buscar claves temporales, tokens y secretos TOTP en auditoría, logs, respuestas posteriores y volcados de prueba, en `backend/tests/identity/f011-no-secrets.test.ts` (FR-008; SC-008); depende de T024, T030, T036, T043, T048.
- [ ] T051 [P] Matriz de ataques Alfa/Beta completa de [security.md](contracts/security.md) con conexiones reutilizadas y roles directos en `backend/tests/identity/f011-attack-matrix.rls.test.ts` (FR-015; SC-004); depende de T024, T030, T043.
- [ ] T052 Regresión: `npm run check`, `npm run build`, `verify:contracts`, F01 (`api`, `rls`), F02, F03, F04 y F05 sin cambios de comportamiento, con resultados reales en `evidence.md` (SC-009); depende de T049–T051.
- [ ] T053 Recorridos E2E de navegador en Playwright Linux (alta y primer ingreso, invitación y revocación, recuperación, administrador con MFA, perfil) en `frontend/e2e/f011-identity.spec.js` y `scripts/f011/run-browser-linux.mjs`, solo sobre fixture TEST marcado y sin tocar `farmafind_f01_test` (SC-001–007); depende de T052.
- [ ] T054 [P] Medir el costo de verificación Argon2id en login y cambio de clave (tiempo/memoria con los parámetros F01) y registrarlo en `evidence.md` sin inventar umbrales (plan: Performance Goals); depende de T024.
- [ ] T055 Ejecutar la DEMO manual en TEST con Alfa/Beta ficticias y preparar la guía de revisión humana (usuarios, contraseñas de prueba, pasos) para el responsable (SC-001–009); depende de T053.
- [ ] T056 Actualizar `traceability.md` con MEJ-015–017/019, HU23–25/27, RF37–41/44–45, AC10–11 y los 16 criterios docentes, con evidencias reales y sin puntajes presumidos (todas las FR/SC); depende de T052–T055.
- [ ] T057 Ejecutar *analyze* y *converge* de Spec Kit, registrar diferencias contra la spec en `specs/014-f011-identidad-personal/convergence.md` y corregir contradicciones (todas las FR); depende de T056.
- [ ] T058 Preparar `specs/014-f011-identidad-personal/acceptance.md` y solicitar la aceptación humana de F01.1; registrar la decisión y los pendientes solo cuando Andre responda; **nunca autoaprobar**; depende de T057.

## Dependencies and parallel work

- **Orden de fases**: Phase 1 → Phase 2 → US1 (MVP) → US2 → US3 → US4 → US5 → Phase 8. US2–US5 dependen de la base de Phase 2; US3 reutiliza T018 (T033) y US5 reutiliza T032 (T045).
- **Bloqueos duros**: T001 (aprobación de tareas) bloquea todo; T006/T007 bloquean cualquier ruta; T016 bloquea login con restricción; T049 se ejecuta cuando existan todas las rutas.
- **Paralelo en Phase 2**: T005, T008, T009, T010, T011, T013 y T015 en archivos distintos; T012 tras T004; T014 y T016 tras T006.
- **Paralelo por historia**: pruebas `[P]` (T017, T025, T031, T037, T044) y las pantallas React `[P]` pueden prepararse junto a la implementación del backend de su historia.
- **Entrega por lotes (commits locales)**: L1 = T001–T016; L2 = US1 (T017–T024); L3 = US2; L4 = US3; L5 = US4; L6 = US5; L7 = Phase 8. Cada lote se commitea solo tras pasar sus pruebas.

**MVP sugerido**: Phase 1–2 + US1 + US2 con pruebas de aislamiento (alta de personal, primer ingreso, vinculación y revocación). US3–US5 completan la recuperación, el segundo factor y el perfil sin rebajar los criterios finales. Ninguna casilla se marca sin prueba y evidencia; la aceptación T058 permanece separada y es solo de Andre.

## Notas de ejecución del lote 1 (2026-11-23)

Tareas T001–T016 marcadas con evidencia real en [evidence.md](evidence.md). Desviaciones de nombres y alcance respecto al texto original, necesarias por `scripts/f01/check.mjs` (clasifica por sufijo) y por lo hallado en el código:
- T005 → `f011-migration.rls.test.ts`; T007 → `f011-isolation.rls.test.ts`; T014 → `f011-audit.rls.test.ts` (+ presupuesto de abuso); T015 → `f011-mailbox.unit.test.ts`; T016 → `f011-restricted-session.http.test.ts` y `f011-restricted-session.rls.test.ts`.
- T008 se cumplió ejecutando las suites F01/F02/F03/F04 existentes con la migración 011 aplicada; no se creó un archivo nuevo.
- T003: el contrato se valida con `--f011-contract` (estructura) y `--f011-routes` (rutas; fallará hasta T049).
- T016: el bloqueo está en la transacción de identidad (`PgIdentityUnitOfWork.runWithClient`, punto por el que pasan todos los módulos) y en un guardia HTTP (`createRestrictedSessionGuard`); su **montaje** en la composición de la API se hace en T019/T039, cuando existan sesiones restringidas.
- Capacidad de gestión de personal: el código real usa `membership.manage` (no `personal.gestionar`); corregir en `research.md` al ejecutar *analyze*.

## Notas de ejecución del lote 2 (2026-11-23)

T017–T024 marcadas con evidencia real en [evidence.md](evidence.md). Desviaciones: T018 se implementó con funciones `SECURITY DEFINER` en `backend/migrations/f01/012_staff_functions.sql` (alta atómica con autorización dentro de la base) en vez de un repositorio SQL aparte; T024 se cubrió con `f011-us1.rls.test.ts` (HTTP + PostgreSQL con la app compuesta) y `frontend/tests/f011-staff-create.test.jsx`; el guardia de sesión restringida (T016) ya está montado (T019). Pendiente de decisión para *analyze*: 429 en `POST /staff` del contrato y nombre `membership.manage`.

## Notas de ejecución del lote 3 (2026-11-23)

T025–T030 marcadas con evidencia real en [evidence.md](evidence.md). Desviaciones: las operaciones de T026/T027 se implementaron como funciones `SECURITY DEFINER` en `backend/migrations/f01/013_staff_invitations.sql` (autorización dentro de la base); T027 incluye cambiar `PATCH …/memberships/{id}` para que cierre sesiones y revoque delegaciones; se aplicó la decisión A de la Puerta 6 (concesión directa retirada, 410), registrada en `approval.md`; el servicio y las rutas están en `application/manage-staff-access.ts` y `presentation/staff-access-router.ts`.

## Notas de ejecución del lote 4 (2026-11-23)

T031–T036 marcadas con evidencia real en [evidence.md](evidence.md). Desviaciones: T032/T033 se implementaron como funciones `SECURITY DEFINER` en `backend/migrations/f01/014_account_recovery.sql`; se añadió `POST /me/email/verification` al contrato (26 operaciones) para la solicitud autenticada de verificación; la vigencia de los tokens la calcula la base de datos (hallazgo de desfase de reloj); T036 usa `f011-us3.rls.test.ts` con el simulador local real (`FileMailboxSimulator`) y `frontend/tests/f011-recovery.test.jsx`.

## Notas de ejecución del lote 5 (2026-11-23)

T037–T043 marcadas con evidencia real en [evidence.md](evidence.md). Desviaciones: la exigencia de segundo factor en `/platform/**` se aplica **en la base de datos** (`f01.has_platform_permission` ahora exige `mfa_verificada_at` y sesión sin restricción, migración 015) y no solo en el router, sin cambiar los contratos de `/platform/**`; las transiciones sensibles son funciones `SECURITY DEFINER` (`begin_mfa_enrollment`, `complete_mfa`, `mfa_requirement`). Un administrador **sin** factor activo entra con sesión normal (puede enrolarse) pero `/platform/**` devuelve 403; con factor activo la sesión nace `MFA_PENDIENTE`. T041: la prueba se dividió en `f011-reset-mfa.unit.test.ts` (expediente y rechazo de bases no marcadas) y un caso de reinicio completo dentro de `f011-us4.rls.test.ts` (sufijos exigidos por `check.mjs`). T037: `f011-mfa.http.test.ts` y los casos «sin ruta de ascenso» están en `f011-us4.rls.test.ts` (no se creó `f011-no-elevation.http.test.ts`). El aviso de alta devuelve 409 si el factor ya está activo (añadido al contrato). Se actualizó el fixture de `bootstrap-authorization.rls.test.ts` (sus sesiones de administrador ahora nacen con segundo factor verificado, como exige la nueva regla).
