# Estado del proyecto FarmaFind

**Fecha:** 2026-11-23 · **Rama:** `feat/f021-importacion-inteligente` · **Commits locales sin publicar:** ver «Git» (el último commit de F02.1 publicado es `20f0d00`).

## Bloque actual: verificación técnica de F02.1 y espera de la Puerta 1 (T038)
T038 **NO está aceptada**: la decisión humana es de Andre (ACEPTO / ACEPTO CON OBSERVACIONES / RECHAZO).

### Qué se hizo
- Autorización de trabajo continuo guardada en `CLAUDE.md` («Modo de trabajo autónomo»).
- Corrección de rendimiento del parser XLSX (aprobada por Andre), en commit separado `c4c5f4e`.
- Medición de tiempo y memoria con archivos al límite (`scripts/f021/measure-limits.mjs`), registrada en `specs/013-f021-importacion-inteligente/evidence.md`.
- `docs/validacion-final-maestro-v3.2.md` corregido: F02.5 pasa de 19/63 a 61/64.
- DEMO local levantada sobre el fixture TEST marcado `farmafind_f01_test_ff9770ee82e3` (Alfa y Beta ficticias). Script de preparación `scripts/f021/prepare-demo.mjs`.
- Docker Desktop, PostgreSQL TEST (puerto 55431) y Redis TEST (56379) encendidos por Claude; siguen encendidos mientras Andre prueba la DEMO.

### Pruebas ejecutadas hoy (resultado real)
| Prueba | Resultado |
|---|---|
| Suite focal F02.1 | 21/21 |
| `test:f02:unit` / `test:f03:unit` | 15/15 / 25/25 |
| `test:f03:integration` (Redis TEST) | 3/3 |
| `test:f04:unit` / `test:f04:api` | 18/18 / 6/6 |
| `npm run check` / `npm run build` / `verify:contracts` | correctos (41 operaciones OpenAPI) |
| `scripts/f02/smoke.mjs` (fixture TEST, Alfa/Beta) | correcto |
| Parser tras la corrección (4 archivos: 12 pruebas) | 12/12 |
| Medición de límites | ver evidence.md (XLSX 5000×50: 2.8 s, 366 MiB pico; antes no terminaba) |

### NO ejecutadas (pendientes)
- `test:f02:rls`, `test:f03:rls`, `f021-rls`: bloqueadas porque se conectan a `farmafind_f01_test` como canal administrativo (solo para crear/borrar sus propias bases efímeras). La regla vigente prohíbe cualquier operación sobre esa base. **Espera decisión de Andre.**
- `test:f04:rls` (`scripts/f025/check-f04-rls.mjs`): usa el clúster F02.5, que comparte el puerto 55431 con la DEMO; se ejecutará cuando la DEMO se apague.
- Prueba manual en navegador y T038.

### Estado de base de la DEMO
El fixture ya traía datos de corridas anteriores: Alfa tiene 4 perfiles guardados, 35 importaciones previas y 2 filas de inventario. Beta no tiene perfiles.

## Estado de las funcionalidades (sin cambios por este bloque)
| Fase | Estado |
|---|---|
| F00–F05, F06, F07 | Tareas completas; solo F07 tiene aceptación humana registrada (2026-11-18). |
| F06.1 | 45/47 tareas (T030, T044 pendientes; sin fuente clínica con revisor). **No aceptada.** Gemini apagado. |
| F08 | 32/32 tareas técnicas; decisión humana pendiente. **No aceptada.** |
| F02.5 | 61/64; pendientes T046, T057, T063; F025-RF23 bloqueada. **No aceptada.** Suspendida desde 2026-11-22. |
| F02.1 | 37/38; falta T038. **No aceptada.** |
| F01.1, F04.1, F08.1 | No iniciadas; no se abren hasta cerrar F02.1. |
| F09 (AWS), F10 | Fuera de alcance. F09 solo manual con autorización expresa. |

## Git
- Commit local `c4c5f4e`: `fix(f02): evitar recálculo de columnCount en el parser`. Otros commits locales de este bloque: scripts de medición/DEMO, documentación y `CLAUDE.md` (ver `git log`).
- Nada publicado: push/PR/merge es la Puerta 2 y requiere confirmación de Andre.

## Siguiente
1. Andre prueba la DEMO y decide T038.
2. Si acepta: registrar en `acceptance.md`, marcar T038, commit. Luego Puerta 2 (método de integración a `main` según las protecciones reales de GitHub).
3. Preparar (sin implementar) las decisiones de F01.1 (Puerta 4).

## Nota de entorno
Desde Git Bash, vitest falla («reading 'config'») por la letra de unidad `c:` vs `C:`. Ejecutar desde PowerShell.
