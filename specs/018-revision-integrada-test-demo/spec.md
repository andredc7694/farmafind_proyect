# Feature Specification: Revisión integrada TEST/DEMO (orden 6 del roadmap v3.2)

**Feature Branch**: `feat/integral-revision-test-demo`
**Created**: 2026-11-24
**Status**: Borrador, **espera aprobación de Andre**.
**Fuente**: `docs/roadmap-implementacion-v3.2.md` fila 6; `docs/trazabilidad-maestro-v3.2.md` (MEJ-001–019); Constitution XIV (16 criterios de la rúbrica, sin inventar puntajes).

## Situación (lenguaje sencillo)
Los incrementos 1–5 del roadmap están hechos: F02.5 (pendiente de 3 tareas humanas), F02.1, F01.1, F04.1, F08.1, más F01.2 (delegación). El siguiente paso del documento maestro es una **revisión integrada**: comprobar que todo funciona junto, dejarlo documentado y decir con honestidad qué falta. No agrega funciones nuevas ni declara producción.

## Qué se hace
1. **Regresión completa** F00–F08, F06.1, F01.1, F02.1, F04.1, F08.1, F01.2 y F02.5 (unitarias, API, PostgreSQL RLS, Redis, Outbox F05, contratos OpenAPI, build/check).
2. **Pruebas cruzadas** entre módulos (lo que cada incremento por separado no cubre): flujo completo por actor sobre un solo fixture Alfa/Beta (importar inventario → publicar oferta → buscar → reservar → notificar/Outbox → atender → historial/exportar), trabajador delegado, cambio de farmacia, revocación, Redis caído, aislamiento Alfa/Beta con conexión reutilizada.
3. **E2E Playwright Linux** de todas las suites (F01…F08.1, F01.2) y **accesibilidad automatizada** (`@axe-core/playwright`, ya instalada) sobre pantallas clave en claro y oscuro.
4. **Carga k6** con los criterios originales ya definidos (F03 búsqueda y F04 reservas) sobre TEST local; resultados reales, sin extrapolar a producción.
5. **Matriz MEJ-001–019 → HU → RF → AC → prueba → evidencia** y **matriz de los 16 criterios de la rúbrica** (Constitution XIV) **sin puntajes**, con enlaces a evidencia real.
6. **Informe de omisiones y riesgos** (F02.5 T046/T057/T063 y F025-RF23, MEJ-011 y sugerencias 3/4/11, F06.1 T030/T044 sin fuente clínica, `f05:rls`, F09/F10 fuera, SEC-EXC-DEV-2026-001 vence 2026-12-17).
7. **Revisión humana guiada**: DEMO integrada con guía por actor para que Andre la recorra.

## Requisitos
- **RI-001**: Toda la regresión se ejecuta en bases TEST efímeras; nunca `farmafind_f01_test`.
- **RI-002**: Cada MEJ (19) y cada criterio de rúbrica (16) tiene fila con evidencia real o «omitido/pendiente» explícito.
- **RI-003**: Cero accesos cruzados Alfa/Beta en la matriz cruzada; sin BYPASSRLS; sin cambios de comportamiento en módulos aceptados.
- **RI-004**: Resultados de carga y accesibilidad se registran tal cual (incluidos fallos); un hallazgo de severidad alta se corrige solo con alcance pequeño o se lista como decisión.
- **RI-005**: US$0; sin Gemini, AWS, DNS/CDN reales ni servicios de pago; no se declara producción ni se otorga puntaje docente.
- **RI-006**: No se marcan tareas de aceptación humana de F02.5, F06.1 ni F08 por mí.

## Criterios de éxito
SC-001 regresión completa verde (o fallos documentados). SC-002 flujo cruzado E2E pasa. SC-003 axe sin violaciones críticas/serias en las pantallas clave, o listadas. SC-004 k6 cumple los umbrales originales (p95 y tasa de error) o se documenta la causa. SC-005 matrices MEJ (19/19) y rúbrica (16/16) completas. SC-006 informe de omisiones aprobado por Andre.

## Decisiones abiertas (recomendación primero)
- **D-01 · Alcance de correcciones**: (A, recomendada) corregir solo hallazgos críticos/serios de seguridad o accesibilidad dentro de esta revisión, en commits separados y con prueba; el resto queda como lista priorizada; (B) solo informar, sin tocar código; (C) corregir todo lo encontrado.
- **D-02 · F02.5 pendientes**: (A, recomendada) dejarlos registrados como pendientes humanos (T046, T057, T063); (B) incluir su revisión humana en esta DEMO para intentar cerrarlos.
- **D-03 · MEJ-011 y sugerencias 3/4/11** (diferidas en F08.1): (A, recomendada) mantenerlas fuera hasta cerrar F02.5 y registrarlas como omisión; (B) abrir un incremento aparte ya.
- **D-04 · Cierre del roadmap**: (A, recomendada) tras la aceptación, pasar a decidir F09 (AWS) solo con tu autorización expresa; no se avanza sin ella.

## Fuera de alcance
Producción, F09/F10, proveedores externos, datos reales, nuevas funciones, reabrir aceptaciones históricas.
