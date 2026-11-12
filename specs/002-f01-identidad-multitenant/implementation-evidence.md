# F01 — Evidencia de preparación y puertas SDD

**Fecha de revisión:** 2026-11-11 (America/Lima)
**Alcance:** registro documental previo a implementación. No acredita código, pruebas ni aceptación de F01.

| Comprobación de lectura | Comando o fuente | Resultado observado |
|---|---|---|
| Rama y base | `git branch --show-current`; `git rev-parse HEAD` | `feat/f01-identidad-multitenant`; `bb972e94a2c87a8cb363c9ed87d3352cce7cca0e`. |
| Estado de Git | `git status --short --branch` | Rama F01 activa; `specs/002-f01-identidad-multitenant/` aún sin seguimiento Git. No se preparó ni publicó ningún cambio en esta revisión. |
| Constitución | `.specify/memory/constitution.md`, metadatos y secuencia SDD | v1.1.0 ratificada el 2026-11-10; el plan requiere aprobación humana antes de cerrar la descomposición de tareas y generar código. |
| Especificación | `spec.md`, estado | Aprobada para planificación el 2026-11-10; no autoriza implementación por sí sola. |
| Plan | `plan.md`, estado | Sigue propuesto y pendiente de aprobación humana. Las decisiones técnicas propuestas no están ratificadas por este registro. |
| Tareas | Conteo estático de casillas `T###` en `tasks.md` | 67 tareas, 0 completas; T040–T051 están explícitamente bloqueadas. `tasks.md` permanece como borrador que requiere revalidación tras aprobar el plan. |
| Excepción y procedimientos | `authorization-decisions.md` | EXC-01 no ratificada; GLO-01, ROL-01 y BOOT-01 sin definición/aprobación operativa. `argon2` sigue siendo candidato ARG-01 sin instalación, hashing ni verificación en Windows 10/Node.js 24.17.0. |

**Estado de T001:** parcial. Se comprobó rama, base y documentación, pero falta aprobación humana del plan, revalidación posterior de `tasks.md` y autorización de un incremento implementador. No se marca T001 como completada. T002 y las tareas siguientes no se ejecutaron.

**Resultados de ejecución:** no se instalaron dependencias, no se ejecutaron pruebas ni migraciones y no se creó código F01. Por tanto no existe resultado de éxito/fallo de controles de aplicación que registrar aquí. La aceptación F01 permanece pendiente.

**Próxima puerta:** aprobar el plan integral y sus decisiones de seguridad propuestas, incluidos umbral, ventana y ámbito del control de abuso; revalidar las tareas; autorizar el incremento de implementación. Las mutaciones de terceros continúan bloqueadas adicionalmente por EXC-01/ROL-01 y las concesiones globales/iniciales por GLO-01/BOOT-01.

## Actualización del primer incremento — 2026-11-11

La sección anterior conserva la observación previa a la aprobación. Después, el usuario respondió «dale todo correcto sigamos» a la solicitud expresa de aprobación del plan F01 y su alcance. [plan.md](plan.md) registra la aprobación para **T001–T006 únicamente**. No implica ratificación de EXC-01, GLO-01, ROL-01 o BOOT-01, aprobación de las casillas de revisión humana ni autorización de T007–T067.

Revalidación estática posterior a esa aprobación: `tasks.md` contiene T001–T067 consecutivas, 0 completadas antes de este incremento, T040–T051 expresamente bloqueadas y filas de trazabilidad para los 20 FR y siete SC. T001–T006 tienen rutas y dependencias identificadas; T002 precede T003, y T004/T006 son independientes de los paquetes. El hueco de implementación de concesión global identificado en F01-FR-011 sigue documentado y bloqueado, sin afectar el alcance T001–T006. Esta revalidación es documental, no prueba de código.

La lectura de checklists mostró `requirements.md`: 15/16 marcadas; `security.md`: 0/27 marcadas. Los marcadores permanecen intactos. La indicación humana de continuar permite avanzar este incremento controlado sin atribuir aprobación de esas revisiones.

**T001 verificada:** rama `feat/f01-identidad-multitenant`, base `bb972e94a2c87a8cb363c9ed87d3352cce7cca0e`, plan y alcance registrados, tareas revalidadas para el primer bloque y límites anteriores conservados. No hay modificación de `main`, commit ni push. T001 puede marcarse completa; ninguna tarea adicional queda completada por este registro.

**T002:** la instalación aislada, hash Argon2id, verificación positiva/negativa, licencia y auditoría están registrados con comandos y salidas reales en [argon2-compatibility.md](argon2-compatibility.md). El paquete funcionó aquí bajo Windows 10 x64/Node.js 24.17.0; no se afirma soporte oficial para este SO. T002 puede marcarse completa.

### Preparación técnica T003–T006

| Tarea | Archivos y comprobación | Resultado observado |
|---|---|---|
| T003 | `backend/package.json`, `package-lock.json`; `npm.cmd install --workspace @farmafind/backend --save-exact argon2@0.45.2 pg@8.23.1 --offline=false --cache .cache/npm --fund=false --fetch-retries=0`; `npm.cmd ls argon2 pg --workspace @farmafind/backend --depth=0`; `npm.cmd audit --json --offline=false --cache .cache/npm --fetch-retries=0` | Instalación salida 0; `argon2@0.45.2` y `pg@8.23.1` exactos en backend; auditoría raíz salida 0, 0 vulnerabilidades conocidas. SHA-256 observado del lockfile: `F7F8D1A406886FA4AFEEE596C7B890308C5708C295DC7B2D4F73FDB4F1BACD9C`. No se conectó a PostgreSQL. |
| T004 | `backend/.env.example` | Añadidas solo claves F01 documentales para conexión de prueba, origen, CSRF y cookie, con URLs de loopback y cadenas de conexión vacías. No hay claves `VITE_*`, contraseña ni credencial real. El backend F00 no consume todavía esas claves. `npm.cmd run check:config` salió 0: 34 pruebas pasaron. |
| T005 | `package.json`, `scripts/f01/check.mjs` | Existen `test:f01:unit`, `test:f01:api` y `test:f01:rls`. El runner contempla los 17 archivos de prueba F01 previstos en `tasks.md` y rechaza nombres `.test.ts` sin grupo para evitar omisiones silenciosas. `node scripts/f01/check.mjs --list` salió 0; cada script F01 devolvió 1 con mensaje claro de pruebas ausentes, que es el resultado esperado en este incremento. No se atribuye éxito a pruebas F01 inexistentes. `npm.cmd run check` salió 0 y verificó sintaxis/TypeScript y límites F00. |
| T006 | `backend/src/modules/usuarios/README.md` | Describe capas Clean Architecture, límites de Usuarios y roles, los otros seis módulos, Notificaciones independiente, FarmaFind AI futura y puertas EXC-01/GLO-01/ROL-01/BOOT-01. `npm.cmd run check` salió 0; el README no declara lógica de negocio implementada. |

Verificación de regresión del incremento: `npm.cmd run test:base` salió 0 con **9 archivos y 64 pruebas**; `npm.cmd run build` salió 0 (TypeScript backend/Notificaciones y Vite frontend). La primera ejecución de ambos en sandbox falló antes de correr pruebas/compilar porque esbuild no pudo crear un proceso auxiliar (`spawn EPERM`); la repetición autorizada fuera de esa restricción pasó sin cambios de código. Los 34 casos de `check:config` son parte de las pruebas base y no se suman como pruebas F01 nuevas.

**Límites:** F01 todavía no tiene pruebas unitarias, HTTP ni RLS; los scripts nuevos fallan expresamente hasta que existan. No se ha ejecutado PostgreSQL, Playwright ni ninguna operación de identidad. La auditoría npm describe vulnerabilidades conocidas al momento de la consulta, no una garantía de seguridad completa. T003–T006 pueden marcarse completas como preparación; T007–T067 siguen pendientes y fuera del alcance de este incremento.

## Incremento fundacional T007–T016 — 2026-11-11

La sección anterior registra el estado del primer incremento y queda como historial. La indicación posterior del usuario de continuar con el siguiente bloque autorizó **T007–T016** sobre la rama `feat/f01-identidad-multitenant`; no ratifica EXC-01, GLO-01, ROL-01 ni BOOT-01. T017–T067 siguen fuera de este bloque. No se modificaron F00, Constitution, `main`, recursos AWS ni código de otros módulos.

| Control y entorno | Esperado | Resultado real |
|---|---|---|
| Versiones: `node --version`; `npm --version`; `psql --version` | Referencia Windows 10, Node 24.17.0, npm 11.13.0; PostgreSQL local real | `v24.17.0`, `11.13.0`, PostgreSQL `18.6`. La instancia fue un cluster de prueba aislado en `.cache/f01-postgres`, puerto loopback 55431 y base `farmafind_f01_test`, con usuario y secreto sintéticos guardados solo en ruta ignorada por Git. No se utilizó el servicio PostgreSQL preexistente ni sus credenciales. |
| `npm.cmd run test:f01:rls` con `F01_TEST_DATABASE_URL` apuntando exclusivamente al cluster aislado | Migración en base vacía ficticia, reaplicación sin duplicados, rollback, grants/RLS y transacción con rol no privilegiado | **2 archivos, 9 pruebas pasadas**, salida 0. Cada suite creó una base efímera aleatoria y la eliminó. Se verificó también que el migrador rechaza el rol runtime antes de conectarse. El test del pool creó un login sintético `NOSUPERUSER NOBYPASSRLS`, ejecutó el trabajo bajo `f01_runtime` y comprobó denegación SQL directa, membresía A/B, revocación, usuario inactivo, commit/rollback y limpieza de contexto al reutilizar la conexión. |
| `npm.cmd run test:f01:unit` | Reglas de configuración F01 | **1 archivo, 7 pruebas pasadas**, salida 0. |
| `npm.cmd run check`; `npm.cmd run build` | Límite de arquitectura, TypeScript y compilación | Ambos salida 0. `check` informó 36 archivos JS/TS y ninguna violación de los controles F00; `build` compiló backend, Notificaciones y frontend Vite. Estos controles no acreditan por sí solos seguridad de negocio. |
| `npm.cmd run test:base` sin URL F01 exportada | Regresión F00 y pruebas F01 que no requieren BD | Salida 0: **71 pasadas, 8 omitidas** en 12 archivos; las 8 omitidas son de las dos suites F01 que requieren PostgreSQL y fueron ejecutadas separadamente arriba. |
| `npm.cmd audit --audit-level=low`; `git diff --check` | Auditoría de dependencias y espacios en diff | Ambos salida 0; npm informó **0 vulnerabilidades conocidas**. Git advirtió que podría convertir LF a CRLF en cuatro archivos de trabajo, sin errores de whitespace. |

Se escribieron primero las pruebas de migración y de transacción, y se observó fallo por módulos aún inexistentes antes de implementar. `@types/pg@8.23.1` se añadió como dependencia de desarrollo para compilar el adaptador tipado de pruebas; `package-lock.json` se actualizó. El migrador solo admite URL PostgreSQL de base ficticia en loopback, verifica identidad de base/rol y aplica archivos de forma transaccional. Las migraciones crean identidad/sesión globales, referencia mínima de farmacia, membresías, delegación y auditoría; `003_rls_base.sql` no concede mutaciones delegadas. El adaptador usa un cliente del pool durante `BEGIN` a `COMMIT`/`ROLLBACK`, rechaza un login privilegiado, comprueba usuario activo y membresía propia activa antes de fijar tenant con `set_config(..., true)`, y libera el cliente en `finally`.

**Límite observado en ese momento:** el adaptador aceptaba un ID sintético como actor sin comprobar una sesión. La revisión de seguridad posterior corrigió ese defecto, según la sección siguiente. La prueba RLS de este bloque cubría lectura de membresía propia y denegación de mutaciones básicas, no toda la matriz AC04. No se implementaron endpoints, registro/login, gestión de membresías, permisos globales, UI F01 ni Playwright. El resultado fundacional **no equivale a aceptación F01**. T007–T016 se marcaron completas tras esos controles; T040–T051 permanecen bloqueadas expresamente por las decisiones documentales citadas.

## Corrección de seguridad y pruebas independientes US4 — 2026-11-11

La revisión del adaptador detectó que aceptar un `actorUserId` suministrado por el llamador permitía suplantarlo si ese límite se conectaba incorrectamente a HTTP. `PgIdentityUnitOfWork.run` ahora recibe un secreto de sesión opaco de 32 bytes, comprueba en la **misma transacción** su huella SHA-256, estado vigente, vencimientos inactivo/absoluto y usuario activo, y solo entonces fija `app.actor_user_id`. Un UUID de usuario o un token aleatorio no autoriza. La API de login, emisión/rotación de sesión y cookie aún no existe; esta corrección no acredita US1.

La migración aditiva `004_rls_private.sql` revoca al rol runtime lectura de correo/hash y escritura de sesiones. La lectura de sesiones se limita por RLS a la huella fijada localmente en la transacción. `001`–`003` se conservaron para que la corrección aplique también a una base de prueba que ya hubiera ejecutado las migraciones anteriores. `delegacion` y `auditoria_acceso` siguen cerradas para runtime y no se habilitaron mutaciones delegadas. La creación/revocación de sesiones y el acceso a hash requerirán un rol de autenticación separado y acotado en una tarea posterior; **T055 permanece parcial** hasta completar las políticas operativas aprobadas, sin levantar EXC-01/ROL-01.

| Comprobación | Resultado real |
|---|---|
| `npm.cmd run test:f01:rls` con URL sintética del cluster PostgreSQL aislado en loopback | **4 archivos, 20 pruebas pasadas**, salida 0: migraciones 001–004, rol sin `BYPASSRLS`/propiedad, grants mínimos, sesión opaca válida/inválida/revocada/vencida, SQL directo SELECT/INSERT/UPDATE/DELETE propio/ajeno, ausencia de contexto, rollback, reutilización y dos solicitudes A/B concurrentes. T052 y T054 verificadas. |
| `npm.cmd run test:base` con la misma URL sintética | **14 archivos, 91 pruebas pasadas**, sin omisiones, salida 0. Incluye F00 y las pruebas F01 implementadas; no incluye HTTP F01 ni Playwright inexistentes. |
| `npm.cmd run check`; `npm.cmd run build` | Ambos salida 0. TypeScript y Vite compilaron; el control de arquitectura F00 informó 0 violaciones, pero no sustituye revisión RLS. |
| `npm.cmd audit --audit-level=low`; `git diff --check` | Ambos salida 0; npm informó 0 vulnerabilidades conocidas. Git mostró solo avisos de conversión LF/CRLF en archivos de trabajo, sin error de whitespace. |

T059 se verifica con consulta de `pg_roles`/propiedad y SQL directo bajo un login sintético `NOSUPERUSER NOBYPASSRLS`: un actor de A no obtiene la fila de B incluso si la consulta omite filtro HTTP. T061 registra expresamente que **US4 y F01-SC-004 siguen pendientes**: faltan casos AC04, API y las mutaciones delegadas bloqueadas; estos 20 casos SQL no constituyen el 100 % de AC04. T063 comprobó que solo el módulo Usuarios y roles recibió código F01, sin lógica nueva de Farmacias, Inventario, Reservas, Notificaciones o FarmaFind AI. T066 actualizó `quickstart.md` con comandos existentes y el estado local parcial. Playwright continúa pendiente de entorno oficialmente compatible. No hubo commit, push, despliegue, Docker ni recurso AWS.

## Preparación aislada de contraseña y salida pública — 2026-11-11

T018 se escribió antes del adaptador y falló por módulo inexistente, como se esperaba en TDD. T021 añadió `Argon2PasswordHasher` con Argon2id explícito (`m=65536 KiB`, `t=3`, `p=1`), sal aleatoria de la biblioteca, formato PHC y comprobación de rehash. Estos parámetros superan el mínimo Argon2id descrito en la [guía de almacenamiento de contraseñas de OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html); no se afirma que ya estén calibrados con una prueba de carga de producción. Las pruebas usan solo contraseñas ficticias y verifican sal distinta, positivo/negativo, formato, parámetros anteriores y rechazo de otra variante Argon2. No hay endpoint de registro/login ni contraseñas reales.

T056 añadió una proyección pública que devuelve solo identificador y nombre de referencia de farmacia. `data-minimization.test.ts` comprobó que campos extra de credenciales, membresías y notas internas no salen en ese DTO; T053 **permanece pendiente** porque no existen aún respuestas HTTP ni registros de auditoría F01 para inspeccionar. Se endureció `scripts/f01/check.mjs`: `test:f01:api` falla con mensaje claro mientras falte al menos una prueba `.http.test.ts`, aun cuando existan pruebas de proyección. La última ejecución observada de ese comando terminó en código 1 con «faltan pruebas de contrato HTTP», resultado esperado en este estado.

La regresión posterior con `F01_TEST_DATABASE_URL` del cluster aislado registró `npm.cmd run test:base`: **16 archivos, 96 pruebas pasadas, 0 omitidas**, salida 0; `npm.cmd run build` y `npm.cmd run check`: salida 0. `npm.cmd audit --audit-level=low` informó **0 vulnerabilidades conocidas**. T018/T021/T056 pueden marcarse completas como piezas aisladas; US1/US4 y F01 siguen sin aceptación.

Al terminar, `pg_ctl stop -m fast` detuvo correctamente el cluster sintético aislado (salida 0). `git diff --check` salió 0; no hay archivos preparados en el índice ni rutas privadas entre los 34 archivos nuevos visibles para Git. La rama sigue siendo `feat/f01-identidad-multitenant`: **25/67 tareas completas, 42 pendientes**. Los controles HTTP F01, el límite de abuso aún no aprobado, T055 completo, T053 completo, los gates EXC-01/ROL-01/GLO-01/BOOT-01 y Playwright siguen pendientes; no se declaran implementaciones o pruebas faltantes como aprobadas.

## Incremento de lectura y selección US2 — 2026-11-11

La sección anterior conserva la fotografía del bloque precedente. El usuario autorizó continuar con el siguiente bloque de la fase F01 sin levantar los gates documentales. Se implementaron T030, T032, T033 y T034: pruebas unitarias de cero/una/varias membresías, repositorio de lectura propia dentro de la transacción verificada, selección de farmacia activa y lectura de delegaciones propias mediante RLS. La migración `004_rls_private.sql` concede **solo SELECT** de delegaciones propias activas; no concede creación, cambio ni revocación de membresías/delegaciones. No se implementó ruta HTTP ni se persistió un rol en el navegador.

| Comprobación | Esperado | Obtenido |
|---|---|---|
| `npm.cmd run test:f01:unit` en Windows 10/Node 24.17.0 | Cero/una/varias farmacias, estado y ausencia de autoasignación | **3 archivos, 14 pruebas pasadas**, salida 0. El test US2 se escribió primero y falló por módulo aún inexistente antes de implementar el caso de uso. |
| `npm.cmd run test:f01:rls` con PostgreSQL 18.6 en cluster local aislado, rol de prueba sin `BYPASSRLS` | Listado propio, delegaciones propias A/B, denegación ajena, revocación e inactividad | **5 archivos, 25 pruebas pasadas**, salida 0. La persona ficticia con A/B seleccionó ambas con delegaciones distintas; la persona con solo A no seleccionó B; una persona sin membresías recibió lista vacía. Farmacia B inactiva y membresía B revocada fueron denegadas en la operación siguiente. SQL directo sin actor no leyó membresías ni delegaciones. Dos selecciones concurrentes del mismo usuario conservaron A y B separados. |
| `npm.cmd run test:base` con URL del mismo cluster de prueba | Regresión F00/F01 | **18 archivos, 104 pruebas pasadas, 0 omitidas**, salida 0. `npm.cmd run check` y `npm.cmd run build` también salieron 0. |
| `npm.cmd audit --audit-level=low` | Revisar vulnerabilidades conocidas sin cambiar versiones | Salida 0: **0 vulnerabilidades conocidas**. |

Se corrigieron dos fallos del fixture antes de declarar las pruebas satisfactorias: un correo sintético con mayúscula incumplía la restricción de correo canónico y el test asumía un orden fijo entre UUID aleatorios. La limpieza del fixture se ajustó para no intentar eliminar un rol que no llegó a crearse. El primer inicio del cluster de prueba falló por permiso de bind en localhost; el reintento con escucha explícita **solo en IPv4 127.0.0.1:55431** inició correctamente. No se usó el servicio PostgreSQL preexistente ni credenciales reales.

**T039 — evidencia parcial de US2:** las pruebas anteriores acreditan A/B, rol local, delegaciones sintéticas, revocación, ausencia de contexto y conexiones reutilizadas/concurrentes en PostgreSQL. Se registra el resultado real, pero US2 **no está aceptada**: faltan contratos y rutas HTTP T031/T035, UI T036/T037, prueba integrada API/pool T038 y Playwright posterior. La selección no implica permiso de gestión de membresías; EXC-01/ROL-01/GLO-01/BOOT-01 permanecen pendientes.

`pg_ctl stop -m fast` detuvo el cluster sintético (salida 0). `git diff --check` salió 0; los avisos LF/CRLF no son errores de whitespace. No hay archivos en el índice de Git ni rutas privadas entre los 38 archivos nuevos visibles para Git. Estado al cerrar este bloque: rama `feat/f01-identidad-multitenant`, **30/67 tareas completas y 37 pendientes**; sin commit, push, despliegue, cambios en `main` ni aceptación completa de F01.

## Selector visual independiente US2 — 2026-11-11

T036 añadió `frontend/src/identity/PharmacySelector.jsx` como componente de presentación aislado. Solo muestra las farmacias suministradas por la capa de sesión; muestra estados de carga, lista vacía, acceso denegado y sesión expirada. Entrega el ID elegido al controlador sin calcular permisos ni persistir roles en el navegador. No se conectó a `main.jsx` ni a una API inexistente: T037 sigue pendiente de autenticación/sesión y endpoints reales.

Se añadieron cuatro pruebas en `frontend/tests/identity/pharmacy-selector.test.jsx` y se incluyó esa ruta en `vitest.config.mjs`. La primera ejecución falló porque el módulo aún no existía; tras crear el componente, `node node_modules/vitest/vitest.mjs run frontend/tests/identity/pharmacy-selector.test.jsx` terminó con **1 archivo y 4 pruebas pasadas**, salida 0. Las pruebas inspeccionan salida renderizada para lista propia, denegación/expiración y estados, y comprueban que el clic delega la selección; no acreditan una interacción de navegador ni autorización del servidor.

| Control local | Resultado real |
|---|---|
| `npm.cmd run check` | Salida 0; 38 archivos JS/TS revisados y 0 violaciones del control arquitectónico F00. No evalúa por sí mismo seguridad F01. |
| `npm.cmd run build` | Salida 0; backend/Notificaciones compilaron y Vite 7.3.8 compiló la pantalla F00. El selector F01 todavía no está conectado al bundle principal. |
| `npm.cmd run test:base` sin `F01_TEST_DATABASE_URL` | Salida 0; **14 archivos pasados, 5 omitidos; 83 pruebas pasadas, 25 omitidas**. Las omisiones son suites que requieren PostgreSQL y ya tuvieron ejecución real en el bloque anterior; este comando no las revalida. |
| `npm.cmd audit --audit-level=low` | Salida 0; **0 vulnerabilidades conocidas** en el árbol consultado. |
| `git diff --check` | Salida 0; solo advertencias de conversión LF/CRLF. |

La rama permanece `feat/f01-identidad-multitenant`, con **31/67 tareas completas y 36 pendientes**. No hay archivos preparados en Git ni rutas privadas visibles entre los nuevos archivos. EXC-01/ROL-01/GLO-01/BOOT-01 y los parámetros de abuso US1 no se consideran aprobados; T031/T035/T037/T038, HTTP de identidad, AC04 completo, Playwright y la revisión humana permanecen pendientes. No se declara F01 aceptada.

## Pruebas y piezas aisladas de US1 — 2026-11-11

Tras la autorización general del usuario para continuar, se verificó que ningún documento fija aún los valores exactos de umbral, ventana, ámbito y respuesta del control de abuso. Se solicitó confirmación de una propuesta concreta; la frase «apruebo los parámetros» no se usa para atribuir valores inexistentes a una fuente. T020/T024 y las rutas HTTP de autenticación permanecen pendientes hasta registrar esos valores. Las puertas EXC-01/ROL-01/GLO-01/BOOT-01 siguen separadas y sin ratificación.

T017 añadió pruebas de correo canónico, duplicados, usuario inactivo y creación exclusiva de identidad ordinaria sin membresía en `registration.unit.test.ts`. `RegistrationService` usa el puerto `createCustomer`, devuelve resultado uniforme para duplicado y no emite credencial ni permiso; todavía no está conectado a PostgreSQL ni a HTTP. La restricción única de base y el tratamiento de una carrera de inserción deberán verificarse en T022/T023. T019 añadió pruebas de secreto opaco aleatorio, huella, límites de 30 minutos inactivos/8 horas absolutos, revocación, rotación y revalidación de estado; `session-policy.ts` produce objetos para persistencia transaccional futura, pero no crea ni revoca sesiones en BD por sí solo. T026 creó `AuthView.jsx` con formularios de registro/acceso, estado de sesión, cierre y error genérico; sus pruebas son de renderizado estático. La vista todavía no se integra en `main.jsx`, no envía solicitudes ni constituye prueba E2E.

Se observó primero el fallo esperado por ausencia de `registration.ts`, `session-policy.ts` y `AuthView.jsx` en sus respectivas pruebas, antes de crear cada módulo. Después:

| Control en Windows 10, Node.js 24.17.0 | Resultado real |
|---|---|
| `npm.cmd run test:f01:unit` | Salida 0: **5 archivos, 21 pruebas pasadas**. Incluye 4 casos nuevos de registro y 3 de sesión. |
| `node node_modules/vitest/vitest.mjs run frontend/tests/identity/auth-view.test.jsx` | Salida 0: **1 archivo, 3 pruebas pasadas**; no equivale a navegador. |
| `npm.cmd run test:base` sin URL F01 de BD | Salida 0: **17 archivos pasados, 5 omitidos; 93 pruebas pasadas, 25 omitidas**. Las cinco suites omitidas requieren PostgreSQL y no se reejecutaron en este bloque. |
| `npm.cmd run check`; `npm.cmd run build` | Ambos salida 0. El control de arquitectura F00 indicó 0 violaciones y 40 archivos JS/TS; Vite compiló el bundle F00, sin conectar aún las vistas F01. |
| `npm.cmd audit --audit-level=low`; `git diff --check` | Ambos salida 0; auditoría: **0 vulnerabilidades conocidas**. Git solo advirtió posible conversión LF/CRLF. |

Estado documental tras este bloque: **34/67 tareas completas y 33 pendientes**. T017/T019/T026 solo acreditan sus entregables unitarios o visuales aislados; US1, sus contratos HTTP, persistencia, cookies/CSRF, control de abuso, auditoría, integración React y aceptación completa continúan pendientes.

## Incremento de identidad HTTP y persistencia — 2026-11-11

Las cifras anteriores son fotografías de incrementos previos. ABUSE-01 fue aprobado después y quedó registrado en `authorization-decisions.md`: cinco fallos de login por cuenta y por IP, cinco intentos de registro por IP, ventana móvil de 15 minutos y exceso 429 con `Retry-After`. EXC-01, ROL-01, GLO-01 y BOOT-01 no fueron ratificados y las tareas T040–T051 siguen bloqueadas.

T022 implementó repositorios PostgreSQL parametrizados para identidad y sesión; la sesión persiste solo la huella del secreto. T023 implementó registro ordinario, login, revalidación de usuario y vencimiento de sesión, y revocación. El registro duplicado usa `ON CONFLICT DO NOTHING` para evitar que una carrera de unicidad aborte la transacción y pierda el contador de abuso. T025 agregó rutas y DTO mínimos en un router inyectable montado por `createApp` en `/api/v1`, conservando `/health`. El proceso F00 `main.ts` no monta ese router: todavía falta una composición ejecutable F01, por lo que no se declara disponible el servicio F01 al arrancar F00.

Las pruebas de contrato HTTP usan Supertest y cubren registro 202, login/sesión/logout, cookie HttpOnly, CSRF/Origin 403, errores 400/401, 429 con `Retry-After` y JSON malformado sin eco de contenido. Una integración adicional encadenó registro duplicado, login, sesión, logout y seis fallos de login mediante HTTP sobre PostgreSQL 18.6 sintético local, con rol `f01_auth` sin superusuario ni `BYPASSRLS`. Ningún correo o IP real se utilizó. El control de abuso guarda HMAC de identificadores y no datos en claro.

| Comprobación real en Windows 10, Node.js 24.17.0 | Resultado |
|---|---|
| `npm.cmd run test:f01:api` | Salida 0: 2 archivos, 7 pruebas pasadas. |
| `npm.cmd run test:f01:rls` con `F01_TEST_DATABASE_URL` del cluster aislado `127.0.0.1:55431` | Salida 0: 6 archivos, 30 pruebas pasadas antes de añadir la prueba HTTP integrada. Esta última pasó después de forma aislada: 1 archivo, 6 pruebas pasadas. |
| `npm.cmd run test:base` sin URL de BD | Salida 0: 21 archivos, 111 pruebas pasadas; 6 archivos/30 pruebas omitidos por necesitar PostgreSQL. Se corrigió primero una prueba unitaria que simulaba el antiguo error `23505`; ahora verifica el resultado `ON CONFLICT DO NOTHING`. |
| `npm.cmd run check`; `npm.cmd run build` | Salida 0. El control arquitectónico automático es el de F00; no sustituye una auditoría de seguridad F01. |
| `npm.cmd audit --json`; `git diff --check` | Salida 0. Auditoría: 0 vulnerabilidades conocidas. `git diff --check` solo emitió avisos LF/CRLF. |

Estado actual: **37/67 tareas completas y 30 pendientes**. T020 sigue pendiente porque exige todos sus casos contractuales, incluido 409 en el conjunto de operaciones previsto; T024 sigue pendiente por su dependencia explícita de T020, aunque middleware, CSRF y abuso estén implementados y parcialmente probados. T027/T028, los contratos y rutas US2, la auditoría, la suite AC04 completa y Playwright siguen pendientes. No se declara US1 ni F01 aceptada. No hubo commit, push, despliegue ni cambios en `main`.

La regresión final de este bloque ejecutó `npm.cmd run test:base` con la URL de la base sintética: **27 archivos y 143 pruebas pasadas, 0 omitidas**, salida 0. Tras el último ajuste del middleware y parser JSON, `npm.cmd run check`, `npm.cmd run test:f01:api` y `npm.cmd run build` salieron 0; el grupo API tuvo 2 archivos y 7 pruebas. El análisis `npm.cmd audit --json` informó 0 vulnerabilidades conocidas. `git diff --check` salió 0 (solo avisos LF/CRLF), el índice Git estaba vacío y el barrido de rutas nuevas no mostró `docs/referencias`, `.env.local`, `node_modules`, `dist` ni cachés preparados. La búsqueda de patrones de secreto encontró únicamente una URL con usuario/contraseña explícitamente ficticios en una prueba de configuración, no una credencial real. Rama: `feat/f01-identidad-multitenant`.

## Cliente React de identidad aislado — 2026-11-11

T027 conectó `AuthView` con `session-client.js` y el estado React en `IdentityApp.jsx`. La ruta `/identity` usa ese cliente; la ruta raíz mantiene la pantalla técnica F00. El cliente pide CSRF antes de cada mutación, envía cookies solo al mismo origen y no escribe credenciales, secreto opaco ni token en `localStorage`. El proxy Vite local remite `/api/v1` a loopback `127.0.0.1:3000`. La API F01 todavía no tiene composición de arranque en el proceso local, así que la vista conectada no acredita un recorrido de navegador ni un servicio F01 operativo.

Se verificó con `npm.cmd run test:base` sin URL de PostgreSQL: salida 0, **22 archivos/115 pruebas pasadas**, 6 archivos/31 pruebas omitidas por requerir la base. `npm.cmd run build` salió 0 e incluyó 32 módulos en Vite; `npm.cmd run check` salió 0 y revisó 43 archivos JS/TS. Las tres pruebas nuevas del cliente revisan CSRF previo, `credentials: same-origin`, sesión 401 anónima, error genérico y logout sin cuerpo. PostgreSQL sintético se detuvo con `pg_ctl stop -m fast` (salida 0). Estado: **38/67 tareas completas y 29 pendientes**. US1 y F01 no están aceptadas; Playwright y la revisión humana siguen pendientes.

## Contratos HTTP de membresía propia — 2026-11-11

T031 añadió escenarios Supertest para listado A/B, selección B sin delegación A, ID ajeno o manipulado, sesión revocada, farmacia inactiva y CSRF ausente. T035 agregó exclusivamente `GET /me/memberships` y `PUT /me/active-pharmacy` al router inyectable. No existe ruta para crear, cambiar o revocar membresías de terceros; EXC-01/ROL-01 continúan bloqueándolas. Cada solicitud exige una sesión vigente y la selección revalida la membresía mediante el caso de uso y PostgreSQL RLS. Las respuestas de recurso ajeno son 404 sin fila privada. Las pruebas HTTP de este bloque usan dobles para las rutas; T038 todavía requiere demostrar el conjunto API + PostgreSQL + pool concurrente.

T037 conectó el selector React a `session-client.js`: consulta la lista desde la API, envía la selección mediante `PUT` con CSRF y muestra solo el identificador de farmacia seleccionado. No persiste rol ni delegaciones como autoridad en el navegador. `npm.cmd run test:f01:api` salió 0 con **3 archivos/11 pruebas**; `npm.cmd run test:base` sin URL de BD salió 0 con **23 archivos/120 pruebas pasadas** y 6 archivos/31 pruebas omitidas; `npm.cmd run build` salió 0 (33 módulos Vite), y `npm.cmd run check` salió 0. La ejecución SQL real de US2 permanece acreditada por el bloque anterior; el nuevo recorrido HTTP/React no se ha ejecutado en navegador ni con un proceso F01 operativo. Estado: **41/67 tareas completas y 26 pendientes**; US2 y F01 siguen sin aceptación completa.

## Auditoría, aislamiento HTTP y matriz AC04 ejecutable — 2026-11-11

Se continuó sobre `feat/f01-identidad-multitenant` sin tocar `main`. T038 añadió `membership-isolation.test.ts`: bajo PostgreSQL 18.6 sintético y un pool de una sola conexión, dos agentes HTTP con sesiones diferentes consultaron A/B en paralelo; quien solo pertenece a A recibió 404 al seleccionar B. La misma persona con A/B mantuvo las delegaciones separadas. Revocar B o inactivar A cambió la siguiente respuesta. Farmacia B existente pero ajena y un UUID inexistente devolvieron el mismo código y mensaje públicos, sin identificador B.

T028/T053/T055/T057 incorporaron y probaron auditoría mínima. Las migraciones aditivas `007_auth_audit.sql` y `008_access_audit.sql` permiten al rol `f01_auth` **solo insertar** eventos de identidad sin `farmacia_id`; no puede leerlos, ni insertar eventos con farmacia. El repositorio admite acciones enumeradas y parámetros fijos, sin payload, correo, IP, contraseña, cookie o token. Registro/login/logout y fallos de credenciales guardan eventos en la misma transacción que su operación. En una prueba real de registro duplicado, login, logout, cinco fallos y una denegación de selección se observaron **10 eventos** esperados, con correlación UUID y sin correo ni contraseña. La denegación 404 de selección comparte `correlationId` con el evento; no registra el ID de la farmacia solicitada. No se implementaron auditorías de mutaciones administrativas bloqueadas.

T020/T024 se cerraron tras corregir una asignación inconsistente: el contrato OpenAPI no define 409 para `/auth/*`; lo define para operaciones administrativas de membresía, ahora trazadas en T043 y aún bloqueadas. Los contratos de autenticación verifican 400/401/403/429, cinco fallos y sexto 429, `Retry-After`, cookie `HttpOnly`, prefijo `__Host-` y `Secure` en HTTPS, excepción HTTP solo loopback y rechazo de token CSRF previo tras iniciar sesión. La prueba real PostgreSQL complementa los dobles HTTP para el umbral de abuso por cuenta/IP y registro por IP. No se redujo el conjunto de códigos exigidos para F01.

| Matriz AC04 del alcance no bloqueado | Positivo observado | Negativo observado | Límite |
|---|---|---|---|
| US1 registro e identidad | Autorregistro ordinario único, login y sesión vigentes en HTTP+PostgreSQL | Duplicado uniforme 202, entrada/credencial inválida, cuenta inactiva, quinto/sexto intento, sesión revocada/expirada, CSRF/Origin inválidos | Navegador y proceso local F01 pendiente. |
| US2 farmacia propia | Lectura/selección A/B y delegaciones propias, concurrencia sobre pool reutilizado | B ajena/inexistente 404 uniforme, revocación, suspensión/inactividad, ID manipulado | Gestión de terceros bloqueada. |
| US4 SQL/RLS | Lectura propia y referencia pública permitidas, sesión y auditoría autorizadas | Sin actor/tenant, B ajena, escritura de membresía/delegación no concedida, rol con bypass rechazado, rollback y conexión reutilizada | No hay escritura positiva de membresía autorizada hasta EXC-01/ROL-01. AC04 global y SC004 siguen pendientes. |
| US4 salidas/auditoría | DTO público mínimo y evento autorizado | Sin secreto/payload, sin evento con farmacia ajena, sin lectura de auditoría por rol auth | Revisión de todo F01 y E2E pendientes. |

La matriz anterior corresponde a las operaciones F01 **ya autorizadas**. No presenta como ejecutados los escenarios US3 ni el 100 % de AC04 histórico; T040–T051 y los positivos de mutación delegada siguen bloqueados. La revisión de FK/UNIQUE del alcance expuesto observó registro duplicado uniforme mediante `ON CONFLICT DO NOTHING` y ausencia de rutas de mutación de terceros; la comprobación B existente/inexistente impide revelar su existencia por la respuesta HTTP. Los posibles errores indirectos de las futuras mutaciones deberán revisarse después de ratificar sus puertas.

| Control, Windows 10 / Node 24.17.0 / npm 11.13.0 | Esperado | Obtenido |
|---|---|---|
| `npm.cmd run test:f01:api` | Contratos HTTP y minimización sin fallos | Salida 0, **3 archivos/16 pruebas** después de corregir T020. |
| `npm.cmd run test:f01:rls` con `F01_TEST_DATABASE_URL` del cluster aislado `127.0.0.1:55431` | RLS, migraciones, pool, identidad y auditoría reales | Salida 0, **7 archivos/34 pruebas** antes de los tres casos HTTP finales; ejecución dirigida posterior de `membership-isolation.test.ts`: 2/2 pasadas. |
| `npm.cmd run test:base` con la misma URL | Regresión F00/F01 sin omisiones | Salida 0, **30 archivos/159 pruebas**, 0 omitidas. Antes de este bloque se corrigió una prueba que esperaba `23505` tras cambiar a `ON CONFLICT DO NOTHING`; el resultado final pasa. |
| `npm.cmd run check`; `npm.cmd run build` | Tipado/compilación sin error | Ambos salida 0; Vite 7.3.8 compiló 33 módulos. El control arquitectónico automático sigue siendo F00 y no certifica por sí solo RLS. |
| `npm.cmd audit --json`; `git diff --check` | Sin vulnerabilidades conocidas ni errores de whitespace | Auditoría salida 0, **0 vulnerabilidades conocidas**; diff salida 0 con avisos LF/CRLF. |

Los secretos de conexión se leyeron de un archivo local ignorado y se eliminaron de la variable de entorno después de cada comando; no se imprimieron. La auditoría y los resultados usan datos ficticios. **US1, US2, US4 y F01 no están aceptadas**: falta un proceso F01 arrancable, Playwright en entorno oficialmente compatible, las mutaciones US3 condicionadas, el 100 % de AC04 aplicable a todo F01 y la revisión humana. La trazabilidad actual se encuentra en `evidence-traceability.md` y conserva los 16 criterios sin puntajes inventados.

## Convergencia de arranque local F01 — 2026-11-11

La revisión de convergencia encontró que el proceso `backend/src/main.ts` seguía montando solo F00 pese a existir routers F01 y la vista React `/identity`; se añadieron T068–T069 sin cambiar los 67 identificadores anteriores. La composición local quedó en `backend/src/identity-app.ts`, con dos pools inyectados y separados: un LOGIN no privilegiado que solo hereda `f01_auth`, y otro que solo hereda `f01_runtime`. Antes de escuchar HTTP verifica que ninguno sea superusuario, `BYPASSRLS` ni miembro del rol opuesto. `scripts/f01/start.mjs` carga exclusivamente el archivo local ignorado `backend/.env.f01.local`; `backend/src/config/identity-runtime.ts` exige loopback, puerto PostgreSQL 55431, base ficticia, usuarios distintos y dos claves secretas independientes. El lanzador no monta rutas de mutación de membresías de terceros. `npm.cmd run dev:api` y `/health` F00 se conservan.

`identity-composition.rls.test.ts` abrió un servidor HTTP real en loopback sobre una base PostgreSQL efímera migrada y dos LOGIN ficticios limitados. Observó `/health` 200; registro 202, login y perfil 200; lista de A/B para un usuario miembro de ambas y solo A para otro; selección B propia 200, selección B ajena 404; logout 204 y sesión posterior 401. La prueba cerró servidor, pools y base efímera. La primera versión del test recibió 403 porque construyó el POST antes de solicitar la cookie CSRF; se corrigió el orden del **test** y la batería posterior pasó. `identity-runtime.unit.test.ts` rechaza URL remota, mismo usuario en ambos pools, clave corta/duplicada y modo F00.

| Control en Windows 10, Node.js 24.17.0 / npm 11.13.0 / PostgreSQL 18.6 | Resultado real |
|---|---|
| `npm.cmd run test:f01:unit` | Salida 0, **9 archivos/36 pruebas**. |
| `npm.cmd run test:f01:rls` con `F01_TEST_DATABASE_URL` sintética de loopback | Salida 0, **8 archivos/35 pruebas**, incluida composición HTTP + PostgreSQL. |
| `npm.cmd run test:base` con la misma URL, tras separar el lanzador F01 | Salida 0, **32 archivos/162 pruebas**, 0 omitidas. |
| `npm.cmd run check`; `npm.cmd run build` | Ambos salida 0; control arquitectónico F00 sin violaciones y bundle Vite de 33 módulos. El primer `check` detectó un import directo de `pg` en `backend/src/identity-app.ts`; se movió la creación de pools al lanzador F01 y se repitió con éxito sin cambiar el control F00. |
| `npm.cmd audit --json` | Salida 0, **0 vulnerabilidades conocidas** entre 285 dependencias informadas. |

El proceso CLI `npm.cmd run dev:identity` quedó preparado, pero esta sesión no dejó un servidor permanente ni realizó un recorrido de navegador: la verificación de arranque/HTTP se hizo con `app.listen` real desde la prueba integrada y no acredita Playwright. La guía [quickstart.md](quickstart.md) indica los comandos y la configuración local privada para abrir `/identity`. El modo sigue **local parcial**; **overall/acceptance pendientes** por T040–T051 (EXC-01/ROL-01/GLO-01/BOOT-01), T062 (Playwright en entorno oficialmente compatible), T067 (revisión humana), US3/SC004/SC006 y AC04 completo. Ninguna puerta documental se considera ratificada por esta convergencia.

## Decisiones de seguridad posteriores — 2026-11-12

Las cifras y puertas de los bloques anteriores son fotografías de sus fechas. La aprobación humana expresa del 2026-11-12 ratificó EXC-01 como excepción **nueva y limitada** frente al capítulo 27 y ROL-01 con `TRABAJADOR` como único rol local concedible/revocable. T040/T041 se cerraron **solo como tareas documentales**. T042–T049 permanecen sin implementar ni probar; GLO-01 prohíbe concesiones globales y T050/T051 siguen bloqueadas; BOOT-01 autoriza solo diseñar, no ejecutar, el alta inicial. Esta actualización no añade resultados de pruebas a los 162 registrados antes ni cambia el estado de aceptación F01.

## Pruebas previas de administración local — 2026-11-12

Se revisaron las 69 tareas (57 marcadas y 12 pendientes), la matriz EXC-01/ROL-01 y el contrato OpenAPI. Se añadieron `authorization.unit.test.ts` (T042) y `admin-memberships.http.test.ts` (T043) como pruebas **test-first** para `TRABAJADOR`: permiso y membresía activa del actor, objetivo distinto, A/B, autoelevación, rol no delegable, ausencia de permiso, CSRF/Origin, 401/403/404/409 y salida sin datos ajenos. El contrato conserva solo GET/POST/PATCH locales; no se añadió ruta global ni alta privilegiada. Los nombres `membership.manage`, `DUENO` y `ADMINISTRADOR` usados como fixtures son propuestas de interfaz para T045, no privilegios concedidos por sí solos ni autoridad histórica.

| Comando en Windows 10 / Node.js 24.17.0 / npm 11.13.0 | Resultado observado en este bloque |
|---|---|
| `npm.cmd run test:f01:unit` | Salida 1: 9 archivos/36 pruebas previas pasadas; el archivo T042 no cargó porque falta `grant-policy.js` de T045. No se ejecutaron aún sus casos de matriz. |
| `npm.cmd run test:f01:api` | Salida 1: 3 archivos y 17 pruebas pasadas, incluida una comprobación nueva de que las rutas administrativas **no están montadas**; cuatro casos T043 fallan antes de ejercer el contrato porque falta `admin-memberships-router.js` de T048. |
| `npm.cmd run check` | Salida 0: 44 archivos JS/TS y control arquitectónico F00 sin violaciones; no acredita seguridad F01. |
| `npm.cmd run build` | Salida 0: frontend Vite, 33 módulos transformados. |
| `git diff --check` | Salida 0, solo avisos LF/CRLF de Windows. |

La primera ejecución de Vitest en el sandbox falló por `spawn EPERM` antes de cargar pruebas; las ejecuciones anteriores se repitieron con permiso de proceso y son las cifras válidas. T042/T043 **siguen `[ ]`** porque no hay resultado positivo/negativo de su política y router, respectivamente. La prueba de rutas ausentes demuestra solo denegación actual por 404, no la autorización futura. No se ejecutó PostgreSQL, ninguna mutación privilegiada ni T044; tampoco se modificó `main` ni se hizo commit/push.

**Puerta exacta T044:** requiere PostgreSQL real **aislado de prueba**, base ficticia de loopback `farmafind_f01_test`, `F01_TEST_DATABASE_URL` local ignorada por Git, migraciones F01 001–008 y roles de aplicación sin propiedad, superusuario ni `BYPASSRLS`. Debe probar `USING`/`WITH CHECK` sobre A/B, autoelevación, rol superior, revocación y auditoría antes de T046–T048; las políticas de mutación 009 aún no existen. T055 acredita solo RLS base, que deniega mutaciones de terceros. Hasta esa evidencia, no se montan rutas ni se ejecutan concesiones/revocaciones reales. GLO-01/BOOT-01, Playwright compatible y la revisión humana siguen pendientes; F01 no está aceptada.

## PostgreSQL aislado con Docker Compose — 2026-11-12

**Alcance autorizado:** un servicio PostgreSQL local de F01, sin aplicación, AWS ni datos personales. La rama fue `feat/f01-identidad-multitenant`, con cambios F01 preexistentes sin sobrescribir; `tasks.md` tenía 57/69 marcadas al iniciar. Docker CLI 29.9.3, Compose 5.7.0, contexto `desktop-linux`; `docker ps` no mostraba contenedores. El puerto 55431 tenía cero listeners. Existía un clúster PostgreSQL nativo anterior en `.cache/f01-postgres/data`, detenido; no se reutilizó su directorio de datos ni se eliminó. La imagen [oficial `postgres:18.6-bookworm`](https://hub.docker.com/_/postgres) usa para PostgreSQL 18 el volumen en `/var/lib/postgresql`; el servicio nuevo se define en `compose.f01-postgres.yaml` con proyecto y volumen exclusivos, puerto `127.0.0.1:55431:5432`, `pg_isready`, reinicio desactivado y secreto de 32 bytes generado localmente bajo `.cache/f01-docker/`, ignorado por Git.

Se leyeron las migraciones 001–008 antes de ejecutarlas. Contienen creación de esquema/tablas/roles, grants y políticas aditivas; no contienen `DROP DATABASE`, `DROP TABLE`, `TRUNCATE` ni borrado de filas. El runner valida URL local, nombre de base y rol de migración, y aplica todo en una transacción. Las **pruebas**, separadamente, crean y eliminan solo bases efímeras con sufijo aleatorio bajo `farmafind_f01_test_*` en este clúster aislado. `f01_migrator` es administrador del clúster de prueba, nunca identidad de aplicación; `f01_auth` y `f01_runtime` son `NOLOGIN NOSUPERUSER NOBYPASSRLS`. Los LOGIN de aplicación usados por las pruebas son ficticios, limitados y efímeros.

| Comando / control real | Resultado obtenido |
|---|---|
| `docker compose -f compose.f01-postgres.yaml config --quiet` | Salida 0, configuración válida sin imprimir secreto. |
| `docker compose -f compose.f01-postgres.yaml up -d --wait postgres` | Salida 0; se descargó la imagen oficial y se creó únicamente `farmafind-f01-postgres-postgres-1`, red y volumen propios. |
| `docker compose -f compose.f01-postgres.yaml ps`; consulta `SHOW server_version` | Contenedor `healthy`, puerto solo loopback; servidor `18.6 (Debian 18.6-1.pgdg12+2)`. |
| `npm.cmd run migrate:f01:test` con URL construida desde el secreto local, sin imprimirla | Primera ejecución: 8 aplicadas, 0 presentes; segunda: 0 aplicadas, 8 presentes. |
| Catálogos `pg_roles` y `pg_class` | `f01_auth`/`f01_runtime`: `rolsuper=f`, `rolbypassrls=f`, `rolcanlogin=f`; `abuse_attempt`, `auditoria_acceso`, `delegacion`, `sesion` y `usuario_farmacia`: `ENABLE`/`FORCE RLS=t`, propiedad runtime=`f`. La primera consulta de inspección tuvo un nombre de columna erróneo; se corrigió y la consulta repetida salió 0. |
| `npm.cmd run test:f01:rls` con `F01_TEST_DATABASE_URL` privada de loopback | Salida 0: **8 archivos, 35 pruebas pasadas** con PostgreSQL real. Cubren lectura propia A/B, ausencia de actor, denegación de INSERT/UPDATE/DELETE de membresías (incluida la propia), sesiones, aislamiento de pool, rollback, concurrencia, migraciones y auditoría según los casos existentes. |
| Grants de `f01_runtime` sobre `usuario_farmacia`; listado de bases tras pruebas | `SELECT=t`, `INSERT=f`, `UPDATE=f`, `DELETE=f`; solo quedó `farmafind_f01_test`, sin bases efímeras. |
| `npm.cmd run test:f01:unit`; `npm.cmd run test:f01:api` | Ambas salieron 1 por las pruebas test-first T042/T043 aún sin política T045 ni router T048: 36 unitarias previas pasadas y 17 HTTP pasadas, cuatro HTTP nuevas fallidas por módulo ausente. No se atribuye aprobación a esas suites. |

El resultado RLS acredita la **política base de denegación**, no `USING`/`WITH CHECK` de concesión/revocación local de `TRABAJADOR`. T044 y la migración 009 no se ejecutaron ni se marcaron: el positivo de mutación y su auditoría atómica siguen pendientes. No se montó ruta privilegiada, no se ejecutó BOOT-01 ni GLO-01 y no se cambió `main`. Estado documental al cierre de este bloque: **57/69 tareas marcadas; 12 pendientes**. Los comandos de arranque/parada, secreto privado y prueba reproducible están en [quickstart.md](quickstart.md). No hubo commit, push, despliegue ni eliminación de volúmenes.

## Administración local de TRABAJADOR — 2026-11-12

Este bloque posterior sustituye el estado provisional anterior de T042–T049, sin alterar los resultados históricos de las secciones previas. Rama observada: `feat/f01-identidad-multitenant`; Node.js `24.17.0`, npm `11.13.0`, Docker Engine/CLI `29.9.3`, PostgreSQL local `postgres:18.6-bookworm`. `docker compose -f compose.f01-postgres.yaml ps --format json` confirmó `farmafind-f01-postgres-postgres-1` en estado `healthy`, expuesto solo en `127.0.0.1:55431`. Se emplearon identidades y farmacias ficticias y una URL privada construida desde `.cache/f01-docker/postgres-password.txt`, sin escribirla en la evidencia.

| Verificación ejecutada | Resultado real |
|---|---|
| `npm.cmd run test:f01:unit` | Salida 0: 10 archivos, 54 pruebas; matriz EXC-01/ROL-01, autoelevación, rol no delegable, B y permiso ausente. |
| `npm.cmd run test:f01:api` | Salida 0: 4 archivos, 21 pruebas; contrato local GET/POST/PATCH, CSRF, 401/403/404/409 y respuesta sin datos ajenos. |
| `npm.cmd run test:f01:rls` con `F01_TEST_DATABASE_URL` privada | Salida 0: 9 archivos, 45 pruebas sobre PostgreSQL real. T044 comprueba `USING`/`WITH CHECK`, dueño/admin autorizados, B, autoelevación, rol superior, revocación, conexión reutilizada, auditoría y rollback cuando falla la auditoría. Una primera expectativa de rechazo SQL se corrigió: un UPDATE filtrado por RLS devuelve 0 filas, no error. La repetición pasó. |
| `npm.cmd run test:base` con PostgreSQL local | Última ejecución, salida 0: 36 archivos, 198 pruebas, incluidos los dos casos RLS adicionales. |
| `npm.cmd run build`; `npm.cmd run check` | Salida 0; Vite construyó 35 módulos, TypeScript estricto y comprobación de estructura sin errores. |
| `npm.cmd run migrate:f01:test` con URL privada | Salida 0: migración aditiva `009_membership_mutations.sql` aplicada a la base ficticia local; 1 aplicada, 8 presentes. Repetición idempotente: 0 aplicadas, 9 presentes. Las pruebas usan bases efímeras propias y ejecutan 001–009. No se tocaron datos ni volúmenes externos. |

T045 define la política pura; T046 añade políticas RLS limitadas a `TRABAJADOR` y permiso explícito; T047 mantiene escritura y evento mínimo en la misma transacción; T048 monta solo rutas locales del contrato y T049 muestra la vista React únicamente tras lectura autorizada por servidor. La prueba integrada con HTTP real y PostgreSQL observó concesión 201, duplicado 409, revocación 200, segundo intento 409, A/B denegado, CSRF denegado, rol `DUENO` denegado, actor sin permiso denegado y dos eventos de auditoría sin alterar B. No se habilitaron rutas globales, alta privilegiada ni capacidades de negocio.

Estado después de verificar el bloque: **65/69 tareas marcadas, 4 pendientes**. T050/T051 siguen bloqueadas por GLO-01/BOOT-01; T062 requiere Playwright en entorno oficialmente compatible y T067 revisión humana final. El estado es **local parcial**; `overall` y `acceptance` permanecen pendientes. F01 no está completamente aceptada. No hubo commit, push, despliegue ni modificación de `main`.

## Auditoría previa al versionado — 2026-11-12

En `feat/f01-identidad-multitenant`, se revisaron 95 archivos candidatos: integración F01 en los manifiestos y puntos de entrada F00, y archivos nuevos limitados a `backend/migrations/f01`, Usuarios e identidad, `frontend/src/identity`, `scripts/f01`, Compose PostgreSQL local y `specs/002-f01-identidad-multitenant`. No hay cambios en la Constitution, documentos F00 ni `main`. `git diff --check` salió 0; los avisos de conversión LF/CRLF de Git no son errores de espacios.

| Control repetido antes del commit | Resultado observado |
|---|---|
| `npm.cmd run check`; `npm.cmd run check:config`; `npm.cmd run build` | Salida 0 en los tres; configuración: 2 archivos/34 pruebas, Vite: 35 módulos. |
| `npm.cmd run test:f01:unit`; `npm.cmd run test:f01:api` | Salida 0: 54 y 21 pruebas respectivamente. |
| `npm.cmd run test:f01:rls` con PostgreSQL local `healthy` | Salida 0: 9 archivos/45 pruebas reales; incluye A/B, autoelevación, rol superior, auditoría y rollback. |
| `npm.cmd run test:base` con PostgreSQL local | Salida 0: 36 archivos/198 pruebas. |
| `npm.cmd audit --audit-level=high` | Salida 0: 0 vulnerabilidades reportadas en esta consulta. |

La lista candidata no contiene `.env.local`, `docs/referencias`, `node_modules`, `dist`, cachés ni datos PostgreSQL. `.env.example` tiene claves vacías; los URL de pruebas/documentación usan solo placeholders o credenciales ficticias en loopback. La búsqueda de claves AWS, llaves privadas, asignaciones de secretos no vacías y correos no ficticios en la documentación F01 no encontró material privado. No se incluye el secreto local `.cache/f01-docker/postgres-password.txt`. T050/T051/T062/T067 permanecen `[ ]`; la auditoría no acredita Playwright ni aceptación completa.

## Demostración visual local limitada — 2026-11-12

Rama observada: `feat/f01-identidad-multitenant`; el incremento modifica solo la vista React de identidad y su prueba de presentación. Se creó `backend/.env.f01.local` con secretos aleatorios exclusivamente locales y dos roles LOGIN de prueba (`f01_local_auth` y `f01_local_runtime`) que heredan solo los permisos F01 correspondientes. `git check-ignore` confirmó que el archivo de entorno y `.cache/f01-docker/postgres-password.txt` están excluidos. Ambos LOGIN tienen `rolsuper=false`, `rolbypassrls=false`, `rolcreatedb=false` y `rolcreaterole=false`. Docker Compose mantuvo `postgres:18.6-bookworm` en estado `healthy` y puerto `127.0.0.1:55431`. No se ejecutó BOOT-01 ni GLO-01.

| Control ejecutado en Windows 10 | Resultado observado |
|---|---|
| `npm.cmd run check`; `npm.cmd run build` | Salida 0 en ambos; TypeScript y 47 archivos JS revisados, Vite 7.3.8 compiló 35 módulos. La primera compilación dentro del sandbox falló con `spawn EPERM`; la repetición con permiso de proceso terminó correctamente. |
| `npm.cmd run test:f01:rls` con URL privada de la base local | Salida 0: **9 archivos, 45 pruebas** PostgreSQL reales. |
| `npm.cmd run test:base` con la misma URL | Salida 0: **36 archivos, 199 pruebas**; incluye la nueva prueba de presentación. |
| HTTP de procesos locales | `GET /health` API 200; frontend `/identity` 200; `GET /api/v1/auth/session` anónimo 401. |
| Chrome 157.0.8103.51 local, controlado por DevTools Protocol | Render de `/identity`; confirmación genérica tras registro ficticio; error genérico con contraseña errónea; login, correo del perfil obtenido de sesión, cierre de sesión y aviso tras revocación externa observados. La revocación usó `POST /api/v1/auth/logout` con CSRF en el mismo origen y devolvió 204; al volver a enfocar la pestaña, la vista pidió la sesión y mostró su término. Esto es una comprobación interactiva local, **no** la suite Playwright de T062. |
| Conteos de la base ficticia tras la demostración | 2 usuarios ordinarios `@example.test`, **0 farmacias, 0 membresías**. El selector muestra «No tienes farmacias disponibles». No se fabricó una membresía inicial con privilegios de migración. |
| `git diff --check`; estado de Git | Salida 0 con avisos de conversión LF/CRLF; rama F01, sin commit ni push. |

El recorrido de selección de farmacia **no se pudo demostrar en Chrome** porque no existe ninguna membresía autorizada en la base local. Crear el primer dueño o membresía mediante el rol migrador eludiría el procedimiento inicial BOOT-01, cuya ejecución sigue bloqueada. Las pruebas integradas existentes sí cubren selección propia A/B y denegación cruzada en bases efímeras ficticias; no equivalen a una demostración de navegador sobre la base persistente. T050, T051, T062 y T067 permanecen pendientes; **65/69 tareas** siguen marcadas. El estado local de este incremento visual es parcial; `overall` y `acceptance` de F01 siguen pendientes, al igual que Playwright en entorno oficialmente compatible y la revisión humana.

## Fixture TEST/DEMO aislado del selector — 2026-11-12

La sección anterior describe el estado **previo** a esta autorización. Con aprobación humana expresa posterior se añadió el mecanismo exclusivo de prueba `scripts/f01/demo.mjs`, separado del arranque de aplicación y de cualquier ruta administrativa. `prepare` exigió la rama F01, el clúster Docker local de loopback y la base origen exacta `farmafind_f01_test`; creó una base **nueva** `farmafind_f01_test_be8d3b727053` con comentario `TEST/DEMO`, aplicó las migraciones F01 001–009 sin modelo alternativo y guardó contraseñas/URLs únicamente en `.cache/f01-demo/state.local.json`, ignorado por Git. El rol migrador se usó solo para cargar el fixture aislado; la API utiliza dos LOGIN diferentes sin `SUPERUSER`, `BYPASSRLS`, `CREATEDB` ni `CREATEROLE` que heredan por separado `f01_auth` y `f01_runtime`.

El fixture contiene exactamente **Farmacia Alfa** y **Farmacia Beta**, tres identidades ficticias `@example.test` y cuatro membresías activas, todas `TRABAJADOR`: usuario múltiple en Alfa/Beta, usuario Alfa solo en Alfa y usuario Beta solo en Beta. No hay dueños, administradores, delegaciones ni permisos globales. No se ejecutaron BOOT-01 ni GLO-01. La base persistente mantuvo antes y después **3 usuarios, 3 sesiones, 0 farmacias, 0 membresías**. La base DEMO quedó con 3 usuarios, 2 farmacias, 4 membresías y 12 filas de sesión tras verificaciones repetidas; estas sesiones pertenecen solo al entorno de prueba.

| Comprobación ejecutada | Resultado real |
|---|---|
| `node scripts/f01/demo.mjs prepare` | Salida 0; base nueva y fixture limitado, sin alterar la persistente. |
| `node scripts/f01/demo.mjs verify` | Salida 0 al repetirla; rol runtime sin contexto ve 0 filas, actor múltiple ve 2, actor Alfa solo 1 de Alfa y 0 de Beta, actor Beta solo 1 de Beta y 0 de Alfa; tras `ROLLBACK` vuelve a 0. `usuario_farmacia` conserva `ENABLE` y `FORCE RLS`. |
| API real del fixture | Tres logins ficticios; `GET /me/memberships` devuelve Alfa/Beta, solo Alfa y solo Beta, respectivamente. Selección permitida responde 200 y cada selección cruzada responde 404. No se usó una ruta administrativa de producción para crear datos. |
| Chrome local con DevTools Protocol | En `/identity` el usuario múltiple vio ambos botones y seleccionó Alfa y Beta; el usuario Alfa vio solo Alfa y recibió 404 al intentar Beta; el usuario Beta vio solo Beta y recibió 404 al intentar Alfa. Captura ficticia privada: `.cache/f01-demo/selector-multi.local.png` (ignorada por Git). Esta prueba visual local **no acredita T062/Playwright**. |
| `npm.cmd run check`; `npm.cmd run build`; `npm.cmd run test:base` con PostgreSQL local | Salida 0 en los tres; 48 archivos JS revisados, Vite 35 módulos, **36 archivos/199 pruebas** satisfactorias. |
| `git diff --check`; `git check-ignore` | Sin errores de espacios; estado en rama F01 sin commit/push. Estado privado y captura DEMO excluidos de Git. |

Para reproducir: con PostgreSQL local saludable y el fixture ya preparado, `node scripts/f01/demo.mjs verify`; iniciar `node scripts/f01/demo.mjs start` y `npm.cmd run dev:web` en terminales separadas; abrir `http://127.0.0.1:5173/identity` e iniciar sesión con las cuentas ficticias guardadas **solo localmente** en `.cache/f01-demo/state.local.json`. Detener la API y Vite con Ctrl+C en sus respectivas terminales. Opcionalmente, `docker compose -f compose.f01-postgres.yaml stop postgres` detiene el contenedor compartido, conservando su volumen y **ambas bases**, incluida la persistente; no usar `down -v`. El script `prepare` rechaza sobrescribir un fixture existente. F01 sigue en estado **local parcial**: T050/T051, T062 y T067 permanecen pendientes y no hay aceptación completa.

## Auditoría de versionado DEMO — 2026-11-12

Al iniciar esta auditoría, el contenedor PostgreSQL estaba detenido. Con autorización expresa se inició **solo** `postgres` mediante `compose.f01-postgres.yaml`, se hicieron consultas en transacciones de solo lectura y se detuvo nuevamente el mismo contenedor. No se iniciaron frontend ni backend, no se aplicaron migraciones y no se eliminaron bases ni volúmenes. La base persistente `farmafind_f01_test` conservó **3 usuarios, 3 sesiones, 0 farmacias y 0 membresías**; la cuenta cuya comprobación solicitó el propietario sigue registrada y `ACTIVO`. Su identificador, correo, contraseña y hash no se incorporan a esta evidencia. La base distinta `farmafind_f01_test_be8d3b727053` tenía 3 usuarios ficticios, 15 filas de sesión acumuladas por verificaciones anteriores, 2 farmacias y 4 membresías, todas `TRABAJADOR`.

La lectura SQL con el LOGIN runtime de DEMO confirmó `NOSUPERUSER`, `NOBYPASSRLS`, ausencia de `CREATEDB`/`CREATEROLE`, pertenencia exclusiva a `f01_runtime` y `ENABLE`/`FORCE RLS` en `f01.usuario_farmacia`. Sin contexto leyó 0 filas; con contexto transaccional del usuario múltiple, 2; con Alfa o Beta, 1 propia y 0 de la farmacia ajena; tras cada `ROLLBACK`, 0. No se usó el migrador como rol de aplicación. Las pruebas SQL fueron **solo de lectura** y no sustituyen la suite Playwright pendiente.

Sin servicios, `npm.cmd run check`, `npm.cmd run build`, `npm.cmd run test:f01:unit`, `npm.cmd run test:f01:api` y la prueba de `frontend/tests/identity/auth-view.test.jsx` terminaron con salida 0: 48 archivos JS verificados, Vite 35 módulos, **54 unitarias**, **21 de contratos** y **4 de presentación**. `git diff --check` no halló errores; la inspección de archivos candidatos no encontró secretos incrustados. `git check-ignore` confirmó que `.cache/f01-demo/state.local.json`, la captura privada, el secreto Docker y `backend/.env.f01.local` quedan fuera de Git. El estado de tareas no cambia: **65/69 completas**; T050/T051/T062/T067 siguen pendientes y F01 no está aceptada.
