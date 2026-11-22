# FarmaFind — cierre técnico y aceptación humana F00–F06

**Fecha:** 2026-11-17
**Rama candidata:** `integration/f00-f06`
**Alcance:** integración local y TEST/DEMO demostrada; aprobación humana formal
del 2026-11-17. No constituye aptitud productiva ni autorización de despliegue.

**Responsable y referencia:** responsable del proyecto FarmaFind, mediante su
mensaje expreso en esta conversación «FARMAFIND — APROBACIÓN HUMANA FORMAL Y
CIERRE F00–F06», secciones 1–3. La decisión se registra sobre la candidata
técnica `b160c6a381a60386311911053347b407a2833def` y sus evidencias;
el commit documental posterior solo registra la aceptación.

## Estado por incremento

| Incremento | Tareas | Verificación técnica integrada | Decisión humana |
|---|---:|---|---|
| F00 Bootstrap | 58/58 | Candidata `b160c6a`: dos preparaciones limpias A/B, 284 pruebas base por copia, build, procesos separados y Playwright Linux oficial satisfactorios. | Aprobado; T058 cerrada. |
| F01 Identidad | 77/77 | Identidad, selector A/B, administración local `TRABAJADOR`, GLO-01/BOOT-01 limitados a TEST, PostgreSQL RLS y Playwright 3/3 satisfactorios. | Aprobado en TEST/DEMO; T067 cerrada. BOOT persistente/productivo continúa prohibido. |
| F02 Catálogo e inventario | 44/44 | API, RLS, aislamiento e interfaz Playwright 3/3 satisfactorios. | Aceptación TEST/DEMO histórica ratificada. |
| F03 Búsqueda pública | 58/58 | PostgreSQL, Redis Cache-Aside/fallback, Playwright 2/2 y carga k6 satisfactorios. | Aprobado dentro del alcance demostrado. |
| F04 Reservas | 65/65 | Estados, idempotencia, concurrencia, Outbox, RLS y Playwright 1/1 satisfactorios. | Aprobado dentro del alcance demostrado. |
| F05 Notificaciones | 48/48 | Servicio independiente, firma, reintento, recuperación, deduplicación y RLS satisfactorios; sin canales externos. | Aprobado solo para entrega local. |
| F06 Asistente IA | 52/52 | `MockAIProvider`, grounding público, rechazo clínico, cuota, fallback y carga satisfactorios. | Aprobado solo con proveedor mock. |

Total verificable: **402/402 tareas**. F00 T058 y F01 T067 se cerraron
únicamente tras la aprobación humana expresa. GLO-01 y BOOT-01 se ejecutaron
solo en bases efímeras TEST; no se ejecutaron sobre la base persistente ni
producción.

## Controles ejecutados sobre la candidata

| Control | Resultado real |
|---|---|
| `npm run check` | Satisfactorio: 111 archivos JS, TypeScript estricto y límites modulares. |
| `npm run build` | Satisfactorio: backend, Notificaciones y frontend Vite; 48 módulos frontend. |
| `npm run test:base` | Repetición final en cada preparación F00: 74 archivos satisfactorios, 15 omitidos; 284 pruebas satisfactorias y 88 omitidas por requerir servicios. Las suites condicionadas se ejecutaron separadamente con PostgreSQL/Redis. |
| PostgreSQL RLS F01–F05 | Repetición final satisfactoria: F01 52, F02 14, F03 4, F04 16 y F05 4; roles sin `SUPERUSER`/`BYPASSRLS`, RLS/FORCE RLS, aislamiento A/B y autorización global acotada comprobados. |
| Redis F03 | 3 pruebas de integración satisfactorias; cache hit/miss, invalidación y fallback PostgreSQL. |
| Playwright oficial Linux | Repetición sobre la candidata actual: F00 A/B 1/1 cada una; F01 3/3; F02 3/3; F03 2/2; F04 1/1. No se atribuye soporte oficial a Windows 10. |
| Carga F03 | Repetición final: 45 solicitudes, 90/90 checks, 0 % fallos, p95 14,95 ms. |
| Concurrencia F04 | Repetición final: 100 solicitudes sobre 10 unidades, exactamente 10 reservas exitosas; p95 414,6 ms y p99 417,9 ms. |
| F05 recuperación | Caída controlada y recuperación posterior satisfactorias; Outbox y reserva permanecieron durables. |
| F06 integración/carga | Fuentes públicas fundamentadas, comparación, rechazo clínico y fallback PostgreSQL satisfactorios; 100 solicitudes, p95 2,874 ms y p99 4,028 ms, sin proveedores de red. |
| Contratos OpenAPI | 36 operaciones F00–F06 tienen ruta Express implementada; `npm run verify:contracts` satisfactorio. |
| Dependencias | Revisión final: `npm audit --omit=dev`: 0 vulnerabilidades de producción. La auditoría completa conserva 5 nodos altos en la cadena de desarrollo Vite/Vitest por `picomatch@4.0.7` (GHSA-fc5q-39xc-vjpf); el registro oficial npm continúa publicando `4.0.7` como versión actual. Se evaluó el descenso propuesto por npm a Vite 6.2.7/Vitest 3.1.4: mantuvo `picomatch@4.0.7` y elevó el informe a 7 vulnerabilidades, incluidas 2 críticas, por lo que se restauraron Vite 7.3.8/Vitest 4.1.12 y el lockfile original. No se ejecutó `npm audit fix --force`. Rige la excepción temporal [SEC-EXC-DEV-2026-001](security-exception-dev-dependencies.md), limitada al árbol de desarrollo y con revisión máxima el 2026-12-17. |

Las pruebas con PostgreSQL escribieron únicamente en bases efímeras identificadas como TEST. La comprobación final de solo lectura confirmó que `farmafind_f01_test` conserva 3 usuarios, 3 sesiones, 0 farmacias, 0 membresías y 9 migraciones; las tres bases TEST/DEMO con sufijo permanecen separadas y no se eliminaron. Los artefactos, `.cache`, `.env.local`, `dist`, `node_modules`, reportes Playwright y documentos privados permanecen ignorados por Git.

## Límites y aceptación

El recorrido acumulado queda cubierto por composición real de API/PostgreSQL en las suites de identidad, inventario, búsqueda, reservas y Outbox, más el servicio independiente F05 y F06 fundamentado en F03. No se creó una ruta privilegiada de producción para fabricar dueños o permisos globales. Los recorridos Playwright usan fixtures TEST aislados y datos ficticios.

No se ejecutaron correo, SMS, push, proveedores de IA externos ni despliegues.
GLO-01 y BOOT-01 se verificaron en TEST bajo aprobación, sin bootstrap
persistente ni privilegios heredados entre farmacias. F05 conserva entrega
local verificable; F06 declara explícitamente `MockAIProvider`. Las
aceptaciones humanas se registraron por decisión expresa del responsable,
sin inferirlas de las pruebas.

## Matriz de aceptación y evidencia

| Incremento | Requisitos y criterios | Evidencia principal | Pruebas omitidas o límites | Estado |
|---|---|---|---|---|
| F00 | 20 requisitos, 7 criterios de éxito | `docs/evidencias/f00/acceptance-review.md`, `human-review.md`; A `F00-A-2026-11-17T18-51-19.916Z`, B `F00-B-2026-11-17T18-53-12.890Z`, comparación `passed` | Ninguna comprobación técnica obligatoria pendiente; el soporte oficial no se atribuye a Windows 10 | Aprobado en alcance local; T058 cerrada |
| F01 | 20 requisitos, 7 criterios de éxito | `specs/002-f01-identidad-multitenant/implementation-evidence.md`, trazabilidad, 57 unitarias, 26 API y 52 PostgreSQL/RLS | BOOT persistente/productivo y permisos fuera del catálogo siguen fuera de alcance | Aprobado en TEST/DEMO; T067 cerrada |
| F02 | Requisitos y criterios de `spec.md` | `implementation-evidence.md`, API/RLS/Playwright | No acredita operación productiva | Aceptación TEST/DEMO histórica ratificada |
| F03 | 58 tareas y criterios de `spec.md` | PostgreSQL/RLS, Redis Cache-Aside y fallback, Playwright y k6 | La carga local no predice capacidad productiva | Aprobado en alcance demostrado |
| F04 | 65 tareas y criterios de `spec.md` | Estados/transiciones, concurrencia, idempotencia, Outbox, RLS, Playwright y carga | No incluye pagos ni entrega de notificaciones externas | Aprobado en alcance demostrado |
| F05 | 48 tareas y criterios de `spec.md` | Servicio independiente, deduplicación, reintento, recuperación, firma y RLS | Solo canal local; correo/SMS/push/proveedores externos no autorizados | Aprobado en alcance local |
| F06 | 24 requisitos, 8 criterios de éxito | 32 pruebas F06, grounding público, rechazo clínico, privacidad, cuota, fallback y carga | Solo `MockAIProvider`; ningún proveedor externo autorizado | Aprobado en alcance mock |

La repetición final ejecutó **290 pruebas satisfactorias**: F01 unit/API/RLS (57/26/52), F02 unit/RLS (15/14), F03 unit/Redis/RLS (25/3/4), F04 unit/API/RLS (17/6/16), F05 unit/API/RLS/recuperación (8/5/4/1) y F06 (32). También pasaron build, TypeScript/límites modulares, los 36 contratos OpenAPI, Playwright F00–F04, carga F03, concurrencia F04 y carga/fallback F06. Las omisiones de `test:base` corresponden a suites condicionadas que fueron ejecutadas por separado con sus servicios locales.

## Decisión formal y restricciones vigentes

La aprobación expresa del responsable el 2026-11-17 cerró F00 T058 y F01 T067,
ratificó la aceptación TEST/DEMO histórica de F02 y aprobó F03–F06 en sus
alcances demostrados. No queda una aceptación humana pendiente para F00–F06
dentro de esos alcances. Los registros individuales constan en
`docs/evidencias/f00/human-review.md` y en las evidencias de implementación
de F01, F03, F04, F05 y F06. Las secciones históricas anteriores de esos
documentos conservan el estado que tenían antes de esta decisión.

Se mantienen PostgreSQL RLS y el aislamiento multi-tenant. BOOT-01 y GLO-01
no quedan autorizados para bases persistentes ni producción. La aprobación
no incluye proveedores externos, datos personales reales, gastos, recursos
remotos, rediseño visual ni aptitud productiva. La excepción temporal
[SEC-EXC-DEV-2026-001](security-exception-dev-dependencies.md) sigue
activa: cinco nodos altos de desarrollo por `picomatch@4.0.7`, revisión a
más tardar el 2026-12-17; el árbol de producción reportó cero
vulnerabilidades en `npm audit --omit=dev`. No se atribuye puntaje docente
a los 16 criterios de la rúbrica.
