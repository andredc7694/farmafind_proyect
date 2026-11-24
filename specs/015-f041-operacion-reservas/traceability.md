# Trazabilidad F04.1

Matriz viva con evidencias reales de [evidence.md](evidence.md). Sin puntajes; no equivale a aceptación.

| MEJ | HU | RF | FR / SC | Tareas | Pruebas | Estado |
|---|---|---|---|---|---|---|
| MEJ-013 | HU21 | RF34–35 | F041-FR-001–005, 009, 012; SC-002, 003, 005 | T009–T013 | `f041-ops.rls`, `f041-http`, `f041-center.test.jsx`, E2E | Verificado técnicamente (aceptación pendiente) |
| MEJ-014 | HU22 | RF36 | F041-FR-006–008; SC-001 | T002–T008 | `f041-pickup-preference`, `f041-ops.rls`, E2E | Verificado técnicamente (aceptación pendiente) |
| F04 / ADR-F04-SEC-001 / F04-TIME-01 | — | — | F041-FR-009–011, 013–014; SC-004, 006 | T003–T004, T007, T014 | F04 rls 26/26, regresión F01–F05 | Verificado técnicamente |

## Rúbrica docente (16), contribución de F04.1 sin puntajes
| N.º | Criterio | Contribución o límite |
|---|---|---|
| 1 | Identificación del problema y requerimientos | spec con 14 FR y 6 SC (MEJ-013/014). |
| 2 | Análisis y diseño del sistema | plan, research, data-model, contrato de 3 operaciones. |
| 3 | Arquitectura de bajo y alto nivel | Clean Architecture verificada (`npm run check`); tabla aislada sin tocar el camino de stock. |
| 4 | Desarrollo basado en SDD | Spec, plan y tasks aprobados; 18/19 tareas verificadas; T019 pendiente. |
| 5 | Pruebas unitarias e integración | F04 48/22/26, frontend 147, AC05 con preferencia. |
| 6 | Pruebas End to End | 4 recorridos Playwright Linux. |
| 7 | Interfaz y experiencia de usuario | Centro de atención, preferencia e historial; revisión humana pendiente. |
| 8 | Escalabilidad del Frontend y backend | Medición con 5000 filas (exportación 235 ms mediana); sin prueba de escala general. |
| 9 | Escalabilidad de Base de datos | Índice parcial de historial; sin prueba de escala general. |
| 10 | Dominio/subdominio DNS y CDN | Fuera de F04.1. |
| 11 | Implementación Cache | Sin cambios (las lecturas van a PostgreSQL por RLS). |
| 12 | CI/CD | Comprobaciones locales; sin pipeline. |
| 13 | Pruebas de carga k6 | Fuera del incremento. |
| 14 | Código fuente y base de datos en GitHub | Rama publicada por lotes; migración 008 solo para TEST. |
| 15 | Informe final | evidence.md y convergence.md; aceptación pendiente. |
| 16 | Presentación y dominio del tema | DEMO técnica y guía; revisión humana pendiente. |
