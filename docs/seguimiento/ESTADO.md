# Estado del proyecto FarmaFind

**Fecha:** 2026-11-23 · **Rama de trabajo:** `feat/f011-identidad-personal` (creada desde `feat/f021-importacion-inteligente`) · **Último commit publicado:** ver `git log` de la rama (se publica tras cada lote). **PR #4 (F02.1 → main) fusionado** con merge commit; `main` local actualizado.

## Resumen
- **F02.1: ACEPTADA por Andre el 2026-11-23 («ACEPTO»)**, alcance TEST/DEMO. T038 marcada (38/38). Registro en `specs/013-f021-importacion-inteligente/acceptance.md` y `approval.md`.
- **F01.1 (`specs/014-f011-identidad-personal/`): spec, clarify, plan y tasks aprobados el 2026-11-23. Implementación: lotes 1–6 (T001–T048: base + US1–US5) completados y verificados; siguiente = Fase 8 (T049–T058); US4 = segundo factor TOTP del administrador (exigido en la base de datos para `/platform/**`) (T037–T043). PR #4 de F02.1 abierto (sin fusionar, espera confirmación de Andre). No aceptada.**

## Pasos de Spec Kit por incremento
| Incremento | specify | clarify | plan | tasks | analyze | implement | converge | acceptance |
|---|---|---|---|---|---|---|---|---|
| 013 F02.1 | ✔ | ✔ | ✔ | ✔ | — | ✔ 38/38 | — | ✔ ACEPTO 2026-11-23 |
| 014 F01.1 | ✔ aprobada 2026-11-23 | ✔ 5 respuestas 2026-11-23 | ✔ aprobado 2026-11-23 (D-06 = A) | ✔ aprobado 2026-11-23 (58 tareas) | — | **en curso: lotes 1–6 hechos (T001–T048); siguiente Fase 8 (T049–T058)** | — | — |
| F04.1, F08.1 | no iniciados (siguiente número libre: 015) | | | | | | | |

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
| F04.1, F08.1 | No iniciadas. |
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
