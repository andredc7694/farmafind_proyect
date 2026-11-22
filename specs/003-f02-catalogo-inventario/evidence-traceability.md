# F02 — Trazabilidad de requisitos, escenarios y rúbrica

**Estado:** evidencia técnica y revisión humana global del alcance F02 TEST/DEMO al 2026-11-12; no equivale a operación productiva ni puntuación académica. Las pruebas unitarias/API/RLS se ejecutaron en Windows 10; Playwright se ejecutó dentro de la imagen oficial Linux versionada. Los resultados concretos están en [implementation-evidence.md](implementation-evidence.md). Los nombres de archivo sugeridos por tareas T015/T021/T029/T035 se consolidaron en una batería SQL/API `rls-foundation.test.ts`.

| Requisito | Historia | Escenario de éxito | Implementación y comprobación |
|---|---|---|---|
| F02-FR-001 | US1 | SC-001 | Dominio y catálogo en `medicamentos/`; `catalog-domain.test.ts`, `rls-foundation.test.ts` |
| F02-FR-002 | US1 | SC-001 | Migración 002, ruta de lectura sin mutación global; SQL/API en `rls-foundation.test.ts` |
| F02-FR-003 | US2 | SC-002, SC-005–006 | Migración 003, dominio inventario; `inventory-domain.test.ts`, `rls-foundation.test.ts` |
| F02-FR-004 | US2–US4 | SC-002, SC-004 | Contexto autorizado y capacidades; `authorization.test.ts`, `rls-foundation.test.ts` |
| F02-FR-005 | US2 | SC-002, SC-004 | Matriz dueño/admin con permiso explícito; trabajador denegado en SQL/API |
| F02-FR-006 | US2–US4 | SC-004 | Rutas privadas y RLS A/B; `rls-foundation.test.ts` |
| F02-FR-007 | US2–US4 | SC-004 | Migraciones 001/003/004, transacción tenant y pruebas de contexto/pool |
| F02-FR-008 | US2, US4 | SC-002, SC-005 | Validación de precio/cantidad/compromisos en dominio y SQL/API |
| F02-FR-009 | US2, US4 | SC-002, SC-003 | Movimiento atómico antes/después; `inventory-domain.test.ts`, RLS suite |
| F02-FR-010 | US2 | SC-006 | Fecha solo en revisión; pruebas de dominio y lectura SQL |
| F02-FR-011 | US3 | SC-003 | Parser CSV/XLSX, mapeo, vista previa; `import-preview.test.ts`, RLS suite |
| F02-FR-012 | US3 | SC-003 | Conciliación y errores por fila; `import-preview.test.ts`, RLS suite |
| F02-FR-013 | US4 | SC-003, SC-005 | Transacción total de confirmación; `import-confirm.test.ts`, RLS suite |
| F02-FR-014 | US4 | SC-003–004 | Revalidación, caducidad, concurrencia; RLS suite |
| F02-FR-015 | US4 | SC-003–004 | Historial tenant y estado; RLS suite y cliente React |
| F02-FR-016 | US3–US4 | SC-003 | Descarte de archivo bruto, límites y `.cache` ignorado; pruebas parser y revisión Git |
| F02-FR-017 | US2–US4 | SC-004 | Sesión/selector F01 reutilizados, FIX-01 aislado; smoke HTTP repetido satisfactoriamente tras el último refactor |
| F02-FR-018 | US1–US4 | SC-007 | React en español y contratos HTTP; pruebas jsdom/SSR y Playwright Linux ejecutadas; revisión global F02 registrada |
| F02-FR-019 | US1–US4 | SC-001–007 | Suites unitarias, API, RLS y Playwright Linux ejecutadas; revisión global F02 registrada |
| F02-FR-020 | Todas | SC-004, SC-007 | Límite de módulos comprobado en `check-project.mjs`; sin F03, Redis, AWS, BOOT-01 o GLO-01 |

**Escenarios:** SC-001 corresponde al catálogo (US1); SC-002, SC-005 y SC-006 al cambio manual (US2); SC-003 a vista previa y confirmación (US3/US4); SC-004 atraviesa todas las operaciones tenant; SC-007 exige interacción real de las cuatro historias. Las pruebas automáticas locales cubren reglas y contratos; el recorrido de navegador se ejecutó en Linux. El usuario aprobó globalmente la revisión del alcance F02 el 2026-11-12.

## Aporte a los 16 criterios docentes

La rúbrica y la matriz de la Constitution se trazan sin asignar puntajes ni declarar el criterio académico completo. `Contribución F02` significa solo la evidencia indicada; `pendiente` requiere trabajo o revisión fuera de este incremento.

| N.º | Criterio de la rúbrica | Contribución F02 y pendiente |
|---|---|---|
| 1 | Identificación del problema y requerimientos | `spec.md` define 20 FR y cuatro historias; diagnóstico global pendiente. |
| 2 | Análisis y diseño del sistema | `data-model.md`, contrato HTTP y migraciones F02; revisión integral UML/ERD pendiente. |
| 3 | Arquitectura de Bajo y alto nivel | Módulos/puertos/adaptadores F02; C4 y ADR globales pendientes. |
| 4 | Desarrollo basado en SDD | Spec, plan, tareas y checklist F02; revisión humana global registrada. PR de revisión pendiente al redactar esta matriz. |
| 5 | Pruebas unitarias e integración | 15 F02 unitarias y 14 F02 RLS/API ejecutadas; reporte global pendiente. |
| 6 | Pruebas End to End | 3 pruebas Playwright F02 ejecutadas en Linux; los recorridos de otros módulos y la revisión académica siguen pendientes. |
| 7 | Interfaz y experiencia de usuario | UI mínima española, interacción jsdom y recorridos de navegador F02; accesibilidad/usabilidad académicas pendientes. |
| 8 | Escalabilidad del Frontend y backend | Sin medición de escalado F02; pendiente. |
| 9 | Escalabilidad de Base de datos | Índices y RLS F02; EXPLAIN/carga/escala medidos pendientes. |
| 10 | Configuración de dominio y/o subdominio DNS y CDN | Sin DNS/CDN; pendiente. |
| 11 | Implementación Cache | Sin Redis Cache-Aside operativo; pendiente. |
| 12 | CI/CD | Comandos locales disponibles; pipeline/revisión/deploy protegido pendientes. |
| 13 | Pruebas de Carga k6 | Sin prueba de carga; pendiente. |
| 14 | Codigo fuente y base de datos en Github | Código y migraciones locales; versionado/revisión de secretos antes de publicación pendientes. |
| 15 | Informe Final | Esta evidencia no sustituye informe académico; pendiente. |
| 16 | Presentación y dominio del Tema | DEMO ficticia preparada; presentación y defensa pendientes. |
