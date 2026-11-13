# Trazabilidad F03

## Requisitos y resultados

| Requisito | Escenarios / criterios | Evidencia |
|---|---|---|
| F03-FR-001–002 | US1.1–1.4; SC-001 | Dominio, HTTP, RLS, smoke y Playwright. |
| F03-FR-003–006 | US2.1–2.5; SC-002/003/007 | DTO público, filtros/orden/paginación, distancia efímera y UI. |
| F03-FR-007–009 | US3.1–3.4; SC-004 | Redis real, 9 hits/3 misses, TTL/generación y smoke con Redis detenido/recuperado. |
| F03-FR-010–015 | US4.1–4.4; SC-006 | Grants/RLS/owner, contrato cerrado, pruebas adversariales y Alfa/Beta aisladas. |
| F03-FR-016 | SC-005 | k6: 45 solicitudes con Redis y 45 en fallback, p95 < 34 ms y 0 % errores en ambos escenarios finales. |
| F03-FR-017–018 | Límites F01/F02/F03 | Regresión base, F01/F02 RLS y chequeo modular; sin funciones fuera de alcance. |

Los siete F03-SC-001–007 tienen verificación automatizada registrada. La aceptación humana sigue pendiente y no se infiere de estos resultados.

## Rúbrica docente (16 criterios)

| Criterio | Aporte verificable de F03 | Estado global |
|---:|---|---|
| 1 | HU01–HU02 y RF01–RF04 trazados. | Evidencia F03; evaluación global pendiente. |
| 2 | Modelo de referencia, oferta y perfil público. | Evidencia F03. |
| 3 | Clean Architecture y monolito modular comprobados. | Evidencia F03. |
| 4 | Spec, plan, tasks, contrato y trazabilidad SDD. | Evidencia F03. |
| 5 | 25 pruebas F03 más integraciones reales. | Evidencia F03. |
| 6 | 2 escenarios Playwright en Linux oficial. | Evidencia F03. |
| 7 | Pantalla React `/search` en español. | Evidencia F03; rediseño profesional fuera de alcance. |
| 8 | Sin despliegue ni recurso AWS. | Pendiente transversal. |
| 9 | Migraciones, índices y proyección PostgreSQL. | Evidencia F03. |
| 10 | F03 no configura dominio, DNS ni CDN. | Pendiente transversal; no existe evidencia F03 de despliegue, HTTPS, CloudFront u OAC. |
| 11 | Cache-Aside real, TTL, hit/miss y fallback. | Evidencia F03. |
| 12 | F03 no añade ni ejecuta un pipeline CI/CD. | Pendiente transversal; las verificaciones registradas fueron locales. |
| 13 | k6 con Redis y fallback; p95/error documentados. | Evidencia F03. |
| 14 | Código, migraciones y fixtures ficticios. | Evidencia F03. |
| 15 | Evidencia y quickstart actualizados. | Evidencia F03. |
| 16 | Smoke/demo local reproducible. | Evidencia F03; revisión docente pendiente. |

No se asignan puntajes ni se inventan resultados transversales.
