# Estado del proyecto FarmaFind

**Fecha:** 2026-11-23 · **Rama de trabajo:** `feat/f011-identidad-personal` (creada desde `feat/f021-importacion-inteligente`) · **Último commit publicado:** ver `git log` de la rama (se publica tras cada lote). **PR #4 (F02.1 → main) fusionado** con merge commit; `main` local actualizado.

## Resumen
- **F02.1: ACEPTADA por Andre el 2026-11-23 («ACEPTO»)**, alcance TEST/DEMO. T038 marcada (38/38). Registro en `specs/013-f021-importacion-inteligente/acceptance.md` y `approval.md`.
- **F01.1 (`specs/014-f011-identidad-personal/`): spec, clarify, plan y tasks aprobados el 2026-11-23. Implementación: implementación técnica completa (T001–T057 verificadas, lotes 1–7); **F01.1 ACEPTADA por Andre el 2026-11-24 («acepto») y **fusionada en main (PR #5)**. Rama activa: `feat/f041-operacion-reservas` (F04.1, spec 015 en borrador)**, alcance TEST/DEMO; DEMO apagada y su fixture eliminado; US4 = segundo factor TOTP del administrador (exigido en la base de datos para `/platform/**`) (T037–T043). PR #4 de F02.1 abierto (sin fusionar, espera confirmación de Andre). No aceptada.**

## Pasos de Spec Kit por incremento
| Incremento | specify | clarify | plan | tasks | analyze | implement | converge | acceptance |
|---|---|---|---|---|---|---|---|---|
| 013 F02.1 | ✔ | ✔ | ✔ | ✔ | — | ✔ 38/38 | — | ✔ ACEPTO 2026-11-23 |
| 014 F01.1 | ✔ aprobada 2026-11-23 | ✔ 5 respuestas 2026-11-23 | ✔ aprobado 2026-11-23 (D-06 = A) | ✔ aprobado 2026-11-23 (58 tareas) | — | ✔ lotes 1–7 (T001–T057); analyze/converge hechos; **ACEPTADA 2026-11-24 (T058)** | — | — |
| 015 F04.1 | ✔ aprobada 2026-11-24 | ✔ D-01..D-03 = A (revisables) | ✔ aprobado 2026-11-24 | ✔ aprobado (19 tareas) | ✔ | ✔ T001–T018 verificadas | ✔ convergence.md | **ACEPTADA 2026-11-24 (T019)** |
| 016 F08.1 | ✔ aprobada 2026-11-24 | ✔ D-01..D-04 = A | ✔ aprobado 2026-11-24 | ✔ aprobado (22 tareas) | ✔ | ✔ T001–T021 verificadas | ✔ convergence.md | **ACEPTADA 2026-11-24** |

## Qué se hizo en este bloque
- Registrada la aceptación T038 y tarea marcada (commit `b33fbe5`).
- DEMO apagada; Docker/PostgreSQL/Redis TEST detenidos (no se borró nada). La base persistente `farmafind_f01_test` quedó **idéntica** (3 usuarios, 3 sesiones, 0 farmacias, 0 membresías; mismas bases listadas) antes y después, comprobado con consultas de solo lectura.
- Autorización de trabajo continuo y flujo Spec Kit guardados en `CLAUDE.md`. Vía de Spec Kit: se leen los `SKILL.md` de `.agents/skills/` y se siguen a mano (mi entorno no los detecta como invocables).
- Creada la spec borrador de F01.1 (`spec.md`) y su checklist de calidad.

## Pruebas ejecutadas (resultado real, 2026-11-23)
| Prueba | Resultado |
|---|---|
| Suite focal F02.1 | 21/21 |
| `test:f02:unit` / `test:f03:unit` | 15/15 / 25/25 |
| `test:f03:integration` (Redis TEST) | 3/3 |
| `test:f04:unit` / `test:f04:api` | 18/18 / 6/6 |
| `npm run check` / `build` / `verify:contracts` | correctos (41 operaciones OpenAPI) |
| `scripts/f02/smoke.mjs` (fixture TEST Alfa/Beta) | correcto |
| Parser tras la corrección (12 pruebas) | 12/12 |
| Medición de límites (ver evidence.md de F02.1) | XLSX 5000×50: 2.8 s, 366 MiB pico |
| Prueba manual en navegador (DEMO) | la hizo Andre; decisión «ACEPTO». No se detallan pasos. |

**No ejecutadas:** `test:f02:rls`, `test:f03:rls`, `f021-rls` (se conectan a `farmafind_f01_test` como canal administrativo; regla vigente lo prohíbe; **espera decisión A/B/C de Andre**) y `test:f04:rls` (clúster F02.5; comparte puerto con la DEMO). No se repitió Playwright.

## Estado de las funcionalidades
| Fase | Estado |
|---|---|
| F00–F05, F06, F07 | Tareas completas; solo F07 con aceptación humana registrada (2026-11-18). |
| F06.1 | 45/47 (T030, T044 pendientes; sin fuente clínica con revisor). **No aceptada.** Gemini apagado. |
| F08 | 32/32 técnicas; decisión humana pendiente. **No aceptada.** |
| F02.5 | 61/64; pendientes T046, T057, T063; F025-RF23 bloqueada. **No aceptada.** Suspendida desde 2026-11-22. |
| F02.1 | **Aceptada** (TEST/DEMO). MEJ-002 fuera de importación sigue pendiente. |
| F01.1 | Spec borrador (014). |
| F04.1 | **Aceptada** (PR #6). |
| F08.1 | **Aceptada** (TEST/DEMO). |
| F01.2 | **Aceptada** (TEST/DEMO). |
| F09 (AWS), F10 | Fuera de alcance. F09 solo manual con autorización expresa. |

## Git
Commits locales sin publicar (desde `20f0d00`): `c4c5f4e` fix parser · `7926dda` scripts de medición/DEMO · `8d6cabc` evidencia y validación final · `23a628a` CLAUDE.md · `b33fbe5` aceptación T038 · más el commit de la spec 014 (rama `feat/f011-identidad-personal`). **Nada publicado.** Push/PR/merge = Puerta 2.

## Siguiente
1. Andre aprueba la spec 014 (o pide cambios) → registrar en `approval.md` → *clarify* con opciones A/B/C.
2. Puerta 2: integración de F02.1 a `main` (propuesta de método en el mensaje de parada).
3. Decisión A/B/C sobre las suites RLS.

## Nota de entorno
Desde Git Bash, vitest falla («reading 'config'») por la letra de unidad `c:` vs `C:`. Ejecutar desde PowerShell. `gh` (GitHub CLI) no está instalado: no pude consultar las protecciones de `main`.

## Decisiones menores tomadas por Claude (para revisión de Andre)
- 2026-11-23 · F01.1 lote 5: el administrador general **sin** factor activo recibe sesión normal para poder enrolarse; `/platform/**` queda cerrado en la base de datos hasta verificar el código. (Reversible; alternativa: sesión restringida a «enrolar».)
- 2026-11-23 · F01.1 lote 5: la prueba heredada `bootstrap-authorization.rls.test.ts` se ajustó para que sus sesiones de administrador nazcan con segundo factor verificado.
- 2026-11-23 · F01.1 lote 4: reemisión de clave temporal solo para cuentas con alias creadas por esa farmacia; el límite de intentos por IP se comparte tras una misma IP (NAT), aceptable en TEST.
- 2026-11-23 · F01.1 lote 6: el perfil usa funciones definer con el rol de autenticación y deriva siempre al usuario de la sesión; cambiar el correo no cierra otras sesiones (cambiar la clave sí).
- 2026-11-23 · F01.1 lote 7: se añadió auditoría `ELEVATION_DENIED` a las denegaciones de gestión de personal (la matriz de seguridad la pedía); se retiró el 429 de `POST …/staff` del contrato (no implementado, ver convergence.md).
- 2026-11-24 · F04.1: Andre aprobó la spec sin elegir A/B/C; apliqué mis recomendaciones D-01=A (sin horario semanal), D-02=A (CSV sin datos del cliente), D-03=A (sondeo 30 s). Revisables.
- 2026-11-24 · F04.1: cierre técnico (T001–T018). Regresión F01–F05 verde salvo `f05:rls` no reejecutado; E2E 4/4; DEMO local encendida en http://127.0.0.1:5173/reservations; esperando aceptación.
- 2026-11-24 · F04.1 ACEPTADA por Andre («acepto»); DEMO apagada y fixture eliminado; PR a main.
- 2026-11-24 · F04.1 integrada en main (PR #6, merge commit). Rama activa feat/f081-experiencia-integrada; spec 016 en borrador (MEJ-011 y sugerencias 3/4/11 fuera por F02.5 sin aceptar y datos/licencias).
- 2026-11-24 · F08.1: Andre aprobó la spec sin elegir A/B/C; apliqué D-01..D-04 = A (alcance por lotes sin MEJ-011; sugerencias 3/4/11 diferidas; tema en perfil o navegador; mapa F07 con punto a mano). Revisables.
- 2026-11-24 · F08.1 cierre técnico (T001–T021): regresión F01–F05/F06.1/frontend 208/208 verde (detalle en `specs/016-f081-experiencia-integrada/evidence.md`), E2E 7/7; `f05:rls` no reejecutado. Contrato del resumen de inventario corregido a 404. Andre decidió H-1 = A como incremento aparte (después de F08.1, SDD completo); mientras tanto rige C (trabajadores sin cifras, mensaje honesto en pantalla). Decisión menor: «Importar» e «Inventario» comparten vista filtrada por capacidades.
- 2026-11-24 · F08.1 ACEPTADA por Andre («acepto»); DEMO apagada, fixture eliminado, contenedores detenidos; PR a main.
- 2026-11-24 · F01.2 (spec 017) en borrador, rama feat/f012-delegacion-trabajadores; espera aprobación de Andre.
- 2026-11-24 · F01.2: spec, plan y tasks aprobados; implementación T001–T011 verificada (evidence.md): regresión verde, matriz RLS trabajador +6, E2E 7/7. DEMO encendida, espera aceptación.
- 2026-11-24 · F01.2 ACEPTADA por Andre («acepto»); DEMO apagada, fixture eliminado; PR a main.
- 2026-11-24 · Orden 6 del roadmap (revisión integrada TEST/DEMO): spec 018 en borrador, rama feat/integral-revision-test-demo; espera aprobación.
- 2026-11-24 · Revisión integrada (spec 018): T001–T011 verificadas (regresión, E2E cruzado, axe, k6, matrices MEJ 19/19 y rúbrica 16/16 sin puntajes, omisiones); 1 hallazgo serio de accesibilidad corregido; DEMO integrada encendida, espera aceptación de Andre.
- 2026-11-25 · Revisión integrada: decisiones menores — se aplicaron migraciones pendientes a fixtures TEST persistentes marcadas (F01 demo, F02, F03, F04, F07), se refrescaron sesiones F07, se ajustaron selectores de E2E heredados por cambios de F04.1/F08.1, y la carga F04 usó la prueba AC05 en el clúster F025 (el script original apuntaba a la base persistente). Omisiones en `specs/018-revision-integrada-test-demo/omissions.md`.
- 2026-11-25 · Revisión integrada (spec 018) ACEPTADA por Andre («ACEPTO»); DEMO apagada, fixture eliminado; PR a main.
- 2026-11-25 · CI GitHub Actions (spec 019): spec en borrador, rama feat/ci-github-actions; espera aprobación de Andre.

## Recordatorios y pendientes (2026-11-25)
**Aceptados e integrados en `main`:** F02.1, F01.1, F04.1, F08.1, F01.2 y la revisión integrada TEST/DEMO (PR #4–#9). F02.5 sigue **sin aceptar**.
1. **SEC-EXC-DEV-2026-001 vence el 2026-12-17.** Propuesta (sin aplicar) en `docs/evidencias/integration/security-exception-review-proposal.md`: hoy `npm audit` da 0 vulnerabilidades; recomendación A = cerrarla tras confirmar el aviso oficial.
2. **Pendientes de `specs/018-revision-integrada-test-demo/omissions.md`:** MEJ-011 (asistente de solicitud), sugerencias 3, 4 y 11, resto de MEJ-002 fuera de la importación, `f05:rls` sin reejecutar, E2E heredado `f04` (fixture persistente con 404) y F06.1 T030/T044. Opciones de prioridad en el mensaje de entrega.
3. **F02.5:** T046 aceptada el 2026-11-25; quedan T057 y T063, verificaciones humanas (guía en `specs/012-f025-incorporacion-farmacias/closure-guide.md`). **Bloqueo técnico:** la protección de hashes del SQL aprobado falla al arrancar la DEMO (CRLF de Windows y `012_public_pharmacy_projection.sql` no coincide con el hash aprobado). F025-RF23 (suspensión de farmacias) sigue aplazada.
4. **No iniciar** F09 (AWS), DNS/CDN ni recursos de pago sin autorización expresa de Andre.
5. **CI GitHub Actions:** aceptado e integrado (PR #10); pendiente la propuesta de protección de rama.
- 2026-11-25 · CI GitHub Actions (spec 019): spec aprobada (D-01..D-04 = A); plan, research y tasks (11) creados, esperan aprobación.
- 2026-11-25 · Andre eligió prioridad P1 (primero F02.5; excepción SEC-EXC-DEV-2026-001 en paralelo). La propuesta de la excepción se conserva SIN aplicar; la decide Andre antes del 2026-12-17.
- 2026-11-25 · CI GitHub Actions (spec 019): implementado T001–T010; 2 jobs verdes (static-unit y postgres-rls F01/F02/F03), prueba negativa en rojo, 1 hallazgo real de portabilidad corregido (bootstrap.mjs). Espera aceptación de Andre (T011).
- 2026-11-25 · CI GitHub Actions (spec 019) ACEPTADO por Andre («ACEPTO»); PR a main. Pendiente propuesta D-03 (protección de rama).
- 2026-11-25 · F02.5: hash de 012 actualizado con permiso de Andre tras comprobar equivalencia con la versión instalada (manual y técnica; sin diferencias de permisos/RLS/grants); comparación normaliza CRLF; .gitattributes *.sql eol=lf. DEMO de F02.5 encendida en http://127.0.0.1:5173/ esperando T046, T057, T063 de Andre (no marcadas).
- 2026-11-25 · F02.5 T046 NO APROBADA por Andre: farma.xlsx (3 hojas) da error genérico y no propone hoja/encabezado/mapeo (F021-FR-001–004, SC-001, MEJ-002). Diagnóstico entregado; corrección sin iniciar, espera aprobación. T057/T063 sin marcar.
- 2026-11-25 · Enmienda F02.1 (importación en un paso + detector por contenido) implementada y probada (T039–T043). F02.5 T046 pendiente de que Andre la repita; T057/T063 sin marcar. Nota: archivo del usuario con 1 hoja; catálogo sin laboratorio genera duplicados.
- 2026-11-25 · Enmienda F02.1: avisos agrupados (T045) y catálogo de la DEMO cargado desde el archivo ficticio de Andre solo en TEST (517 productos; tarea T047 de F02.1). Spec 020 (identidad con laboratorio/marca y propuesta de productos) en preparación. F02.5 T046/T057/T063 sin marcar.
- 2026-11-25 · Spec 020: Andre aprobó las 22 tasks (sin implementar todavía). Integración de la enmienda F02.1: opción A (PR de `feat/f025-cierre-verificacion` solo con ajustes de pantalla hechos, veredicto de T046 y PR MERGEABLE/CLEAN con CI en verde).
- 2026-11-25 · Enmienda F02.1, pantallas del panel (T048–T052) implementadas y probadas en `feat/f025-cierre-verificacion`: inventario con nombres, importar en un paso, historial claro y movimientos. Regresión verde (detalle en evidence.md). Decisiones menores revisables: «Stock bajo» = 1 a 5 disponibles; Historial con vistas «Atendidas / Importaciones / Movimientos»; no se guarda el nombre del archivo.
- **F02.5 sigue SIN ACEPTAR:** T046 (veredicto pendiente), T057 y T063 pendientes; F025-RF23 aplazada. Integrar esta rama en `main` no la acepta.
- 2026-11-25 · Enmienda F02.1 (FR-026–029, T053–T056): exclusión explícita de duplicadas/pendientes e historial detallado, sin migración ni cambios de RLS/permisos; probado con el archivo ficticio original (517 importadas, 583 excluidas; 582 de ellas con precio o stock distinto). DEMO lista para repetir T046. Nombre de archivo: no se guarda (A). F02.5 sigue SIN ACEPTAR: T046, T057, T063.
- 2026-11-25 · Búsqueda pública vacía (F021-SC-006): causa = catálogo TEST sin principio activo (script de carga); corregido y verificado en la DEMO sin cambiar contratos, reglas F03, RLS ni permisos.
- 2026-11-25 · Menú por rol y «Farmacias cercanas» fuera de los menús (enmienda F08.1): **MEJ-003 parcial, MEJ-007 paso inicial; ninguna completa**. Integración de búsqueda, precios y cercanía pendiente (F08.1/F03).
- 2026-11-25 · T046: veredicto pendiente. Sin autorización para PR/fusión a main ni para implementar la spec 020. F02.5 sigue SIN ACEPTAR (T046, T057, T063).

## Cambios pedidos por Andre pendientes de su orden (no empezar sin ella)
- 2026-11-25 · (Detectado por Claude, por decidir) Spec 020: al aprobar un producto nuevo debe exigirse su principio activo; si no, no aparece en la búsqueda pública.
- 2026-11-25 · (Por confirmar con Andre) Dos mensajes anteriores sobre el menú que no llegaron a la conversación: contrastar con la tabla de la enmienda F08.1.
- 2026-11-25 · **Lote «asistente y filtros» (pedido por Andre; va después de integrar `feat/f025-cierre-verificacion`, en rama propia desde `main`; enmienda F06.1/F08.1; partes de MEJ-009 y MEJ-010, sin declararlas completas). Sin empezar.**
  1. Quitar «FarmaFind AI» del menú y «Asistente» del pie; el asistente queda solo como burbuja; la ruta antigua redirige a la búsqueda.
  2. Burbuja: chat (usuario a la derecha, asistente a la izquierda), encabezado con icono, bienvenida con preguntas sugeridas (comparar precios, farmacia cercana, qué información da), aviso de salud una sola vez y fijo abajo, «Minimizar» como icono, desplazamiento al último mensaje, indicador «escribiendo», buen aspecto en celular, tema claro/oscuro y accesibilidad (foco, lector de pantalla).
  3. Enter envía y Shift+Enter salta de línea en computadora; en táctil Enter salta de línea y se envía con el botón; respetar composición IME.
  4. Intenciones sin IA externa (MOCK, US$0, Gemini apagado): saludo, qué información muestra (nombre, concentración, presentación, precio referencial, farmacias, disponibilidad referencial), comparar precios solo con ofertas públicas F03, farmacias cercanas, sin ofertas; rechazo clínico amable que sugiera al químico farmacéutico; nunca stock privado ni datos de otra farmacia. Verificar con «Aciclovir», «Paracetamol» y «hola».
  5. Buscar medicamentos → «Filtros de precio y orden»: quitar el cuadro gris suelto sobre «Recordar estos filtros».
  - Condiciones: no tocar RLS, permisos ni límites de F06; pruebas de navegador (Enter, Shift+Enter, burbuja, menú) y regresión aplicable; no marcar T057 ni T063.
- 2026-11-25 · **T046 ACEPTADA por Andre** (salvedad: 583 filas excluidas pendientes hasta la spec 020). Autorizada la integración de `feat/f025-cierre-verificacion` a `main`; después, lote del asistente y luego spec 020, sin alterar datos ni esquema de la DEMO F02.5 (base TEST separada).
- **F02.5 SIGUE SIN ACEPTAR:** T057 y T063 pendientes (solo Andre); F025-RF23 aplazada. Integrar la rama en `main` no la acepta.
- 2026-11-26 · PR #11 fusionado en main (`f270bbf`); F02.5 sigue SIN ACEPTAR (T057, T063).
- 2026-11-26 · Lote del asistente virtual implementado y probado en `feat/f061-asistente-burbuja` (enmienda F06.1/F08.1; partes de MEJ-009 y MEJ-010, sin declararlas completas). **Pendiente de revisión y aceptación de Andre; sin PR.**
- 2026-11-26 · Spec 020: autorizada su implementación después del lote. Aviso a Andre: las bases TEST son separadas, pero las pruebas de base de datos y navegador usan el mismo puerto que la DEMO F02.5; hay que apagarla mientras corren.
- 2026-11-26 · **Lote del asistente virtual ACEPTADO por Andre** (probado en su DEMO); autorizada su integración a `main`. F02.5 sigue SIN ACEPTAR (T057, T063).
- 2026-11-26 · Spec 020: Andre elige la opción A. Se continúa solo cuando termine T057 y T063 o avise de un rato sin usar la DEMO; mientras tanto no apagarla ni modificarla.
- 2026-11-26 · Regla de Andre: las próximas correcciones se registran como pendientes con fecha, cada una por separado; no se empiezan sin su orden y cada una aprobada va en su propia rama.
- 2026-11-26 · **Hallazgo:** los propietarios activados por F02.5 no reciben `membership.manage` (no ven «Personal»). Andre ordena corregirlo como enmienda F025-FR-029 en `fix/f025-propietario-gestiona-personal`, antes de T057. Plan y borrador SQL `f025/016` (sin ejecutar) **pendientes de su aprobación**; requiere una política RLS de alta nueva, limitada a esa capacidad (aviso dado).
- 2026-11-26 · Observación pendiente, sin orden: HUAMANFAR tampoco tiene `pharmacy.profile.read/write` (la 014; probablemente se activó antes).
- 2026-11-26 · F025-FR-029: Andre aprueba el SQL 016 en lo esencial y pide ampliar la reparación a `pharmacy.profile.read/write`. Ampliación hecha (sin políticas nuevas); hash final `2667F615…27AE` registrado. Pruebas TEST en verde (SQL, navegador, F01.1, spec 017). **Pendiente: aprobación del bloque ampliado; después, aplicar a la DEMO (T069).** No aplicada a la DEMO.
- 2026-11-26 · F025-FR-029: **Andre aprueba el bloque ampliado del SQL 016** (`9d978c2`, hash `2667F615…27AE`). Autoriza aplicarlo a su DEMO y la integración a main. **F02.5 sigue SIN ACEPTAR** (T057 y T063 sin marcar).
- 2026-11-26 · Mejora de «Personal» aprobada por Andre (usuario para entrar visible y aviso de nombre parecido a usuario) en `feat/f011-personal-usuario-visible`; solo frontend. Pendiente de su revisión en la DEMO.
- 2026-11-26 · Forma de trabajo reiterada por Andre: cada corrección se registra como pendiente con fecha y no se empieza sin su orden; cada cambio aprobado va en su rama, con PR y fusión solo si está MERGEABLE y CLEAN, con CI en verde, sin secretos y con la regresión aplicable aprobada.
- 2026-11-26 · **Mejora «usuario visible» de Personal ACEPTADA por Andre**; autorizada su integración a `main`. F02.5 sigue SIN ACEPTAR (T057 y T063 sin marcar); spec 020 en opción A.
- 2026-11-26 · **Pedido de Andre:** incremento nuevo «Mi farmacia: datos, ubicación y horario» (F07.1, parte de MEJ-006 y RF21; MEJ-006 no completa). Incluye pestaña «Mi farmacia», revisión de ubicaciones y direcciones por el administrador de plataforma, `GEO_LOCATION_PROPOSE` para propietarios nuevos y reparados (SQL a revisar antes), horario P2 y acceso visible a «Mi perfil».
- 2026-11-26 · F07.1 en `feat/f071-mi-farmacia`, `specs/021-f071-mi-farmacia/spec.md` (*specify*). **Pendiente de aprobación de Andre** y de las decisiones D-01 a D-05. No se toca la DEMO ni lo aprobado de F07. F02.5 sigue SIN ACEPTAR (T057 y T063 sin marcar); spec 020 en opción A.
- 2026-11-26 · F07.1: **spec aprobada por Andre** («apruebo»). D-01 a D-05 y T057 con la opción A recomendada, pendientes de confirmar. Plan, research, data-model, contrato y quickstart listos; borrador SQL `f025/017` (permiso GEO_LOCATION_PROPOSE, hash `CC87C988…1B9A`) sin registrar ni ejecutar. **Pendiente: aprobación del plan y del SQL.** Los SQL de F07 (`f07/007`, `f07/008`) se escribirán tras esa aprobación porque F07 aplica su carpeta sola.
- 2026-11-26 · F07.1: **plan y SQL `f025/017` aprobados por Andre**; D-01 a D-05 y T057 confirmadas en A. Hash de la 017 registrado en `migrate-f025.ts` (ninguna migración ni hash aprobado editado). `tasks.md` generado: **pendiente de su aprobación**. El SQL de `f07/007` y `f07/008` se mostrará completo antes de escribirlo en migraciones.
- 2026-11-26 · T057 (opción A): Andre hace ahora el recorrido de cinco farmacias **sin el mapa**; registrada la omisión conocida «ubicación en mapa pendiente de F07.1». Mientras tanto: no apagar, reiniciar ni modificar su DEMO ni usar sus puertos. Spec 020 usará `f025/018`.
- 2026-11-26 · F07.1: **tasks aprobadas** por Andre. T001–T002 hechas: SQL `f07/007` y `f07/008` en `specs/021-f071-mi-farmacia/sql-review/` con matriz de pruebas, **sin ejecutar, pendiente de su revisión (T003)**. Aviso: dos políticas nuevas de solo lectura en tablas F01 para el rol interno `f071_policy`; ninguna política de F07 ni restricción de F025 tocada.
- 2026-11-26 · F07.1: **SQL `f07/007` y `f07/008` aprobados por Andre**; T003 hecha. Se ejecutan solo en bases TEST efímeras y marcadas, nunca en `farmafind_f01_test`. Lista cerrada de migraciones F07 con hashes para 007 y 008. El administrador de la DEMO tiene `ADMINISTRADOR_PLATAFORMA`. Siguiente: servidor y pantalla sin puertos (T004–T011). T018 (concesión en la DEMO) pendiente de autorización expresa.
- 2026-11-26 · F07.1: T004–T011 hechas sin usar los puertos de la DEMO. Servidor: revisión de plataforma, estado e historial, límites del Perú y horario. Pantalla: «Mi farmacia», «Revisar ubicaciones», horario público y `/mi-perfil`. Pruebas: backend geolocalización 45, frontend 246/246, `check` y build correctos. Corregido un `check` fallido que se había anotado como correcto (regla de Redis y contratos). **Pendiente: T012–T016 con base de datos y navegador, después de T057**; T018 (concesión en la DEMO) espera autorización expresa.
- 2026-11-26 · F07.1: **copia temporal de revisión visual** autorizada por Andre en http://localhost:5174 (API 127.0.0.1:3001), rama feat/f071-mi-farmacia, con una base TEST efímera nueva (farmafind_f01_test_0627f4917a55) en el servidor 55431 y datos ficticios (dueño, farmacia aprobada y administrador con revisión de ubicaciones). Sin Redis compartido (la copia apunta a un Redis inexistente), sin tocar la DEMO (3000/5173), su base ni farmafind_f01_test. Configuración temporal solo en .cache (fuera de git). No demuestra nada de HUAMANFAR. Al terminar Andre: apagar la copia y borrar solo su base efímera y sus dos roles de conexión.
- 2026-11-26 · **Pedido de Andre (pendiente, sin empezar):** mejora del formulario «Proponer dirección y ubicación» de F07.1: «Buscar en el mapa» con Nominatim (OSM) a través del servidor, búsqueda inversa al mover el marcador, respaldo con lista interna de ciudades del Perú, fuente automática, evidencia opcional, coordenadas en «avanzado», orden visual, interruptor para apagar el servicio y pruebas simuladas. **Detenido:** el plan aprobado de F07 y la spec aprobada de F07.1 excluyen expresamente la geocodificación externa; la Constitution no lo prohíbe. Requiere enmienda aprobada por Andre antes de programar. No exige cambiar los SQL 007 ni 008.
- 2026-11-26 · F07.1: **enmienda «sugerencia de dirección y ubicación» aprobada por Andre (A)**: F071-FR-013 a FR-016 y T020 a T025 registrados; decisión R-06 (Nominatim gratuito, solo este formulario, interruptor apagado por defecto fuera de TEST/DEMO, revisión en F09). En implementación.
- 2026-11-26 · F07.1 enmienda: T020–T023 y T025 hechas (sugerencia de dirección con Nominatim solo en el formulario, límite 1/s, caché, interruptor; respaldo de ciudades; formulario ordenado; burbuja como icono en pantallas estrechas). Pruebas simuladas: backend 55, frontend 253, `check` y build correctos. En la copia temporal para la revisión de Andre (T024). DEMO y su Redis intactos.
- 2026-11-26 · **Mejora pendiente (para después de T063; no se toca F02.5 mientras está en aceptación):** «Usar la misma ayuda de dirección y mapa en el formulario de registro de farmacia». Hoy «Registrar mi farmacia» pide la dirección solo como texto (dirección, departamento, provincia y distrito), sin punto en el mapa. Sin empezar hasta orden de Andre.
