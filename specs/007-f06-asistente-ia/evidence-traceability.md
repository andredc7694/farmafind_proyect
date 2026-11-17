# F06 — Trazabilidad de implementación

**Estado:** cierre técnico provisional del 2026-11-16; aceptación humana pendiente.

| Requisito | Evidencia real |
|---|---|
| F06-FR-001,002 | `mock-provider.test.ts`, `assistant-core.test.ts`, smoke integrado |
| F06-FR-003,004,005 | `public-tools.integration.test.ts`, gateway contractual F03 y check modular |
| F06-FR-006,007,008 | `assistant-core.test.ts`, smoke con 2 fuentes, ausencia sin invención y aviso |
| F06-FR-009,010 | `clinical-policy.test.ts` y rechazo previo a proveedor/herramientas |
| F06-FR-011,012,013 | mock local, puerto `AIProvider`, 100 repeticiones y timeout/salida inválida |
| F06-FR-014,015 | HTTP 429 previo al trabajo, contrato exacto y límite 4 KiB |
| F06-FR-016 | una herramienta por recorrido, máximo 20 fuentes y timeout 1 s |
| F06-FR-017 | prompt injection clínico y no clínico en `assistant-core.test.ts` |
| F06-FR-018,019 | `privacy.test.ts`, correlación opaca y métricas sin contenido |
| F06-FR-020 | puertos de solo lectura, check modular y cero rutas de mutación F06 |
| F06-FR-021 | cliente/vista React e interacción accesible en español |
| F06-FR-022 | 32 pruebas F06, integración, RLS, build y regresión consolidada |
| F06-FR-023 | fixture F03 ficticio, cero proveedor/AWS y barrido final de secretos requerido |
| F06-FR-024 | spec, plan, ADR/C4, contrato y tareas aprobados el 2026-11-16 |

| Criterio de éxito | Evidencia real |
|---|---|
| F06-SC-001 | fuentes devueltas por herramienta se copian sin campos privados |
| F06-SC-002 | batería clínica/injection rechazada antes de cualquier herramienta |
| F06-SC-003 | 100 repeticiones deterministas satisfactorias |
| F06-SC-004 | ausencia produce cero fuentes y texto explícito sin valores inventados |
| F06-SC-005 | 400/413/429 y contrato verificados; cuota precede JSON/proveedor |
| F06-SC-006 | pruebas de PII/métricas y fuente pública; barrido final de secretos requerido |
| F06-SC-007 | timeout/salida inválida y fallback PostgreSQL real satisfactorios |
| F06-SC-008 | build/check y regresión: 274 satisfactorias, 81 omitidas por prerrequisitos previos |

## Rúbrica docente — evidencias sin puntajes inventados

1. Rama/SDD: artefactos F06 en `feat/f06-asistente-ia`.
2. Requisitos: 24 FR y 8 SC trazados arriba.
3. Historias: cuatro recorridos implementados y probados.
4. Arquitectura: módulo Clean Architecture, puerto proveedor y gateway contractual F03.
5. Frontend: recorrido React mínimo probado.
6. Backend: Express/TypeScript y OpenAPI versionado.
7. Datos: sin persistencia F06; PostgreSQL oficial consultado por F03.
8. Multi-tenant: solo proyección pública; RLS real 4/4.
9. Seguridad: clínica, injection, límites, privacidad y errores.
10. Concurrencia: cuota y 100 consultas concurrentes medidas.
11. Integridad: cero escrituras F06; base persistente verificada intacta.
12. Pruebas: unitarias, API, integración, seguridad, UI y regresión.
13. Rendimiento: p95 8.668 ms y p99 11.889 ms locales, sin SLO productivo.
14. UX/accesibilidad: formulario etiquetado, estados, fuentes y aviso en español.
15. Despliegue: cero AWS/proveedor externo; compatibilidad futura documental.
16. Evidencias: comandos/resultados registrados; revisión docente/humana pendiente.
