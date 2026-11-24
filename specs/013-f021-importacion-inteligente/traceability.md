# Trazabilidad F02.1 — estado técnico parcial

**Corte:** 2026-11-22. La especificación y el plan están aprobados; F02.1 no cuenta aún con aceptación humana. Los resultados citados están en [evidence.md](evidence.md). Solo T038 permanece abierta.

| Requisitos | Escenarios y éxito | Evidencia real / límite |
|---|---|---|
| F021-FR-001–004 | US1.1–1.3; SC-001, SC-003 | Parser, mapeo y pruebas focales 20/20; Playwright Linux 3/3 para CSV desplazado y XLSX mult hoja. Equivalencias clínicas ambiguas no se aplican automáticamente. |
| F021-FR-005, F021-FR-009 | US1.4; SC-001, SC-002 | Vista previa y abandono sin actualización de inventario en pruebas F02/HTTP; la búsqueda pública se comprobó tras confirmar, no durante preview. |
| F021-FR-006 | US2.1–2.3; SC-002 | Incidencias separadas por precio/cantidad y persistencia RLS; caso de navegador Linux con corrección y nueva vista previa. |
| F021-FR-007, F021-FR-013 | US3.1–3.2, US4.4; SC-005 | Perfil compatible, permiso por farmacia, negativa Alfa/Beta y reutilización de conexión en pruebas PostgreSQL/HTTP; guardado en navegador Linux. |
| F021-FR-008 | US3.3; SC-003 | Conciliación por nombre, concentración, presentación y clasificación; pruebas de mapeo ambiguo. |
| F021-FR-010–011 | US4.1–4.2; SC-004, SC-007 | Confirmación idempotente, revocación, concurrencia, rollback y regresión F04 en TEST; no se alteró el dominio de reservas. |
| F021-FR-012 | US4.3; SC-006, SC-007 | Invalidación F03 tras commit, regresión Redis/fallback y oferta pública actualizada comprobada en Playwright Linux después de confirmar. No se expuso stock privado en la tarjeta. |
| F021-FR-014 | US1.4, US4.1–4.4; SC-004–007 | Build, límites de arquitectura y 41 operaciones OpenAPI correctas; no se cambió contrato público F04. |

MEJ-001/HU11/RF22–RF24/AC13 corresponden a F021-FR-001–005, 007–014. MEJ-002/HU12/RF25/AC12–AC13 corresponde **solo a errores de importación** (F021-FR-006); los demás errores del maestro v3.2 siguen fuera de F02.1. Los siete SC conservan su texto y los resultados incompletos no se consideran aprobados.

## Rúbrica docente: contribución de F02.1, sin puntajes

Los nombres siguen la matriz constitucional basada en `RUBRICA.png`. Una contribución técnica de F02.1 no equivale a cumplimiento global del criterio.

| N.º | Criterio | Contribución o límite F02.1 |
|---|---|---|
| 1 | Identificación del problema y requerimientos | Brecha de importación heterogénea en spec.md; aprobación SDD. |
| 2 | Análisis y diseño del sistema | plan.md, data-model.md, contrato de importación. |
| 3 | Arquitectura de Bajo y alto nivel | Reutilización Clean Architecture y Unit of Work; check modular pasó. |
| 4 | Desarrollo basado en SDD | Spec/plan aprobados y 37/38 tareas verificadas; aceptación humana pendiente. |
| 5 | Pruebas unitarias e integración | 21 focales; RLS, HTTP y regresión F02/F03/F04 registradas. |
| 6 | Pruebas End to End | Cuatro recorridos Playwright Linux, incluida búsqueda pública posterior a la confirmación. |
| 7 | Interfaz y experiencia de usuario | Selector de hoja, mapeo editable, incidencias y perfiles; revisión humana pendiente. |
| 8 | Escalabilidad del Frontend y backend | Límites de 5 MiB/5000 filas/50 columnas; sin prueba de escala general. |
| 9 | Escalabilidad de Base de datos | Índices y RLS aditivos en TEST; sin prueba de escala general. |
| 10 | Configuración de dominio y/o subdominio DNS y CDN | Fuera de F02.1; sin evidencia nueva. |
| 11 | Implementación Cache | Regresión F03 Redis Cache-Aside/fallback y recorrido público integrado. |
| 12 | CI/CD | Checks locales ejecutados; sin cambio de pipeline ni despliegue. |
| 13 | Pruebas de Carga k6 | Fuera del incremento; sin resultado nuevo. |
| 14 | Codigo fuente y base de datos en Github | Código/migración TEST preparados; publicación aún no realizada. |
| 15 | Informe Final | evidence.md técnico completo para F02.1; aceptación final pendiente. |
| 16 | Presentación y dominio del Tema | DEMO técnica en navegador; revisión humana pendiente. |
