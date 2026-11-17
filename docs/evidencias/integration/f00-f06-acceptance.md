# FarmaFind — matriz técnica de integración F00–F06

**Fecha:** 2026-11-17
**Rama candidata:** `integration/f00-f06`
**Alcance:** integración local; no constituye aceptación humana, despliegue ni autorización para F07.

## Estado por incremento

| Incremento | Tareas | Verificación técnica integrada | Decisión humana pendiente |
|---|---:|---|---|
| F00 Bootstrap | 57/58 | Dos preparaciones limpias A/B, build, procesos separados y Playwright Linux oficial satisfactorios. | T058, revisión final humana. |
| F01 Identidad | 66/69 | Identidad, selector A/B, administración local `TRABAJADOR`, PostgreSQL RLS y Playwright 3/3 satisfactorios. | T050/T051 bloqueadas por GLO-01/BOOT-01; T067 revisión final. |
| F02 Catálogo e inventario | 44/44 | API, RLS, aislamiento e interfaz Playwright 3/3 satisfactorios. | Aceptación formal ya registrada en su historial. |
| F03 Búsqueda pública | 58/58 | PostgreSQL, Redis Cache-Aside/fallback, Playwright 2/2 y carga k6 satisfactorios. | Revisión humana del incremento. |
| F04 Reservas | 65/65 | Estados, idempotencia, concurrencia, Outbox, RLS y Playwright 1/1 satisfactorios. | Revisión humana del incremento. |
| F05 Notificaciones | 48/48 | Servicio independiente, firma, reintento, recuperación, deduplicación y RLS satisfactorios; sin canales externos. | Revisión humana del incremento. |
| F06 Asistente IA | 52/52 | `MockAIProvider`, grounding público, rechazo clínico, cuota, fallback y carga satisfactorios. | Revisión humana del incremento y publicación de su rama. |

Total verificable: **390/394 tareas**. Las cuatro abiertas son F00 T058 y F01 T050, T051 y T067. No se ejecutaron GLO-01 ni BOOT-01.

## Controles ejecutados sobre la candidata

| Control | Resultado real |
|---|---|
| `npm run check` | Satisfactorio: 110 archivos JS, TypeScript estricto y límites modulares. |
| `npm run build` | Satisfactorio: backend, Notificaciones y frontend Vite; 48 módulos frontend. |
| `npm run test:base` | 72 archivos satisfactorios, 14 omitidos; 276 pruebas satisfactorias y 81 omitidas por requerir servicios. |
| PostgreSQL RLS F01–F05 | Suites reales satisfactorias: F01 45, F02 14, F03 4, F04 16 y F05 4; roles sin `SUPERUSER`/`BYPASSRLS`, RLS/FORCE RLS y aislamiento A/B comprobados. |
| Redis F03 | 3 pruebas de integración satisfactorias; cache hit/miss, invalidación y fallback PostgreSQL. |
| Playwright oficial Linux | F00 A/B 1/1 cada una; F01 3/3 repetidas; F02 3/3; F03 2/2; F04 1/1. No se atribuye soporte oficial a Windows 10. |
| Carga F03 | 45 solicitudes, 90/90 checks, 0 % fallos, p95 35,41 ms. |
| Concurrencia F04 | 100 solicitudes sobre 10 unidades: exactamente 10 reservas exitosas; p95 353,6 ms y p99 356,5 ms. |
| F05 recuperación | Caída controlada y recuperación posterior satisfactorias; Outbox y reserva permanecieron durables. |
| F06 integración/carga | Fuentes públicas fundamentadas, comparación y rechazo clínico satisfactorios; 100 solicitudes, p95 17,122 ms, sin proveedores de red. |
| Contratos OpenAPI | 33 operaciones F00–F06 tienen ruta Express implementada; `npm run verify:contracts` satisfactorio. |
| Dependencias | `npm audit --audit-level=high`: 0 vulnerabilidades. |

Las pruebas con PostgreSQL escribieron únicamente en bases efímeras identificadas como TEST. La comprobación final de la base persistente se limita a lecturas de conteos y estado de la identidad indicada por el responsable. Los artefactos, `.cache`, `.env.local`, `dist`, `node_modules`, reportes Playwright y documentos privados permanecen ignorados por Git.

## Límites y aceptación

El recorrido acumulado queda cubierto por composición real de API/PostgreSQL en las suites de identidad, inventario, búsqueda, reservas y Outbox, más el servicio independiente F05 y F06 fundamentado en F03. No se creó una ruta privilegiada de producción para fabricar dueños o permisos globales. Los recorridos Playwright usan fixtures TEST aislados y datos ficticios.

No se ejecutaron correo, SMS, proveedores de IA externos, AWS, GLO-01 ni BOOT-01. F05 conserva entrega local verificable; F06 declara explícitamente `MockAIProvider`. Las aceptaciones humanas abiertas deben registrar una decisión expresa y no se deducen de esta matriz.
