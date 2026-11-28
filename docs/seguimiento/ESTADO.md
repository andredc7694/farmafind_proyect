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
- 2026-11-26 · F07.1: **T024 conforme por Andre** (formulario de dirección y ubicación revisado en la copia temporal).
- 2026-11-26 · **Pedido de Andre:** historial de decisiones en «Revisar ubicaciones» (filtro y paginación) y formulario de decisión ordenado. Requiere las políticas nuevas `f07/009` (borrador fuera de migraciones, hash `21B8A3F6…45BF`) y la enmienda F071-FR-017/018 con D-06: **propuesta presentada, pendiente de aprobación**. Sin código del historial todavía.
- 2026-11-26 · Mejora pendiente ampliada (después de T063, sin empezar): además de la ayuda de dirección y mapa en el registro, que «Mi farmacia» traiga llenos el departamento, la provincia, el distrito y la dirección del registro y centre el mapa en ese distrito.
- 2026-11-26 · Pendiente de investigar (no bloquea): una corrida del frontend reportó 52 archivos y 250 pruebas, sin fallos, en lugar de 53/253; al repetirla dio 53/253.
- 2026-11-26 · F07.1: **enmienda del historial aprobada por Andre** (FR-017/018, D-06 A, SQL `f07/009`). T026–T027 hechas: 009 copiada sin cambios y registrada con su hash. En implementación (T028–T031).
- 2026-11-26 · F07.1: **historial de «Revisar ubicaciones» (enmienda D-06 A y SQL 009 aprobados)** T026–T031 hechas.
  - Pruebas: backend geolocalización 59 en verde y 15 omitidas; frontend 256/256; `check` correcto.
  - Matriz H1 a H8: 18/18 en la base efímera de la copia, con transacción revertida.
  - Se ve en la copia (5174) con datos ficticios.
  - Docker Desktop se había detenido. Con permiso de Andre se encendieron solo los contenedores f025-postgres y f03-search-redis, sin reiniciar la DEMO.
  - Sin PR.
  - Pendientes: T012–T019 tras T057; apagar la copia cuando Andre lo diga; corrida del frontend por investigar. T057 y T063 sin marcar, F02.5 sin aceptar y spec 020 en opción A.
- 2026-11-26 · F07.1: Andre dio por bueno el historial. Se ajustó el estilo de «Revisar ubicaciones» (margen y botones del filtro), comprobado en la copia.
  - DEMO revisada en solo lectura: los datos están intactos. HUAMANFAR tiene 518 productos de inventario y la búsqueda pública funciona.
  - **Copia temporal apagada.** Se borraron solo su base efímera y sus dos roles.
  - El resto de F07.1 (T012–T019, la autorización de T018, el reinicio final y la comprobación de HUAMANFAR) espera a que Andre termine T057.
  - Sin PR. T057 y T063 sin marcar, F02.5 sin aceptar y spec 020 en opción A.
- 2026-11-26 · Andre da por conforme el ajuste visual y el cierre de la copia. Confirma que la tercera propuesta aprobada en la copia («esta bien la direccion») la aprobó él durante su revisión.
- 2026-11-26 · **Corrección pendiente (sin empezar, espera orden de Andre):** revisar el margen de «Revisar solicitudes» (`/admin/farmacias/solicitudes`) y «Mi perfil» (`/mi-perfil`) para que tengan el mismo estilo que «Revisar ubicaciones». Irá en su propia rama cuando se apruebe.
- 2026-11-26 · Andre todavía no hará T057; antes enviará más correcciones del sistema. Cada corrección se registra como pendiente al llegar y solo se trabaja lo que él ordene. No tocar la DEMO ni sus puertos sin avisar. T057 y T063 sin marcar, F02.5 sin aceptar y spec 020 en opción A.
- 2026-11-26 · **Cambio de plan de Andre:** pospone T057 y autoriza usar su DEMO para terminar F07.1. Antes de apagarla o reiniciarla hay que avisarle, y T018 solo se ejecuta con su autorización después de que vea el comando.
  - T012–T017 hechas en bases efímeras del clúster F02.5, ya borradas:
    - 017: 51/51.
    - Matriz RLS: 46/46.
    - E2E: 11/11, sin servicios externos.
    - Regresión del CI en verde; F07 con base de datos: 23 correctas; suites aplicables de F02.5 correctas.
    - Revisión de seguridad de las migraciones correcta.
  - Foto «antes» de la DEMO, en solo lectura: HUAMANFAR con 518 de inventario, 4 importaciones, 0 reservas, 4 usuarios y 2 membresías; el dueño tiene 12 capacidades, sin GEO_LOCATION_PROPOSE.
  - **Pendiente:** autorización de Andre para el reinicio y para T018; después, la aceptación (T019) y el PR.
  - La corrección de márgenes sigue pendiente y fuera de este PR. T057 y T063 sin marcar, F02.5 sin aceptar, spec 020 en opción A.
- 2026-11-26 · F07.1 **T018 hecha** con la autorización de Andre:
  - Copia de seguridad previa: `.cache/f025-docker/backups/…antes-f071_20261126.dump`, de 594 522 bytes.
  - Reinicio con f07/007–009 y f025/017 solo en las bases TEST marcadas.
  - Concesión de revisión ACTIVA para el revisor de la DEMO.
  - HUAMANFAR intacto: 518 de inventario, 4 usuarios y 2 membresías. Su dueño tiene ahora GEO_LOCATION_PROPOSE.
  - `farmafind_f01_test` no se tocó.
  - La carpeta principal está separada de la rama en `a7c5f01` y sirve la DEMO.
  - **Pendiente:** aceptación de Andre (T019) y, después, el PR.
- 2026-11-26 · **F07.1 ACEPTADA por Andre** (T019), tras probarla en su DEMO con HUAMANFAR y el revisor. Registrada en `acceptance.md` y en `approval.md`. Siguiente paso: PR y merge a main con las condiciones de siempre.
- 2026-11-26 · **Pendientes registrados, sin empezar (solo con orden de Andre):**
  - Márgenes de «Revisar solicitudes» y «Mi perfil».
  - Ayuda de dirección y mapa en el registro de farmacia, y que «Mi farmacia» traiga llenos el departamento, la provincia, el distrito y la dirección (después de T063).
  - Investigar la corrida del frontend que dio 52 archivos y 250 pruebas.
  - Andre enviará más mejoras: registrarlas como pendientes al llegar.
  - T057 y T063 sin marcar, F02.5 sin aceptar y spec 020 en opción A.
- 2026-11-26 · **F07.1 integrada en main:** PR #15, merge commit `264469c`, con CI en verde, MERGEABLE y CLEAN, sin secretos y con la rama conservada. La carpeta principal quedó en `main` actualizado; la DEMO no se reinició porque solo cambiaron documentos.
- 2026-11-26 · Andre confirma el merge de F07.1. **Nuevo incremento F03.1, «Búsqueda simplificada y mapa interactivo»** (MEJ-007/008), en la rama `feat/f031-busqueda-mapa` (desde `264469c`), con la spec `specs/022-f031-busqueda-mapa/`. Fase *specify*: **pendiente de su aprobación**; no se programa antes.
- 2026-11-26 · F03.1: **spec aprobada por Andre** con D-01 a D-08 en A.
  - Condiciones: `farmacia.ubicacion` solo para farmacias verificadas y `null` en el resto; contrato y validador de la caché actualizados; prueba de que las entradas viejas de la caché se descartan.
  - Siguiente: plan y tasks para su aprobación.
- 2026-11-26 · F03.1: plan, research, data-model, contrato enmendado (`specs/022/contracts`, 0.2.0; la 004 no se toca), quickstart y tasks (T001–T018) listos. **Pendiente de la aprobación de Andre** antes de programar.
- 2026-11-26 · F03.1: **plan y tasks aprobados por Andre**. Empieza la implementación (T001 en adelante).
- 2026-11-26 · F03.1: T001–T011 hechas.
  - Servidor: `farmacia.ubicacion` y caché.
  - Pantalla: buscador simplificado, «¿Dónde buscas?», tarjetas, mapa conectado y estilos.
  - Pruebas: frontend 266/266, búsqueda backend 36, `check` y build correctos.
  - Siguiente: T012–T016 (base efímera, copia 3001/5174, E2E y regresión).
- 2026-11-26 · F03.1: T012–T015 hechas.
  - Pruebas: base de datos 8/8, E2E en la copia 20/20 sin llamadas externas reales y regresión en verde.
  - El E2E destapó 3 fallos, ya corregidos: texto alternativo de los marcadores, contraste y lista de sugerencias.
  - La copia 3001/5174 está encendida para T016.
- 2026-11-26 · F03.1, revisión de Andre en la copia:
  - Hechos: filtro de lugares al escribir (sin tildes), mapa «Elegir el punto» centrado en Huamanga y casilla alineada. Frontend 271/271, `check` correcto.
  - **Enmienda E-01 propuesta** (16 distritos de Huamanga verificados con el ubigeo INEI, resto del Perú desactivado por configuración, sin duplicados; «Mi farmacia» no cambia). Pendiente de su aprobación.
- 2026-11-26 · F03.1: **E-01 aprobada (opción A) e implementada**: 16 distritos de Huamanga por defecto, el resto del Perú desactivado por configuración y sin duplicados. «Mi farmacia» no cambia.
  - Campo de lugar: lista completa al enfocar, filtro por cualquier parte sin tildes y aviso «No encontramos ese distrito».
  - Pruebas: frontend 277/277; E2E en la copia 20/20.
  - Consulta de Andre: el 0 de «paracetamol 500 mg tabletas x 10» se debe a que la búsqueda compara el texto completo con el nombre o el principio activo, y la sugerencia «presentación» de F08.1 propone ese texto largo. No se cambió; queda para decidir.
- 2026-11-26 · **F03.1 ACEPTADA CON OBSERVACIONES por Andre** (T018), registrada en `acceptance.md` y `approval.md`. Siguiente: PR y merge a `main` con las condiciones de siempre.
- 2026-11-26 · **Corrección pendiente PRIORITARIA, sin empezar:** la búsqueda debe encontrar resultados cuando el texto junta nombre, concentración y presentación (por ejemplo, «paracetamol 500 mg tabletas x 10»), y ninguna sugerencia del buscador debe llevar a una búsqueda vacía.
- 2026-11-26 · **Para F09, antes de cualquier despliegue real:**
  - revisar la configuración `geolocationTest` (también controla si la búsqueda entrega coordenadas);
  - revisar el alcance de lugares `VITE_SEARCH_PLACES_SCOPE` (por defecto `huamanga`);
  - revisar el uso de las imágenes de OpenStreetMap: términos, límites y proveedor para producción.
- 2026-11-26 · **Pendientes, sin empezar:**
  - Búsqueda con texto completo (prioritaria).
  - Márgenes de «Revisar solicitudes» y «Mi perfil».
  - Ayuda de dirección en el registro (después de T063).
  - Corrida de pruebas por investigar.
  - T057 y T063 sin marcar, F02.5 sin aceptar y spec 020 en opción A.
- 2026-11-26 · F03.1: copia temporal apagada.
  - Se borraron solo su base `farmafind_f01_test_6b49fe963285` y sus dos roles.
  - La DEMO, revisada en solo lectura, está idéntica a la foto tomada después de T018 (HUAMANFAR con 518 productos de inventario, 4 usuarios y 2 membresías), y su Redis responde.
- 2026-11-26 · **F03.1 integrada en main:** PR #16 con merge commit `288d72a`. Se cumplieron las condiciones: CI en verde, MERGEABLE, CLEAN, sin secretos y la rama conservada.
- 2026-11-26 · **DEMO actualizada a F03.1** con la autorización de Andre (opción A):
  - Copia previa `.cache/f025-docker/backups/farmafind_f01_test_d0570879cf41_antes-f031_20261126.dump`: 621 855 bytes y 59 tablas de datos.
  - La carpeta principal está en `main` `288d72a`. Se reinició con `demo-stop.ps1` y `demo-run.ps1`; no se aplicaron migraciones nuevas.
  - Verificaciones del arranque: verify-rls 46, application-commands 51 y F04 RLS 37/37.
  - 3000/health, 5173 y 5173/api/v1/auth/csrf responden 200.
  - Revisión en solo lectura, idéntica a la foto tomada después de T018: HUAMANFAR activa con 518 productos de inventario, 4 importaciones, 0 reservas, 4 usuarios y 2 membresías. El dueño tiene 13 capacidades, con GEO_LOCATION_PROPOSE. La concesión del revisor está ACTIVA.
  - La búsqueda devuelve `farmacia.ubicacion` (null mientras HUAMANFAR no esté verificada).
  - `farmafind_f01_test` no se tocó: su contenedor está apagado y en el clúster F02.5 no existe una base con ese nombre.
- 2026-11-26 · Con la autorización de Andre se borró la base de pruebas de T012 `farmafind_f01_test_c8f90caa7c42` y su usuario técnico `f07_test_runtime_c8f90caa7c42`. Antes se comprobó que tenía la marca TEST efímera, que no era la DEMO ni `farmafind_f01_test` y que no tenía conexiones abiertas.
- 2026-11-26 · Andre probó F03.1 en su DEMO: propuso y aprobó la ubicación de HUAMANFAR, que ya aparece en el mapa de la búsqueda. Todo conforme. En espera de su orden; no se empieza nada.
- 2026-11-27 · **F03.2 — Búsqueda con texto completo** (corrección prioritaria pedida por Andre). Rama `feat/f032-busqueda-texto-completo` creada desde `main` `288d72a`; spec en `specs/023-f032-busqueda-texto-completo/`.
  - Paso Spec Kit: **specify**. Spec redactada; espera la aprobación de Andre (decisiones D-01 a D-05). No se programa ni se aplica SQL antes.
  - Sin cambios en la DEMO, su base ni su Redis.
- 2026-11-27 · F03.2: **spec aprobada por Andre** (commit `e4c6116`, D-01 a D-05 en A). Condiciones en `approval.md` (SQL antes de aplicar; base de medición solo en el servidor de pruebas, sin puertos nuevos ni datos fuera de `.cache`, y borrada al terminar).
  - Agregado a su pedido F032-FR-013: ayuda «Escribe también el nombre del medicamento…» cuando solo se escribe presentación o concentración. No exige otra enmienda.
  - Paso Spec Kit: **plan y tasks** redactados con el SQL propuesto en `specs/023-f032-busqueda-texto-completo/sql/`; esperan aprobación. Nada aplicado.
  - Observación: la DEMO estaba apagada al revisar (contenedores detenidos hace ~14 h, sin intervención mía). No se encendió.
- 2026-11-27 · F03.2: **plan y tasks aprobados por Andre** (commit `6d90f9d`). SQL aprobado con correcciones: `concat_ws` en `hay_nombre`/`hay_todo` y mayúsculas con tilde en `translate`; más pruebas (sin presentación o concentración, «ÁCIDO»/«Ácido»/«acido» y palabras cortas). Borrador corregido (`1b2e100`) con nuevos SHA-256 en `approval.md`; espera su visto bueno antes de copiarse a `backend/migrations`.
  - Autoriza encender el contenedor de pruebas (T011) y la DEMO con `demo-run.ps1`, sin aplicar nada de F03.2 en su base.
- 2026-11-27 · **DEMO reencendida** con la autorización de Andre (estaba apagada; contenedores detenidos sin intervención):
  - Copia previa `.cache/f025-docker/backups/farmafind_f01_test_d0570879cf41_antes-arranque-f032_20261127.dump`: 621 855 bytes y 59 tablas de datos. Se encendió solo PostgreSQL para la copia y se volvió a dejar como estaba.
  - Se limpió el registro de procesos viejo con `demo-stop.ps1` (los dos procesos ya no existían; no se detuvo nada ajeno) y se arrancó con `demo-run.ps1`. Sin migraciones nuevas; verificaciones 46/46, 51 y F04 37/37; 3000, 5173 y csrf responden 200.
  - Revisión en solo lectura: idéntica a la foto posterior a F03.1 (518 productos de inventario, 4 importaciones, 0 reservas, 4 usuarios, 2 membresías). **Nada de F03.2 aplicado en su base.**
- 2026-11-27 · F03.2, backend (sin SQL copiado todavía):
  - `domain/search-terms.ts` (limpieza, palabras/tokens, singular, relleno, una letra fuera, falta de nombre); caso de uso con `coincidencia` (EXACTA/APROXIMADA/NINGUNA/FALTA_NOMBRE), solo exactos si existen, caché `v2`; repositorio y sugerencias con la función nueva.
  - Hallazgos en pruebas: «para» no puede descartarse como relleno si es la única palabra (comienzo de «paracetamol»); la sugerencia armaba «null» si faltaba una parte (corregido). En la base, concentración y presentación son `NOT NULL` (F02 002), así que un producto sin ellas no puede existir; `concat_ws` queda como protección.
  - Pruebas: `f032-full-text.test.ts` 20/20 (incluye «toda sugerencia lleva a ≥ 1 resultado» en memoria); backend completo 646 pasan, 2 fallos de entorno conocidos de F06.1.
- 2026-11-27 · F03.2: **visto bueno de Andre al SQL** (hashes `374AEED7…D922` y `C5F0D8F9…873B`, commit `1b2e100`). Copiado sin cambios a `backend/migrations` y registrado en las listas cerradas (`F07_APPROVED` y la nueva `F03_APPROVED`).
  - Base efímera: **sin errores** al aplicarlo; verificación con PostgreSQL real 35/35; base borrada; DEMO intacta y sin F03.2.
  - T001–T010 hechas (backend, contrato 0.3.0, pantalla). Pruebas: backend 645 pasan + 2 fallos de entorno conocidos (F06.1); frontend 282/282; `check` correcto.
  - Siguiente: medición T011 y copia temporal 3001/5174.
- 2026-11-27 · F03.2, T011 (medición con 518 productos, base restaurada desde la copia de seguridad, **ya borrada**): p95 máximo 27.44 ms (cumple ≤ 100 ms) pero hasta 10.64× la búsqueda actual (no cumple «≤ 2×»). Según D-05 se presenta enmienda a Andre; no se cambia SQL sin su aprobación.
  - Observación: en los datos reales las presentaciones dicen «caja x N» / «frasco», por eso «… tabletas» y «… capsulas» dan APROXIMADA (con aviso), como pide la spec.
- 2026-11-27 · F03.2, T013: **copia temporal encendida** (3001/5174, base efímera con datos ficticios, sin Redis compartido ni servicios externos). E2E correcta, axe sin violaciones graves y 0 llamadas externas reales. Espera revisión de Andre.
- 2026-11-27 · F03.2, velocidad (opción A de Andre): v2 «catálogo primero» en los borradores `sql/` (hashes `FDCBBD7F…E5BB` y `005D52E1…3F6D`). Resultados **idénticos** a la v1 en 120 casos con 518 y 5180 ofertas (0 diferencias de filas y orden). p95 de la v2 ≤ 16 ms con 518 y con 5180 ofertas (la v1 llegaba a 218 ms con 5180). Base de medición borrada. Espera visto bueno; los archivos de `backend/migrations` siguen en v1.
  - La Constitution permite corregir `f03/003` y `f07/010` porque no están en `main` ni en la DEMO; el cambio de hash queda registrado en `approval.md`.
  - **Mejora futura (sin empezar):** opción C, guardar el texto limpio en el catálogo, a evaluar junto con la spec 020.
- 2026-11-27 · F03.2: **v2 aprobada y en `backend/migrations`** (hashes `FDCBBD7F…E5BB` y `005D52E1…3F6D`; la v1 se reemplazó porque nunca llegó a `main` ni a la DEMO). PostgreSQL real 35/35; comparación v1/v2 sin diferencias (120 casos, 518 y 5180 ofertas; peor p95 v2 10.45 / 19.43 ms); regresión: backend 646 pasan + 2 fallos de entorno conocidos, frontend 282/282, `check` correcto. Bases efímeras borradas; DEMO sin cambios.
- 2026-11-27 · F03.2: copia temporal **recreada con la v2** (base `farmafind_f01_test_1285f97c8984`; la anterior y sus dos usuarios técnicos se borraron). E2E igual que con la v1, axe sin violaciones graves y 0 llamadas externas reales. Lista para la revisión de Andre.
- 2026-11-27 · **F03.2 ACEPTADA por Andre** (v2 optimizada), registrada en `acceptance.md` y `approval.md`. T001–T015 marcadas con evidencia.
  - Copia temporal apagada; borradas solo su base y sus dos usuarios técnicos. DEMO revisada en solo lectura: idéntica y sin F03.2.
  - Siguiente: PR y merge a `main`; luego aviso a Andre antes de reiniciar la DEMO (copia de seguridad, `f03/003` y `f07/010` solo en bases TEST marcadas).
  - Pendientes sin empezar: márgenes, ayuda de dirección en el registro (después de T063), corrida de pruebas por investigar, opción C (con la spec 020). T057 y T063 sin marcar, F02.5 sin aceptar, spec 020 en opción A.
- 2026-11-27 · **F03.2 integrada en main:** PR #17 con merge commit `3ad229a` (CI 4/4 en verde, MERGEABLE, CLEAN, sin secretos, rama conservada, sin force push).
- 2026-11-27 · **DEMO actualizada a F03.2** con la autorización de Andre:
  - Copia previa `.cache/f025-docker/backups/farmafind_f01_test_d0570879cf41_antes-f032_20261127.dump`: 621 855 bytes y 59 tablas de datos.
  - Carpeta principal en `main` `3ad229a`, backend compilado; reinicio con `demo-stop.ps1` y `demo-run.ps1`. `f03/003` y `f07/010` se aplicaron solo en las dos bases TEST marcadas de la DEMO (`…d0570879cf41` y la técnica `…0e5a2f669e60`); `farmafind_f01_test` apagada y sin tocar.
  - Verificaciones del arranque 46/46, 51 y F04 37/37; 3000, 5173 y csrf responden 200.
  - Solo lectura: datos idénticos a la foto previa (518 productos de inventario, 4 importaciones, 0 reservas, 4 usuarios, 2 membresías). Búsqueda nueva activa («paracetamol 500» → EXACTA; «tabletas» → FALTA_NOMBRE; «ÁCIDO» → EXACTA).
  - HUAMANFAR salía sin ubicación en la búsqueda: en la base de la DEMO su ubicación estaba PENDIENTE y sin coordenadas, con 0 propuestas y 0 auditorías (igual en las copias del 26/11 22:49 y del 27/11 12:56 y en la base técnica). La búsqueda anterior tampoco daba coordenadas, así que no lo causó F03.2.
  - **Aclaración de Andre (27/11): no fue una pérdida de datos.** La propuesta y la aprobación del 26/11 las hizo en la copia temporal (5174), no en su DEMO. **Corrige** la línea del 2026-11-26 que decía «Andre probó F03.1 en su DEMO: propuso y aprobó la ubicación de HUAMANFAR»: fue en la copia temporal.
  - Opción A: Andre repite la propuesta y la aprobación en su DEMO (5173); después se comprueba en solo lectura que quedó guardada y que HUAMANFAR aparece en el mapa.
- 2026-11-27 · Cuenta `mica@farma.find` (DEMO, diagnóstico en solo lectura a pedido de Andre): activa, normal, sin farmacia ni alias. No pudo entrar por 2 contraseñas que no coincidieron y luego por el límite de 5 fallos en 15 minutos desde la misma IP (sumados con 3 fallos de `jose`). Repetir «Crear cuenta» con un correo existente responde igual pero no cambia la contraseña (anti-enumeración). Sin cambios. Mejora posible, sin empezar: aclarar ese mensaje.
- 2026-11-27 · **Pendiente, sin empezar (pedido de Andre):** mejora del asistente: entender preguntas naturales como «¿en qué farmacia el ibuprofeno está más barato?» sin IA externa, responder con tarjetas compactas (las 3 más baratas y «Ver todas en Buscar medicamentos») y verse más grande e interactivo en computadora.
- 2026-11-27 · **F07.2 — Revisión de ubicaciones (corrección)**: rama `feat/f072-revision-ubicaciones` desde `main` `3ad229a`; spec en `specs/024-f072-revision-ubicaciones/`. Paso Spec Kit: **specify**, espera aprobación. Sin cambios en la DEMO.
  - Hallazgos en solo lectura de la DEMO: STUART-FAR tiene la propuesta de 17:33:42 PENDIENTE y la de 17:33:46 aprobada (mismas coordenadas). La ubicación aprobada de HUAMANFAR (-17,195; -70,936) coincide con el centro de Moquegua, a unos 500 km de Ayacucho.
- 2026-11-27 · F07.2: **spec aprobada por Andre** (commit `f602f95`, D-01 a D-06 en A). Condiciones: «Reemplazada» igual para dueño y revisor con prueba del caso real; STUART-FAR sin borrar ni modificar, comprobada en solo lectura tras actualizar la DEMO; HUAMANFAR la corrige Andre después.
  - Paso Spec Kit: **plan y tasks** redactados (15 tareas, **sin SQL**); esperan aprobación. DEMO sin cambios.
- 2026-11-27 · F07.2: **plan y tasks aprobados por Andre** (commit `c85dab4`); agrega el mensaje orientador cuando «Buscar en el mapa» no encuentra la dirección en la ciudad. Paso Spec Kit: **implement**.
- 2026-11-27 · F07.2 implementada (T001–T012 y T014): regla única de «Reemplazada», envío único (pantalla y servidor), búsqueda limitada con centro y mensaje orientador, aviso de distancia y filtro «Reemplazadas». **Sin SQL.**
  - Pruebas: backend 666 pasan + 2 fallos de entorno conocidos (F06.1); frontend 295/295; `check` y contratos correctos; PostgreSQL real F07.2 15/15 (incluida la igualdad dueño/revisor y dos envíos simultáneos) y F03.2 35/35; bases efímeras borradas.
  - Copia temporal 3001/5174 encendida con datos ficticios; E2E correcta, axe sin violaciones graves, 0 llamadas externas. Espera revisión de Andre. DEMO sin cambios.
- 2026-11-27 · **F07.2 ACEPTADA por Andre**, registrada en `acceptance.md` y `approval.md`. Copia temporal apagada y borrada (base y dos usuarios técnicos); DEMO intacta. Siguiente: PR y merge; luego aviso antes de actualizar la DEMO (copia de seguridad y comprobación de STUART-FAR en solo lectura).
- 2026-11-27 · **F07.2 integrada en main:** PR #18 con merge commit `66c5f96` (CI 4/4 en verde, MERGEABLE, CLEAN, sin secretos, rama conservada, sin force push).
- 2026-11-27 · Corrección de la línea del 2026-11-26 «Andre probó F03.1 en su DEMO: propuso y aprobó la ubicación de HUAMANFAR»: fue en la copia temporal (5174), no en la DEMO. No hubo pérdida de datos.
- 2026-11-27 · **DEMO actualizada a F07.2** con la autorización de Andre:
  - Copia previa `.cache/f025-docker/backups/farmafind_f01_test_d0570879cf41_antes-f072_20261127.dump`: 735 186 bytes y 59 tablas de datos.
  - Carpeta principal en `main` `66c5f96`, backend compilado; reinicio con `demo-stop.ps1` y `demo-run.ps1`; sin migraciones nuevas. Verificaciones 46/46, 51 y F04 37/37; 3000, 5173 y csrf responden 200.
  - Solo lectura: datos idénticos a la foto previa (1015 productos de inventario, 6 usuarios, 3 membresías, 1 reserva). Las 3 propuestas conservan sus huellas y siguen las mismas 5 auditorías.
  - **STUART-FAR, propuesta de 17:33:42:** huella `e0522b3879d8ef84df36dd68274795c3` igual a la de antes (PENDIENTE, versión 1, sin revisor: no se borró ni se modificó). Con el SQL de F07.2: «Pendientes» vacío; filtro «Reemplazadas» la muestra como «Reemplazada» (motivo «Se envió una propuesta más reciente», 17:33:46); el historial del dueño muestra lo mismo.
  - Siguiente: Andre corrige la ubicación de HUAMANFAR.
- 2026-11-27 · **Pendientes para una segunda etapa del asistente (pedido de Andre), sin empezar:** consultar «mis reservas» con sesión; asistente para dueños y trabajadores en el panel (poco stock, reservas pendientes); botones «útil / no útil».
- 2026-11-27 · **F06.2 — Asistente FarmaFind AI mejorado**: rama `feat/f062-asistente-mejorado` desde `main` `66c5f96`; spec en `specs/025-f062-asistente-mejorado/`. Paso Spec Kit: **specify**, espera aprobación. Proveedor sigue en MOCK. Sin cambios en la DEMO.
- 2026-11-27 · F06.2: **spec aprobada por Andre** (commit `69ef164`, D-01 a D-10 en A) con ajustes: alternativas solo con misma forma farmacéutica conocida y etiqueta «Mismo principio activo y concentración»; emergencia primero y sin tarjetas; panel que no tape resultados (minimizado recordado en la visita).
  - Paso Spec Kit: **plan y tasks** redactados (17 tareas, **sin SQL**); esperan aprobación. DEMO sin cambios.
- 2026-11-27 · F06.2: **plan y tasks aprobados por Andre** (commit `0767cbd`). Condición: el contexto que envía el navegador es estructurado (medicamento, concentración, forma, distrito; ≤ 1 KB), validado, sin texto libre y nunca escrito en registros, con pruebas de contexto manipulado y demasiado largo. Paso Spec Kit: **implement**. DEMO sin cambios.
  - **Pendiente para evaluar con la spec 020 (sin empezar):** agregar al catálogo un campo explícito de forma farmacéutica (tableta, cápsula, jarabe…) para que las alternativas funcionen con presentaciones reales como «caja x 30».
- 2026-11-27 · F06.2 **implementado** en `feat/f062-asistente-mejorado` (commits `013bf43`, `ae1e6ec`, `9789e59`, `9d7cdc5`), sin SQL y en MOCK. Paso Spec Kit: **implement + converge**; espera **revisión y aceptación de Andre** (T017).
  - Pruebas reales: regresión 989 pasan (1 de entorno a propósito: la prueba con el Redis compartido de la DEMO no se corrió); verificación PostgreSQL real F06.2 14/14, F03.2 35/35, F07.2 15/15 (bases efímeras borradas); `check` 334 archivos; contratos 41 operaciones; E2E en la copia 31/31 (axe, teclado, celular, 0 llamadas externas).
  - Copia temporal 3001/5174 **encendida** con base efímera propia (`farmafind_f01_test_3c04bbedfef2`) y datos ficticios. DEMO **apagada** desde el cierre de la sesión anterior (no la apagué yo); no se toca sin visto bueno.
  - **Incidente:** el primer arranque de la web de la copia usó el puerto 5173 (el de la DEMO) por el comando del proyecto; la DEMO estaba apagada, se detuvo enseguida y se reencendió en 5174. Sin efecto en la DEMO, su base ni su Redis.
  - Decisiones menores (reversibles, para revisión): lugares del asistente = los 16 distritos de Huamanga de «¿Dónde buscas?» (no la lista F07.1 completa); pregunta rápida «Algo más barato con el mismo principio activo» (sin la palabra «genérico», por D-04); «¿y en Carmen Alto?» tras una pregunta de precio pasa a cercanía; «el más barato cerca» = farmacias a ≤ 5 km ordenadas por precio; una sola búsqueda pública por pregunta; contexto > 1 KB se descarta entero (la pregunta sigue); el antiguo `conversacionId` ahora responde 400.
  - Pendientes sin empezar: márgenes; ayuda de dirección en el registro (después de T063); corrida de pruebas por investigar; opción C de F03.2 y campo de forma farmacéutica en el catálogo (con la spec 020); segunda etapa del asistente. T057 y T063 sin marcar, F02.5 sin aceptar, spec 020 en opción A.
- 2026-11-27 · **F06.2 ACEPTADO por Andre** (revisado en la copia temporal), incluidas las tres decisiones menores. Pide además protección de puertos 3000/5173 en la copia temporal (con prueba), cierre de la copia, PR y merge, y encender la DEMO con `main` tras copia de seguridad.
- 2026-11-27 · **F06.2 integrada** (PR #19, merge `672175f`, CI en verde, rama conservada). Incluye el arrancador de copias `scripts/copy/start-copy.mjs` (nunca 3000/5173). Copia F06.2 apagada; borradas solo su base `farmafind_f01_test_3c04bbedfef2` y sus 2 roles.
  - **DEMO encendida con `main` `672175f`.** Copia de seguridad previa `farmafind_f01_test_d0570879cf41_antes-f062_20261127.dump` (735 181 bytes, legible). Foto en solo lectura idéntica antes y después: 1015 inventario, 6 usuarios, 3 membresías, 1 reserva. Asistente 2.0 responde en 5173.
  - T017 de F06.2 cumplida (aceptación, cierre, PR/merge y DEMO) y marcada.
- 2026-11-27 · Andre: F06.2 conforme en su DEMO.
- 2026-11-27 · **Regla de Andre:** si el control de permisos rechaza una orden, no intentarla por otro camino ni con otro comando: detenerse, explicar qué se quería hacer y por qué, y esperar su decisión.
- 2026-11-27 · **Regla de Andre:** desde ahora enciende la DEMO en su propia terminal con `demo-run.ps1`; apagarla o reiniciarla requiere pedírselo antes.
- 2026-11-27 · **T057 hecha por Andre** y **F02.5 ACEPTADO CON OBSERVACIONES (T063, alcance TEST/DEMO)**. Rama `feat/f025-aceptacion`. Evidencia en `specs/012-f025-incorporacion-farmacias/evidence.md` (lectura de la DEMO en solo lectura; búsqueda y seguridad entre farmacias declaradas por Andre). T046, T057 y T063 quedan marcadas. F025-RF23 sigue bloqueado.
  - Observación (a): las cinco importaciones excluyeron entre 523 y 615 filas (583, 523, 550, 615, 535). **La spec 020 pasa a ser prioritaria** (sin empezar).
  - Observación (b): detalles de mejora que Andre enviará después; se registran como pendientes.
  - **Mejora pendiente, sin empezar:** en «Aprobadas», marcar cuál es la ubicación publicada actualmente de cada farmacia, para no confundirla con propuestas posteriores rechazadas.
  - Pendiente opcional: horarios de RHFARMA y FARMAPOINT.
  - Se destraban (sin empezar, esperan orden): spec 020 y la ayuda de dirección y mapa en el registro. La rama `feat/f022-identidad-producto-catalogo` (spec 020) está atrasada respecto a `main` y sus nombres de SQL `f025/016` y `f03/003` ya están ocupados: hay que actualizar plan y tasks antes de programar.
- 2026-11-27 · Rama `feat/sprint2-validacion` (Sprint 2 IS-488, aprobado por Andre: pasos 1–5; el 6 solo si sobra tiempo y avisando). Spec 020 en pausa (SQL sin aprobar).
  - Paso 1 · Cobertura: `@vitest/coverage-v8` 4.1.12 (aprobada por Andre), `npm run test:coverage` (`scripts/coverage/run.mjs`): mismas suites sin base del CI + frontend, fusionadas. Resultado local real: 149 archivos, 867 pruebas aprobadas y 1 omitida; **líneas 57,73 % (3945/6833)**, sentencias 56,24 %, funciones 57,16 %, ramas 55,15 %. HTML en `coverage/index.html`; el CI lo sube como artefacto `cobertura`. Las suites RLS e integración (con PostgreSQL) no entran en este porcentaje.
