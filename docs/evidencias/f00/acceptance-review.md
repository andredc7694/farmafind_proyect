# F00 — Revisión técnica de aceptación

**Fecha:** 2026-11-17
**Estado:** satisfacción técnica propuesta; revisión humana T058 pendiente.

## Par reproducible

| Campo | Preparación A | Preparación B |
|---|---|---|
| Run completo | `F00-A-2026-11-17T13-17-52.485Z` | `F00-B-2026-11-17T13-20-27.925Z` |
| Source hash | `4cfa699e583ad86df9de1d7a0e4815224ab05f807b0ec17d23b3d363b6e9bec5` | mismo |
| Lockfile hash | `12303f176da6ce2c18604eb422e71ba1d7de5fd08f6499ca1c52a4262f267757` | mismo |
| Directorio | Independiente A | Independiente B |
| Bootstrap | 35/35 | 35/35 |
| Regresión base | 276 satisfactorias; 81 omitidas por servicios fuera del subconjunto F00 | igual |
| Build | satisfactorio | satisfactorio |
| Playwright Linux | 1/1 | 1/1 |
| `overall` | `passed` | `passed` |

El comparador produjo `acceptance=passed`, sin razones pendientes, y confirmó directorios diferentes con fuente y lockfile idénticos. Los artefactos completos permanecen en `artifacts/f00/`, excluidos de Git.

## Requisitos y criterios

| Cobertura | Resultado técnico verificable |
|---|---|
| F00-FR-001–006 | Preparación reproducible, stack aprobado, límites modulares, siete responsabilidades, servicio independiente y arranque sin integraciones obligatorias comprobados. |
| F00-FR-007–008 | Configuración pública/privada, rechazos y ausencia de secretos en bundle y reportes comprobados. |
| F00-FR-009–012 | Límites PostgreSQL, RLS, Redis, Unit of Work y Outbox conservados; su operación pertenece a incrementos posteriores. |
| F00-FR-013–015 | Controles automáticos, Playwright compatible, build y preparación futura AWS comprobados sin desplegar. |
| F00-FR-016–020 | Fuentes, 16 criterios, estados, aprobaciones y protección de main conservados. |
| F00-SC-001 | Dos copias limpias independientes del mismo manifiesto y lockfile: satisfecho técnicamente. |
| F00-SC-002 | Frontend, API y Notificaciones observables, separados y limpiados: satisfecho técnicamente. |
| F00-SC-003–004 | Variables y casos de configuración válidos/ausentes/inválidos: satisfechos técnicamente. |
| F00-SC-005 | Siete módulos, IA complementaria y Notificaciones independiente: satisfecho técnicamente. |
| F00-SC-006 | 20 FR y 16 criterios mantienen trazabilidad sin puntajes inventados: satisfecho documentalmente. |
| F00-SC-007 | Comandos, versiones, expectativas, resultados, errores y limpieza registrados: satisfecho técnicamente. |

La evidencia E-F00-01–09 queda representada por los manifiestos, reportes A/B, capturas, resultados HTTP, controles de configuración, build, separación de procesos y comparación consolidada. Esto no otorga puntaje docente ni constituye aprobación humana. T058 permanece abierta hasta registrar la decisión final del responsable.
