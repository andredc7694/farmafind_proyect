# FarmaFind — matriz técnica de integración F00–F06

**Fecha:** 2026-11-17
**Rama candidata:** `integration/f00-f06`
**Alcance:** integración local; no constituye aceptación humana, despliegue ni autorización para F07.

## Estado por incremento

| Incremento | Tareas | Verificación técnica integrada | Decisión humana pendiente |
|---|---:|---|---|
| F00 Bootstrap | 57/58 | Dos preparaciones limpias A/B, build, procesos separados y Playwright Linux oficial satisfactorios. | T058, revisión final humana. |
| F01 Identidad | 76/77 | Identidad, selector A/B, administración local `TRABAJADOR`, GLO-01/BOOT-01 limitados a TEST, PostgreSQL RLS y Playwright 3/3 satisfactorios. | T067, revisión final humana; BOOT persistente/productivo continúa prohibido. |
| F02 Catálogo e inventario | 44/44 | API, RLS, aislamiento e interfaz Playwright 3/3 satisfactorios. | Aceptación formal ya registrada en su historial. |
| F03 Búsqueda pública | 58/58 | PostgreSQL, Redis Cache-Aside/fallback, Playwright 2/2 y carga k6 satisfactorios. | Revisión humana del incremento. |
| F04 Reservas | 65/65 | Estados, idempotencia, concurrencia, Outbox, RLS y Playwright 1/1 satisfactorios. | Revisión humana del incremento. |
| F05 Notificaciones | 48/48 | Servicio independiente, firma, reintento, recuperación, deduplicación y RLS satisfactorios; sin canales externos. | Revisión humana del incremento. |
| F06 Asistente IA | 52/52 | `MockAIProvider`, grounding público, rechazo clínico, cuota, fallback y carga satisfactorios. | Revisión humana del incremento. |

Total verificable: **400/402 tareas**. Las dos abiertas son F00 T058 y F01 T067, ambas revisiones humanas. GLO-01 y BOOT-01 se ejecutaron solo en bases efímeras TEST; no se ejecutaron sobre la base persistente ni producción.

## Controles ejecutados sobre la candidata

| Control | Resultado real |
|---|---|
| `npm run check` | Satisfactorio: 111 archivos JS, TypeScript estricto y límites modulares. |
| `npm run build` | Satisfactorio: backend, Notificaciones y frontend Vite; 48 módulos frontend. |
| `npm run test:base` | Repetición final: 74 archivos satisfactorios, 15 omitidos; 284 pruebas satisfactorias y 88 omitidas por requerir servicios. Las suites condicionadas se ejecutaron separadamente con PostgreSQL/Redis. |
| PostgreSQL RLS F01–F05 | Repetición final satisfactoria: F01 52, F02 14, F03 4, F04 16 y F05 4; roles sin `SUPERUSER`/`BYPASSRLS`, RLS/FORCE RLS, aislamiento A/B y autorización global acotada comprobados. |
| Redis F03 | 3 pruebas de integración satisfactorias; cache hit/miss, invalidación y fallback PostgreSQL. |
| Playwright oficial Linux | F00 A/B 1/1 cada una; F01 3/3 repetidas; F02 3/3; F03 2/2; F04 1/1. No se atribuye soporte oficial a Windows 10. |
| Carga F03 | 45 solicitudes, 90/90 checks, 0 % fallos, p95 35,41 ms. |
| Concurrencia F04 | 100 solicitudes sobre 10 unidades: exactamente 10 reservas exitosas; p95 353,6 ms y p99 356,5 ms. |
| F05 recuperación | Caída controlada y recuperación posterior satisfactorias; Outbox y reserva permanecieron durables. |
| F06 integración/carga | Fuentes públicas fundamentadas, comparación y rechazo clínico satisfactorios; 100 solicitudes, p95 17,122 ms, sin proveedores de red. |
| Contratos OpenAPI | 36 operaciones F00–F06 tienen ruta Express implementada; `npm run verify:contracts` satisfactorio. |
| Dependencias | `npm audit --omit=dev --audit-level=high`: 0 vulnerabilidades de producción. La auditoría completa detectó 5 altas en la cadena de desarrollo Vite/Vitest por `picomatch@4.0.7` (GHSA-fc5q-39xc-vjpf); a 2026-11-17 no existe versión corregida publicada. Se evaluó el descenso propuesto por npm a Vite 6.2.7/Vitest 3.1.4: mantuvo `picomatch@4.0.7` y elevó el informe a 7 vulnerabilidades, incluidas 2 críticas, por lo que se restauraron Vite 7.3.8/Vitest 4.1.12 y el lockfile original. No se ejecutó `npm audit fix --force`. Rige la excepción temporal [SEC-EXC-DEV-2026-001](security-exception-dev-dependencies.md), limitada al árbol de desarrollo y con revisión máxima el 2026-12-17. |

Las pruebas con PostgreSQL escribieron únicamente en bases efímeras identificadas como TEST. La comprobación final de solo lectura confirmó que `farmafind_f01_test` conserva 3 usuarios, 3 sesiones, 0 farmacias, 0 membresías y 9 migraciones; las tres bases TEST/DEMO con sufijo permanecen separadas y no se eliminaron. Los artefactos, `.cache`, `.env.local`, `dist`, `node_modules`, reportes Playwright y documentos privados permanecen ignorados por Git.

## Límites y aceptación

El recorrido acumulado queda cubierto por composición real de API/PostgreSQL en las suites de identidad, inventario, búsqueda, reservas y Outbox, más el servicio independiente F05 y F06 fundamentado en F03. No se creó una ruta privilegiada de producción para fabricar dueños o permisos globales. Los recorridos Playwright usan fixtures TEST aislados y datos ficticios.

No se ejecutaron correo, SMS, proveedores de IA externos ni AWS. GLO-01 y BOOT-01 se verificaron en TEST bajo aprobación, sin bootstrap persistente ni privilegios heredados entre farmacias. F05 conserva entrega local verificable; F06 declara explícitamente `MockAIProvider`. Las aceptaciones humanas abiertas deben registrar una decisión expresa y no se deducen de esta matriz.

## Matriz de aceptación y evidencia

| Incremento | Requisitos y criterios | Evidencia principal | Pruebas omitidas o límites | Estado |
|---|---|---|---|---|
| F00 | 20 requisitos, 7 criterios de éxito | `docs/evidencias/f00/acceptance-review.md`, reportes A/B y Playwright oficial | Ninguna comprobación técnica obligatoria pendiente; el soporte oficial no se atribuye a Windows 10 | Técnica satisfecha; T058 pendiente de decisión humana |
| F01 | 20 requisitos, 7 criterios de éxito | `implementation-evidence.md`, trazabilidad, 57 unitarias, 26 API y 52 PostgreSQL/RLS en la repetición final | BOOT persistente/productivo y permisos fuera del catálogo siguen fuera de alcance | Técnica satisfecha en TEST; T067 pendiente de decisión humana |
| F02 | Requisitos y criterios de `spec.md` | `implementation-evidence.md`, API/RLS/Playwright | No acredita operación productiva | Aceptación TEST/DEMO registrada en su historial |
| F03 | 58 tareas y criterios de `spec.md` | PostgreSQL/RLS, Redis Cache-Aside y fallback, Playwright y k6 | La carga local no predice capacidad productiva | Técnica satisfecha; aceptación humana final pendiente |
| F04 | 65 tareas y criterios de `spec.md` | Estados/transiciones, concurrencia, idempotencia, Outbox, RLS, Playwright y carga | No incluye pagos ni entrega de notificaciones externas | Técnica satisfecha; aceptación humana final pendiente |
| F05 | 48 tareas y criterios de `spec.md` | Servicio independiente, deduplicación, reintento, recuperación, firma y RLS | Solo canal local; correo/SMS/proveedores externos no autorizados | Técnica satisfecha; aceptación humana final pendiente |
| F06 | 24 requisitos, 8 criterios de éxito | 32 pruebas F06, grounding público, clínica, privacidad, cuota, fallback y carga | Solo `MockAIProvider`; ningún proveedor externo autorizado | Técnica satisfecha; aceptación humana final pendiente |

La repetición final ejecutó **290 pruebas satisfactorias**: F01 unit/API/RLS (57/26/52), F02 unit/RLS (15/14), F03 unit/Redis/RLS (25/3/4), F04 unit/API/RLS (17/6/16), F05 unit/API/RLS/recuperación (8/5/4/1) y F06 (32). También pasaron build, TypeScript/límites modulares y los 36 contratos OpenAPI. Las pruebas de navegador y carga no se repitieron porque no cambiaron sus superficies; se conservan sus ejecuciones registradas y no se inventan resultados nuevos.

## Decisiones humanas pendientes

1. F00 T058: aprobar o rechazar la revisión final usando `docs/evidencias/f00/acceptance-review.md`.
2. F01 T067: aprobar o rechazar los siete criterios, confirmando que GLO-01/BOOT-01 quedan limitados a TEST y que BOOT persistente/productivo continúa prohibido.
3. F03, F04, F05 y F06: registrar por separado la aceptación humana final de cada incremento sobre sus evidencias existentes.

F02 ya conserva aceptación humana para TEST/DEMO. Esta matriz no asigna puntaje a los 16 criterios docentes ni autoriza F07. La candidata queda funcionalmente verificada y puede versionarse bajo SEC-EXC-DEV-2026-001; F07 exige autorización específica de alcance y costos.
