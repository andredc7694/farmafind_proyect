# Evidencia de implementación F01.1

Resultados **realmente ejecutados** (PowerShell, Windows 10, Node 24.17.0, PostgreSQL TEST local). Ninguna casilla de `tasks.md` se marca sin una fila aquí. La aceptación humana (T058) es solo de Andre.

## Lote 1 — T001–T016 (2026-11-23)

**Entorno:** PostgreSQL 18 TEST en `127.0.0.1:55431` con **fixture marcado** `F02_FIX01_TEST_ONLY` como conexión administrativa; cada suite crea y elimina su propia base efímera `farmafind_f01_test_<hex>` y su rol. **Sin ninguna operación sobre `farmafind_f01_test`**: sus suites exigen el fixture marcado y rechazan la base persistente (`scripts/f01/fixture-admin-url.mjs`). Contenedores encendidos por Claude y detenidos al terminar; sin borrar volúmenes. Docker sin Redis (no se usa en F01.1).

### Pruebas nuevas del lote (94 satisfactorias)

| Archivo | Tipo | Pruebas | Cubre |
|---|---|---|---|
| `f011-migration.rls.test.ts` | PostgreSQL | 7 | T005/T006: migración 011 aditiva e idempotente; «correo o alias»; alias válido/único; ámbitos de abuso; RLS forzada en 6 tablas; roles sin BYPASSRLS; vigencias (24 h, 7 días) |
| `f011-isolation.rls.test.ts` | PostgreSQL | 7 | T007: invitaciones, credencial temporal, auditoría, perfil, segundo factor y tokens aislados Alfa/Beta; conexión reutilizada sin contexto residual |
| `f011-audit.rls.test.ts` | PostgreSQL | 5 | T014: auditoría de catálogo cerrado (19 acciones), rechazo de campos libres/secretos, actor verificado por la base, presupuesto de abuso por ámbito, solo HMAC en la base |
| `f011-restricted-session.rls.test.ts` | PostgreSQL | 5 | T016: sesión `CAMBIO_CLAVE`/`MFA_PENDIENTE` no ejecuta operaciones de negocio en la transacción de identidad; pool reutilizable |
| `f011-restricted-session.http.test.ts` | HTTP | 16 | T016: lista permitida, 403 uniforme, `no-store`, consulta no evade la lista, falla cerrado (503), cookie inválida |
| `f011-totp.unit.test.ts` | unitaria | 13 | T011: vectores oficiales RFC 6238 (6), ventana ±1, anti-repetición, formato, URI |
| `f011-alias.unit.test.ts` | unitaria | 19 | T009: normalización, límites 3–40, alias inválidos, correo vs alias |
| `f011-temporary-key.unit.test.ts` | unitaria | 6 | T010: 160 bits, 24 h, un solo uso, bloqueo 15 min tras 5 fallos |
| `f011-staff-policy.unit.test.ts` | unitaria | 6 | T013: catálogo delegable = códigos reales de F02/F04, sin auto-concesión, solo TRABAJADOR |
| `f011-secret-box.unit.test.ts` | unitaria | 5 | T012 y T004: AES-256-GCM (contexto, nonce, manipulación) y validación de `F01_MFA_KEY_HEX` sin revelar valores |
| `f011-mailbox.unit.test.ts` | unitaria | 5 | T015: simulador local, solo bajo `.cache`, entrega posterior al commit sin propagar fallos |

### Regresión (T008) — resultados reales tras los cambios del lote

| Comprobación | Resultado |
|---|---|
| `node scripts/f01/check.mjs unit` | 17 archivos, **111/111** (antes del lote: 57) |
| `node scripts/f01/check.mjs api` | 6 archivos, **42/42** (antes: 26) |
| `node scripts/f01/check.mjs rls` (fixture marcado) | 14 archivos, **76/76** (antes: 66) |
| `test:f02:unit` / `test:f02:rls` | 15/15 · 15/15 |
| `test:f03:unit` / `test:f03:rls` | 25/25 · 4/4 |
| `test:f04:unit` / `test:f04:api` | 18/18 · 6/6 |
| `scripts/f025/check-f04-rls.mjs` (clúster F02.5; detenido al terminar) | 18/18 |
| `f021-rls.test.ts` (fixture) | 3/3 |
| `npm run check` | correcto (238 archivos JS, TypeScript estricto, límites modulares) |
| `npm run build` | correcto |
| `npm run verify:contracts` | 41 operaciones con ruta Express (sin cambios) |
| `check-openapi-routes.mjs --f011-contract` | 25 operaciones del contrato F01.1; sin duplicados ni referencias sin definir. `--f011-routes` falla a propósito («rutas pendientes») hasta T049 |

No se ejecutaron en este lote: Playwright/E2E (T053), F05 (`test:f05:*`), DEMO (T055).

## Cambios fuera de las tareas originales (autorizados por Andre: «ejecútalas con el fixture marcado como TEST, sin escrituras sobre farmafind_f01_test»)

1. **Protección de las suites PostgreSQL invertida**: 13 archivos (`backend/tests/identity/*.rls.test.ts` y afines, `inventory/rls-foundation`, `inventory/f021-rls`, `search/public-projection.rls`) ahora exigen un fixture marcado y rechazan `farmafind_f01_test`; `scripts/f01/check.mjs`, `scripts/f02/check.mjs` y `scripts/f03/check.mjs` obtienen la URL del fixture. La parte de F02/F03 está en la rama de F02.1 (commit `3f2f0ac`).
2. `backend/tests/identity/migrations.test.ts`: la lista esperada de migraciones incluye `011_staff_identity.sql`.

## Hallazgos del lote (para *analyze* y *converge*)

- **Permisos de columna de `sesion`**: el rol `f01_runtime` solo lee columnas concretas de `sesion` (migración 004). La primera ejecución de T016 falló con «permission denied for table sesion» al leer la columna nueva; se corrigió añadiendo el `GRANT SELECT` de las dos columnas nuevas en `011`. La prueba `f011-restricted-session.rls` lo cubre.
- **Código de permiso de gestión de personal**: el plan (D-09) lo nombró `personal.gestionar`; el código real usa **`membership.manage`** (delegado al propietario/administrador, EXC-01). La política F01.1 lo reutiliza y lo excluye del catálogo delegable. Corregir el nombre en `research.md` al ejecutar *analyze*.
- **Vinculación directa existente (F01/EXC-01)**: la ruta histórica `POST /pharmacies/{id}/memberships` concede la membresía a un `userId` conocido **sin aceptación del destinatario**. F011-FR-004 exige invitación aceptada. Decidir en US2 (T026/T028) si la ruta histórica se restringe o se deja solo para el flujo de invitación; no se modifica sin aprobación (afecta comportamiento F01 aceptado).
- **Dependencia de migración**: la transacción de identidad ahora lee `sesion.restringida_motivo`; toda base TEST usada con este código requiere la migración 011 (la DEMO de F02.1 sobre el fixture necesitará aplicarla; ver T055). La base persistente `farmafind_f01_test` no se toca ni se migra.
- **Nombres de archivos de prueba**: `scripts/f01/check.mjs` clasifica por sufijo (`.unit.test.ts`, `.http.test.ts`, `.rls.test.ts`); los archivos de T005, T007, T008, T014, T015 y T016 se nombraron en consecuencia (ver notas en `tasks.md`).

## Lote 2 — US1 «El propietario crea la cuenta de un trabajador» (T017–T024, 2026-11-23)

**Qué se implementó:** migración `012_staff_functions.sql` (funciones `SECURITY DEFINER` `f01.create_staff_account`, `f01.list_staff` y `f01.complete_password_change`, con autorización comprobada dentro de la base); login por «usuario o correo» con clave temporal de un solo uso (consumo atómico, 24 h, sesión restringida `CAMBIO_CLAVE`); casos de uso `ManageStaff` y `changeTemporaryPassword`; rutas `GET/POST /pharmacies/{id}/staff` y `POST /auth/password/change-temporary`; guardia de sesión restringida montada en la composición antes de cualquier ruta; React: `StaffAdmin`, `ForcedPasswordChange`, login «Usuario o correo electrónico».

### Pruebas nuevas (39 satisfactorias)

| Archivo | Tipo | Pruebas | Cubre |
|---|---|---|---|
| `f011-us1.rls.test.ts` | HTTP + PostgreSQL (app compuesta, roles reales sin BYPASSRLS) | 12 | T024: alta con clave una sola vez y hash Argon2id; listado sin secretos; alias repetido 409 genérico; entradas y capacidades inválidas 400; Beta no opera sobre Alfa (404) y anónimo 401; primer ingreso escribiendo la clave con minúsculas/espacios; sesión restringida bloqueada (403 `SESSION_RESTRICTED`) en rutas de negocio; reuso rechazado; cambio de clave (débil/extra 400, válido 204); el trabajador solo ve Alfa y no gestiona personal; clave definitiva válida; clave vencida rechazada; 5 fallos → 429 con `Retry-After` incluso con la clave correcta (la credencial queda sin consumir) |
| `f011-staff-create.http.test.ts` | HTTP (router con casos de uso simulados) | 17 | T017: CSRF/origen, sesión, mapeo de errores sin detalles internos, 409 genérico, `no-store`, cuerpo estricto |
| `f011-staff-create.test.jsx` | React/jsdom | 10 | T022/T023/T024: cliente, pantalla de personal (clave visible una sola vez y descartada al ocultar o cambiar de farmacia), cambio obligatorio de clave |

### Regresión tras el lote 2 (resultados reales)

| Comprobación | Resultado |
|---|---|
| `scripts/f01/check.mjs unit` / `api` / `rls` | 111/111 · **59/59** (antes 42) · **88/88** (antes 76) |
| `test:f02:unit` / `test:f02:rls` | 15/15 · 15/15 |
| `test:f03:unit` / `test:f03:rls` | 25/25 · 4/4 |
| `test:f04:unit` / `test:f04:api` / `check-f04-rls.mjs` (clúster F02.5, detenido al terminar) | 18/18 · 6/6 · 18/18 |
| `f021-rls.test.ts` | 3/3 |
| Frontend completo (`frontend/tests`) | 33 archivos, 103/103 |
| `npm run check` / `build` / `verify:contracts` | correctos (242 archivos JS; 41 operaciones) |

No se ejecutaron: Playwright/E2E (T053), F05, DEMO (T055). Contenedores encendidos por Claude y detenidos al terminar.

### Cambios a pruebas y código existentes (necesarios para el lote)

- `session-client.test.jsx`: la lista de métodos del cliente incluye `changeTemporaryPassword`; `migrations.test.ts`: la lista esperada incluye `011` y `012`.
- `AuthView.jsx`: el campo de acceso pasa de `type="email"` a texto con etiqueta «Usuario o correo electrónico» (la etiqueta sigue conteniendo «correo electrónico», que es lo que buscan los E2E de Playwright existentes; **no se volvieron a ejecutar**).
- El campo histórico `email` del login también acepta un alias (compatibilidad); `identifier` es el nombre nuevo.

### Hallazgos y desviaciones del lote 2 (para *analyze* y *converge*)

- **Limitación por creación de cuentas (contrato 429)**: `POST /staff` no aplica `STAFF_CREATE_IP` porque el rol de negocio no accede a la tabla de abuso; el propietario está autenticado y autorizado. El contrato (`identity-staff.openapi.yaml`) aún lista 429: **decidir** quitarlo del contrato o implementar el límite.
- **Bloqueo de la clave temporal (FR-002)**: se cumple con el límite de login existente (5 fallos / 15 min por cuenta e IP, `LOGIN_ACCOUNT`/`LOGIN_IP`); el ámbito `TEMP_KEY_ACCOUNT` queda reservado y sin usar. Probado con la clave correcta tras 5 fallos.
- **Funciones `SECURITY DEFINER`**: asumen que el propietario de la función escribe en tablas con `FORCE ROW LEVEL SECURITY` (migrador superusuario local, como `009/010` de F01). Un despliegue con otro modelo de propietario requeriría un rol definidor dedicado con políticas acotadas: decisión de seguridad diferida a la Puerta 6 antes de cualquier base persistente.
- **Tiempo uniforme**: el login verifica siempre un segundo hash Argon2id (real o ficticio) cuando la clave no es la definitiva. No se midió estadísticamente la indistinguibilidad (queda para T054/T051).
- **Costo de la guardia**: cada petición con cookie de sesión consulta la sesión una vez más (pool de autenticación) para saber si está restringida.
- **`research.md` D-09 / `data-model.md`**: mencionan `personal.gestionar` y solo la migración 011; la implementación usa `membership.manage` y añade `012`. Se corrigen al ejecutar *analyze*.

## Lote 3 — US2 «Vincular cuenta existente y gestionar permisos» (T025–T030, 2026-11-23)

**Decisión de seguridad previa (Puerta 6, opción A, mensaje «A» del 2026-11-23; ver `approval.md`):** se retira la concesión directa `POST /pharmacies/{id}/memberships`; la ruta se conserva solo para responder `410 Gone` (el contrato F01 histórico de la carpeta 002 no se modifica). La vinculación pasa únicamente por invitación aceptada.

**Qué se implementó:** migración `013_staff_invitations.sql` (funciones `SECURITY DEFINER`: `invite_staff`, `list_invitations`, `revoke_staff_invitation`, `list_my_invitations`, `accept_staff_invitation`, `decline_staff_invitation`, `set_staff_capabilities`, `revoke_staff_membership`); servicio `ManageStaffAccess`; `staff-access-router` (8 rutas); la revocación existente (`PATCH …/memberships/{id}`) ahora invoca `revoke_staff_membership` (revoca delegaciones y cierra sesiones si no queda membresía activa); React: invitaciones, permisos y revocación en «Personal de la farmacia», nueva pantalla «Mis invitaciones»; «Conceder rol TRABAJADOR» eliminado de la interfaz.

### Pruebas nuevas (37 satisfactorias)

| Archivo | Tipo | Pruebas | Cubre |
|---|---|---|---|
| `f011-us2.rls.test.ts` | HTTP + PostgreSQL (roles reales sin BYPASSRLS) | 9 | T030: invitar es silencioso (respuesta y cabeceras idénticas exista o no la cuenta; sin duplicados ni autoinvitación); destino enmascarado en el listado y sin el correo completo; Beta no ve, invita ni revoca en Alfa (404); solo la persona invitada ve y responde; **dos aceptaciones simultáneas → exactamente una 204 y una 409**, una sola membresía; permisos por reemplazo atómico (rechaza `membership.manage`, códigos desconocidos, cuerpo extra, trabajador, uno mismo y Beta); revocar la membresía deja delegaciones sin activar y **cierra las sesiones en la siguiente petición** (401); auditoría de las 6 acciones; reinvitar reactiva la misma membresía sin heredar permisos; rechazar/revocar/vencer impiden aceptar; trabajador no invita (403); concesión directa heredada → 410 |
| `f011-invitations.http.test.ts` | HTTP (router con casos de uso simulados) | 18 | T025: CSRF en las 5 mutaciones, 401, 202 sin cuerpo, cuerpos estrictos, UUID, fechas ISO sin correo completo, 204, mapeo de errores sin detalles |
| `f011-invitations.test.jsx` | React/jsdom | 10 | T029: cliente (CSRF, métodos, sin `grant`), invitar sin confirmar existencia, revocar invitación, editar permisos, revocación con segunda confirmación, errores, «Mis invitaciones» (aceptar/rechazar/vacío) |

### Regresión tras el lote 3 (resultados reales)

| Comprobación | Resultado |
|---|---|
| `scripts/f01/check.mjs unit` / `api` / `rls` | 111/111 · **77/77** (antes 59) · **97/97** (antes 88) |
| `test:f02:unit` / `test:f02:rls` | 15/15 · 15/15 |
| `test:f03:unit` / `test:f03:rls` | 25/25 · 4/4 |
| `test:f04:unit` / `test:f04:api` / `check-f04-rls.mjs` (clúster F02.5, detenido al terminar) | 18/18 · 6/6 · 18/18 |
| `f021-rls.test.ts` | 3/3 |
| Frontend completo | 34 archivos, **113/113** (antes 103) |
| `npm run check` / `build` / `verify:contracts` | correctos (244 archivos JS; 41 operaciones) |

No se ejecutaron: Playwright/E2E (T053), F05, DEMO (T055). Contenedores encendidos por Claude y detenidos al terminar.

### Pruebas existentes modificadas por la decisión A (necesario, no ocultan fallos)

- `admin-memberships.http.test.ts`: la concesión directa ahora espera 410 (nunca llama al caso de uso); el conflicto 409 se prueba sobre la revocación.
- `identity-composition.rls.test.ts`: la concesión por HTTP se sustituye por la siembra de la membresía en la base; la auditoría esperada pasa de `[MEMBERSHIP_GRANT, MEMBERSHIP_REVOKE]` a `[MEMBERSHIP_REVOKE]`; tras revocar, el trabajador (sin otra membresía) recibe 401 en lugar de lista vacía (cierre de sesiones, D-08). **Se corrigió además un defecto de la propia prueba**: la aserción «sin permiso → 403» usaba un token CSRF obtenido después de crear la solicitud y pasaba por fallo de CSRF, no por falta de permiso; ahora el token se obtiene antes.
- `membership-admin.test.jsx` y `migrations.test.ts` (lista de migraciones y sin `grant`).

### Hallazgos y desviaciones del lote 3 (para *analyze* y *converge*)

- **Sesiones globales**: el cierre de sesiones al quedar sin membresías activas también cierra las sesiones «de cliente» de una cuenta existente que fue invitada y luego revocada (las sesiones no son por farmacia). Es la decisión D-08 del plan; si se prefiere cerrar solo cuentas de personal (alias), es un ajuste pequeño en `revoke_staff_membership`.
- **`--f011-routes` del validador OpenAPI** no detecta `POST /me/invitations/{id}/accept|decline` porque se registran en un bucle con ruta de plantilla; T049 debe tratarlas como las acciones dinámicas de F04.
- **«Siguiente petición» en F02/F04**: la prueba de revocación inmediata se hizo con `/me/memberships`, `/auth/session` y las rutas de personal; las rutas de inventario y reservas pasan por la misma transacción de identidad (`runWithClient`), cubierta por sus suites de regresión, pero no hay una prueba específica «revocar y reintentar sobre inventario/reservas»; añadirla en T051 (matriz de ataques).
- La invitación solo admite cuentas con correo (existentes). No notifica por correo (decisión D-06 A: la persona la ve en «Mis invitaciones»).
- `data-model.md` y `research.md` siguen mencionando solo `011` y `personal.gestionar`; se corrigen en *analyze*.

## Pendiente (siguientes lotes)

US3 (T031–T036) en adelante. Nada de lo anterior constituye aceptación de F01.1.
