# Tasks: F07.1 — Mi farmacia (casilla solo con evidencia real en `evidence.md`)

**Estado:** aprobado por Andre el 2026-11-26 («apruebo»). Leyenda: **[PUERTO]** = necesita PostgreSQL, API o el navegador en los puertos de la DEMO; se hace **solo después de que Andre termine T057** (o en un rato libre que él indique). **[PUERTA]** = me detengo a esperar su aprobación.

## Fase 1 · SQL para revisión (sin puertos)
- [X] T001 Redactar el SQL completo de `f07/007_platform_location_review.sql` en `specs/021-f071-mi-farmacia/sql-review/` (fuera de la carpeta de migraciones, para que no se aplique solo): concesión de plataforma, funciones SECURITY DEFINER, políticas nuevas y la función de lista para el revisor con solo datos públicos. Incluir la **matriz de pruebas** que demuestra que el revisor no lee inventario, reservas, personal, contacto ni documentos (FR-005, FR-010). Si exige tocar políticas de F07 o la restricción de F025: detenerse y avisar.
- [X] T002 Redactar el SQL de `f07/008_opening_hours.sql` (horario, RLS y proyección pública) en la misma carpeta, con su matriz (FR-008, FR-010).
- [X] T003 **[PUERTA]** Revisión y aprobación de Andre del SQL de T001 y T002 (hashes). Después, mover los archivos aprobados a `backend/migrations/f07/` sin cambiarlos.

## Fase 2 · Servidor (sin puertos: unitarias y API con dobles)
- [ ] T004 Casos de uso, repositorio y router de revisión de plataforma: lista y decisión (aprobar o rechazar con motivo, evidencia y versión; solo la última pendiente; 403 para miembros o autores; 409 ante versión obsoleta). Pruebas unitarias y de API (FR-005, D-04).
- [ ] T005 Estado e historial de ubicación de la propia farmacia (`GET /farmacias/:id/ubicacion`), con «Reemplazada» calculada y autores mostrados sin identificadores internos. Pruebas (FR-006).
- [ ] T006 Validación de límites del Perú en la propuesta (servidor). Pruebas (FR-004).
- [ ] T007 Horario: casos de uso, routers privado y público, caché Redis con invalidación al guardar. Pruebas (FR-008).

## Fase 3 · Pantalla (sin puertos: pruebas de componentes)
- [ ] T008 Pestaña «Mi farmacia» que sustituye a «Farmacia y ubicación»: contacto (sale de `/inventory`), dirección y ubicación (pin, una sola lectura del dispositivo con permiso, coordenadas), estado e historial. Pruebas (FR-001 a FR-004, FR-006).
- [ ] T009 Pantalla «Revisar ubicaciones» para el administrador de plataforma y enlace en el menú solo si el servidor lo permite. Pruebas (FR-005).
- [ ] T010 Editor de horario y su muestra en la búsqueda y el mapa públicos (escritorio y 390 px). Pruebas (FR-008).
- [ ] T011 Página `/mi-perfil` y enlace «Mi perfil» en «Mi cuenta», sin cambiar las reglas del perfil. Pruebas (FR-009).

## Fase 4 · Base de datos y navegador [PUERTO]
- [ ] T012 [PUERTO] Pruebas SQL de `f025/017` en la base TEST técnica: solo el dueño recibe el permiso; trabajador y administrador global no; insert directo rechazado; reparación idempotente que respeta revocaciones y atribuye al revisor (FR-007).
- [ ] T013 [PUERTO] Matriz RLS de la revisión de plataforma en una base efímera (la de T001), con conexión reutilizada Alfa → Beta (SC-002).
- [ ] T014 [PUERTO] Matriz RLS del horario y su proyección pública (SC-004).
- [ ] T015 [PUERTO] E2E: el propietario propone, el administrador aprueba y aparece «Verificada» en el mapa; un rechazo no cambia lo publicado; horario visible; «Mi perfil» desde «Mi cuenta»; escritorio y 390 px (SC-001, SC-003, SC-004).
- [ ] T016 [PUERTO] Regresión: F07 completo, F02.5, F01.1, F03 y F08; `check`, build y contratos (SC-005).

## Fase 5 · Cierre
- [ ] T017 Revisión de seguridad de las migraciones; `evidence.md`, `convergence.md`, `traceability.md` y `ESTADO.md`.
- [ ] T018 **[PUERTA]** Aplicación a la DEMO en un único reinicio con todo el SQL aprobado (`f025/017`, `f07/007`, `f07/008`). Incluye conceder la revisión de ubicaciones al revisor TEST de la DEMO (alta de datos, con autorización expresa de Andre). Reporte de HUAMANFAR antes y después, con inventario, importaciones y reservas intactos.
- [ ] T019 **[PUERTA]** `acceptance.md`: aceptación humana de Andre (nunca autoaprobar). Con su ACEPTO: PR y fusión con merge commit solo si está MERGEABLE y CLEAN, con CI en verde, sin secretos y con la regresión aplicable aprobada.

## Dependencias
T001–T002 → T003 → T013, T014 (y el código de T004 y T007 se ajusta al SQL aprobado). T004–T011 pueden avanzar en paralelo con T057 de Andre (sin puertos). T012–T016 después de T057. T018 después de T016. T019 al final.
