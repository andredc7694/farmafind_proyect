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
3. **F02.5:** T046, T057 y T063 son verificaciones humanas (guía en `specs/012-f025-incorporacion-farmacias/closure-guide.md`). **Bloqueo técnico:** la protección de hashes del SQL aprobado falla al arrancar la DEMO (CRLF de Windows y `012_public_pharmacy_projection.sql` no coincide con el hash aprobado). F025-RF23 (suspensión de farmacias) sigue aplazada.
4. **No iniciar** F09 (AWS), DNS/CDN ni recursos de pago sin autorización expresa de Andre.
5. **CI GitHub Actions:** spec 019 en borrador (espera aprobación).
- 2026-11-25 · CI GitHub Actions (spec 019): spec aprobada (D-01..D-04 = A); plan, research y tasks (11) creados, esperan aprobación.
- 2026-11-25 · Andre eligió prioridad P1 (primero F02.5; excepción SEC-EXC-DEV-2026-001 en paralelo). La propuesta de la excepción se conserva SIN aplicar; la decide Andre antes del 2026-12-17.
- 2026-11-25 · CI GitHub Actions (spec 019): implementado T001–T010; 2 jobs verdes (static-unit y postgres-rls F01/F02/F03), prueba negativa en rojo, 1 hallazgo real de portabilidad corregido (bootstrap.mjs). Espera aceptación de Andre (T011).
- 2026-11-25 · CI GitHub Actions (spec 019) ACEPTADO por Andre («ACEPTO»); PR a main. Pendiente propuesta D-03 (protección de rama).
- 2026-11-25 · F02.2 (spec 020): identidad con laboratorio/marca y propuestas de productos; spec en borrador en feat/f022-identidad-producto-catalogo; espera aprobación (D-01..D-05). Depende de integrar la enmienda F02.1.
