# FarmaFind — Entrega Sprint 2 (IS-488 Arquitectura de Software)

Fecha: 2026-11-28 · Integrado en `main` (PR #21, `229d2c3`).

## Resumen de resultados

| Evidencia | Resultado real |
|---|---|
| Pruebas sin base de datos (CI) | 150 archivos, 870 aprobadas y 1 omitida |
| Cobertura de líneas | 57,78 % |
| Swagger UI | Con Docker Desktop encendido: `npm run docs:swagger`, abrir `http://127.0.0.1:8088/`; al terminar, `npm run docs:swagger:stop` |
| Postman / newman | 85 peticiones, 48 de 48 aserciones |
| k6 con Redis | Meta (p95 ≤ 2 s) cumplida hasta **250** usuarios virtuales; no desde 500 |
| k6 sin Redis | Meta cumplida solo con **50** usuarios virtuales |
| k6 hasta 2000 usuarios | Se llegó a 2000 sin errores HTTP, pero con latencias de 22–25 s en p95 |
| Límite de abuso | 429 con `Retry-After` a partir de la petición 61 del minuto |
| Pendiente | AC03 y la parte de dos instancias de AC02 |
Todo lo que aparece aquí se ejecutó de verdad. Lo que falta se dice claramente en la sección 9.

## Índice
1. Estilo arquitectónico
2. Patrón arquitectónico: Clean Architecture
3. Especificaciones SDD
4. Endpoints REST y OpenAPI/Swagger
5. Base de datos y caché
6. Principios SOLID y patrones de diseño
7. Pruebas automatizadas, CI y cobertura
8. Pruebas de atributos de calidad (Postman y k6)
9. Matriz de escenarios AC01–AC09 del Sprint 1
10. Cómo reproducir cada evidencia

---

## 1. Estilo arquitectónico

**Monolito modular más un servicio independiente de Notificaciones.**

- La API (`backend/`) es un solo proceso Node + Express + TypeScript dividido en **8 módulos** con fronteras estrictas: `usuarios`, `farmacias`, `medicamentos`, `inventario`, `busqueda`, `reservas`, `asistente-ia` y `notificaciones` (`backend/src/modules/`).
- **Notificaciones F05** (`notifications/`) es un servicio aparte. Recibe eventos firmados por HTTP (`notifications/src/events/signature.ts`, `router.ts`), así que puede caerse sin tumbar la API (escenario AC08).
- El frontend es React + Vite (`frontend/`). PostgreSQL 18 con RLS guarda los datos y Redis hace de caché.
- **Por qué este estilo:** un equipo pequeño y costo US$ 0. Con un monolito modular hay un solo despliegue y una sola base, y aun así los módulos quedan listos para separarse si algún día hace falta. Notificaciones se separó desde el inicio porque depende de terceros (correo) y no debe bloquear las reservas.
- Fuentes: `.specify/memory/constitution.md` (v2.0.0), `docs/adr/` (4 ADR) y `backend/src/modules/README.md` (reglas de capas).

```
 Navegador (React)
     │  HTTPS /api/v1
     ▼
 API Express (monolito modular) ──eventos firmados──▶ Servicio Notificaciones F05
  ├─ usuarios / farmacias / medicamentos / inventario
  ├─ busqueda ──cache-aside──▶ Redis (si falla → PostgreSQL)
  ├─ reservas ──outbox──▶ (publicador) ──▶ Notificaciones
  └─ asistente-ia (proveedor simulado/demo, sin costo)
     │
     ▼
 PostgreSQL 18 (RLS + FORCE RLS por farmacia)
```

## 2. Patrón arquitectónico: Clean Architecture

Cada módulo tiene las mismas capas. Las dependencias siempre apuntan hacia adentro.

| Capa | Qué contiene | Ejemplo real (módulo `busqueda`) |
|---|---|---|
| `domain` | Reglas puras, sin Express ni SQL | `domain/public-query.ts` (valida y normaliza la consulta), `domain/public-offer.ts` (orden de ofertas) |
| `application` | Casos de uso y **puertos** (interfaces) | `application/search-public-offers.ts` (caso de uso), `application/ports.ts` (`PublicOfferRepository`, `SearchCache`, `SearchMetrics`) |
| `infrastructure` | Adaptadores: PostgreSQL, Redis, proveedores | `infrastructure/public-offer-repository.ts`, `infrastructure/redis-search-cache.ts` |
| `presentation` | Rutas HTTP | `presentation/public-search-router.ts` |
| `contracts` | Lo único que otros módulos pueden importar | `contracts/public-search.ts` |

- La composición (quién usa qué adaptador) se hace en un solo lugar: `backend/src/identity-app.ts`.
- **Se comprueba automáticamente en cada push:**
  - `npm run check` (`scripts/f03/check-project.mjs`): TypeScript estricto y límites entre módulos. Resultado real: «343 archivos JS, TypeScript estricto y límites modulares correctos».
  - `tests/bootstrap/architecture.test.mjs` con `scripts/f00/check-architecture.mjs`.

## 3. Especificaciones SDD (Spec Kit)

- Hay 25 carpetas en `specs/`, una por incremento. Cada una tiene:
  - `spec.md`: historias, requisitos FR-xxx y criterios de aceptación.
  - `plan.md`, con `research.md`, `data-model.md` y `contracts/`.
  - `tasks.md`: tareas técnicas T001… ligadas a los requisitos.
  - `approval.md`, `evidence.md` y `acceptance.md`.
- Flujo: especificar, aclarar, planificar y dividir en tareas. Cada paso necesita la aprobación del dueño del producto, que queda registrada con su fecha. Después se implementa, se reúne evidencia y el dueño acepta.
- Ejemplos completos:
  - `specs/023-f032-busqueda-texto-completo/` (búsqueda por texto, con mediciones).
  - `specs/012-f025-incorporacion-farmacias/` (incorporación de farmacias, aceptada con observaciones).
- El seguimiento está en `docs/seguimiento/ESTADO.md`.

## 4. Endpoints REST y OpenAPI/Swagger

- **19 contratos OpenAPI 3.1** en `specs/*/contracts/*.yaml`, con **111 operaciones** en total.
- **Contratos frente a código:** `npm run verify:contracts` (y sus variantes f011, f041 y f081) comprueba que cada operación documentada existe en Express. Corre en el CI en cada push.
- **Swagger UI navegable:** `npm run docs:swagger` abre `http://127.0.0.1:8088/` con la imagen oficial `swaggerapi/swagger-ui:v5.34.1` y los contratos montados en solo lectura. El contrato se elige arriba a la derecha. Para apagarlo: `npm run docs:swagger:stop`.
  - Comprobado con un navegador automático: 19 contratos, 0 errores y 111 operaciones (`docs/sprint2/evidencias/swagger-ui.txt`).
  - Capturas: `docs/sprint2/evidencias/swagger-ui-reservas.png` y `swagger-ui-busqueda.png`.
- **Endpoints principales:**

| Área | Ejemplos |
|---|---|
| Público | `GET /api/v1/busquedas`, `GET /api/v1/busquedas/sugerencias`, `GET /api/v1/geolocalizacion/farmacias`, `POST /api/v1/geolocalizacion/consultas`, `POST /api/v1/asistente/conversaciones`, `GET /health` |
| Cuenta | `GET /api/v1/auth/csrf`, `POST /api/v1/auth/login`, `POST /api/v1/auth/logout`, `GET /api/v1/me/memberships` |
| Farmacia | `GET /api/v1/farmacias/{id}/inventario`, `POST …/importaciones/vista-previa`, `POST …/importaciones/{id}/confirmar`, `GET …/reservas` |
| Cliente | `POST /api/v1/reservas`, `POST /api/v1/reservas/{id}/cancelar` |
| Plataforma | `GET /api/v1/platform/pharmacy-applications`, `POST /api/v1/platform/location-proposals/{id}/decision` |

## 5. Base de datos y caché

### PostgreSQL
- **Aislamiento entre farmacias en la base**, no solo en la API:
  - 18 migraciones activan `FORCE ROW LEVEL SECURITY`.
  - La API se conecta con roles sin `BYPASSRLS` y fija el usuario y la sesión en cada transacción (`set_config('app.actor_user_id', …)`).
  - Así, aunque la API tuviera un error, una farmacia no puede leer el inventario de otra. Lo prueban las suites `test:f01:rls`, `test:f02:rls` y `test:f03:rls`, que corren en el CI con un PostgreSQL efímero.
- **Consistencia de stock (sin sobreventa):** la función de reserva (`backend/migrations/f04/005_stock_isolation.sql`) bloquea la fila de inventario con `SELECT … FOR UPDATE`, comprueba que `cantidad_fisica − cantidad_comprometida ≥ cantidad` y solo entonces suma lo comprometido.
  - Medido: 100 intentos simultáneos sobre 10 unidades dieron **exactamente 10 reservas** (`docs/evidencias/integration/review-2026-11/load.txt`).
- **Unit of Work:** cada caso de uso de escritura corre en una sola transacción, por ejemplo `reservas/infrastructure/reservation-unit-of-work.ts` y `farmacias/infrastructure/location-unit-of-work.ts`.
- **Transactional Outbox:** el evento (`f04.outbox_evento`) se guarda en la misma transacción que la reserva y otro proceso lo publica después (`notificaciones/application/publish-outbox.ts` y `infrastructure/outbox-repository.ts`). Si Notificaciones está caído, no se pierde nada.
- **Rendimiento de la búsqueda** (F03.2, `specs/023-f032-busqueda-texto-completo/evidence.md`):
  - Con 5180 ofertas, el peor p95 en la base fue de **19,43 ms** (meta ≤ 100 ms).
  - El primer diseño recorría todas las ofertas por culpa de RLS y se descartó tras medirlo con EXPLAIN. La versión final primero filtra el catálogo y luego cruza las ofertas.

### Redis (Cache-Aside)
- Flujo en `busqueda/application/search-public-offers.ts`:
  1. Se calcula una clave a partir de la **generación** vigente y de la consulta normalizada (SHA-256).
  2. Si Redis tiene una respuesta válida, se devuelve (acierto).
  3. Si no la tiene, se consulta PostgreSQL y se guarda con TTL de 60 s (fallo).
  4. Si Redis no responde en 150 ms o falla, se responde igual desde PostgreSQL (fallback). **Redis nunca es obligatorio.**
- **Invalidación por generación:** después de confirmar un cambio de inventario, `search-invalidator.ts` hace `INCR` de la generación. Las claves viejas dejan de usarse sin borrarlas una por una.
- **Validación de lo que viene de la caché:** una entrada con forma inesperada se descarta y se recalcula (`validCached`).
- **Métricas:** `in-memory-search-metrics.ts` cuenta aciertos, fallos, fallbacks y entradas inválidas.
- **Cómo se comporta bajo carga, con y sin Redis:** ver la sección 8.2.

## 6. Principios SOLID y patrones de diseño

| Principio | Dónde se ve |
|---|---|
| **S** — Responsabilidad única | Cada caso de uso es una clase: `reservas/application/create-reservation.ts`, `cancel-reservation.ts`, `confirm-reservation.ts`. El router solo traduce HTTP y el repositorio solo habla SQL. |
| **O** — Abierto/cerrado | Se agregan proveedores del asistente sin tocar el caso de uso: `mock-conversation-provider.ts`, `demo-conversation-provider.ts`, `gemini-conversation-provider.ts` y `fallback-conversation-provider.ts`, todos con la misma interfaz. |
| **L** — Sustitución de Liskov | Cualquier `SearchCache` (Redis real o un doble en pruebas) cumple el mismo contrato. El caso de uso funciona igual con cualquiera; lo prueba `backend/tests/search/cache-aside.test.ts`. |
| **I** — Segregación de interfaces | Puertos pequeños y separados en `busqueda/application/ports.ts`: `PublicOfferRepository`, `SearchCache`, `SearchMetrics`, `SearchInvalidator` y `SearchClock`. |
| **D** — Inversión de dependencias | Los casos de uso dependen de interfaces (puertos), y `identity-app.ts` decide qué implementación usar. Por ejemplo, `SearchPublicOffers` recibe el repositorio y la caché por constructor. |

| Patrón | Archivo de ejemplo |
|---|---|
| Puertos y adaptadores (hexagonal) | `busqueda/application/ports.ts` con `infrastructure/redis-search-cache.ts` |
| Repository | `reservas/infrastructure/reservation-repository.ts`, `busqueda/infrastructure/public-offer-repository.ts` |
| Unit of Work | `reservas/infrastructure/reservation-unit-of-work.ts` |
| Transactional Outbox | `notificaciones/application/publish-outbox.ts` |
| Cache-Aside | `busqueda/application/search-public-offers.ts` |
| Strategy | Proveedores del asistente (`asistente-ia/infrastructure/*-conversation-provider.ts`) |
| Decorator / Fallback | `fallback-conversation-provider.ts` (si falla un proveedor, usa otro) |
| Composition Root | `backend/src/identity-app.ts` |
| Null Object | `NO_SEARCH_METRICS` y `NO_SEARCH_INVALIDATOR` en `busqueda/application/ports.ts` |

## 7. Pruebas automatizadas, CI y cobertura

### Por qué Vitest y no Jest
- **Vitest usa la misma forma de escribir pruebas que Jest:** `describe`, `it`, `expect`, `vi.fn()` (en lugar de `jest.fn()`), `beforeEach` y los mismos matchers. Quien sabe Jest lee estas pruebas sin aprender nada nuevo.
- Lo elegimos porque:
  1. El frontend ya usa **Vite**, y Vitest comparte su configuración y su transformador.
  2. Ejecuta **TypeScript y ESM** sin configurar Babel ni ts-jest.
  3. Una sola herramienta sirve para backend, frontend (con jsdom y Testing Library) y Notificaciones.

**Compatibilidad con Jest, sin exagerar:**

| Tema | Jest | Vitest (este proyecto) |
|---|---|---|
| `describe`, `it`, `expect`, `beforeEach`, matchers | Igual | Igual |
| Dobles | `jest.fn()`, `jest.mock()` | `vi.fn()`, `vi.mock()` |
| `describe`/`expect` disponibles sin importar | Sí, por defecto | No: aquí se importan de `vitest` |
| Configuración | `jest.config` | `vitest.config.mjs` |
| Cobertura | `--coverage` | `--coverage` con `@vitest/coverage-v8` |

La compatibilidad es de estilo y de la mayor parte de la API, **no del 100 %**: pasar estas pruebas a Jest exigiría cambiar los `import`, los `vi.` y la configuración. Si la rúbrica exige Jest de forma literal, es un punto a confirmar con el docente.

### Números reales
- 226 archivos `*.test.*` en el repositorio.
- Suites sin base de datos (las del CI): **150 archivos, 870 pruebas aprobadas** y 1 omitida.
- Suites con PostgreSQL (RLS e integración): se corren aparte. En el CI solo corren las RLS de F01, F02 y F03, con una base efímera.
- Última regresión completa local (F06.2, `specs/025-f062-asistente-mejorado/evidence.md`): 1073 aprobadas, 234 omitidas y 2 fallas de entorno (Redis de la DEMO no usado a propósito y un `frontend/.env.local` ausente).
- Esa regresión es anterior a este Sprint 2 y no se repitió completa.

### CI con GitHub Actions (`.github/workflows/ci.yml`)
- Corre en cada push y en cada PR a `main`, con permisos de solo lectura.
- Trabajo 1 (sin base de datos): `npm run check`, compilación, verificación de contratos OpenAPI, y **unitarias, API con dobles y frontend con cobertura** (`npm run test:coverage`). Sube el artefacto **`cobertura`**.
- Trabajo 2: PostgreSQL 18.6 efímero con migraciones y pruebas **RLS** de F01, F02 y F03.

### Cobertura (`@vitest/coverage-v8`)
- Comando: `npm run test:coverage` (`scripts/test-coverage/run.mjs`). Corre cada suite, guarda un informe parcial y los fusiona.
- Informe: `coverage/index.html` (HTML), `coverage/lcov.info` y `coverage/coverage-summary.json`. En GitHub se descarga desde la corrida del CI, en el artefacto «cobertura».
- **Resultado real**, igual en local y en el CI (corrida `46131172246` sobre `main`):

| Métrica | % | Cubiertas / total |
|---|---|---|
| Líneas | **57,78 %** | 3953 / 6841 |
| Sentencias | 56,28 % | 5535 / 9834 |
| Funciones | 57,19 % | 1395 / 2439 |
| Ramas | 55,20 % | 4097 / 7421 |

- **Lectura honesta:** el porcentaje mide solo las suites sin base de datos. El código SQL y los repositorios se prueban con las suites RLS e integración contra PostgreSQL real, que no entran en este número. Por eso la cobertura real del comportamiento es mayor que la que muestra el informe.

## 8. Pruebas de atributos de calidad

### 8.1 Postman / newman (funcional y seguridad)
- Colección: `tests/postman/farmafind-sprint2.postman_collection.json`, importable en Postman.
- Se ejecuta con `npm run test:postman -- .cache/<copia>/state.local.json` contra una **copia temporal** (puerto 3001, base TEST efímera con datos ficticios), nunca contra la DEMO.
- **Resultado real: 85 peticiones, 48 de 48 aserciones.** Tiempo medio 17 ms; el máximo, 421 ms, fue el login, por el hash Argon2.
- Cubre:
  - Búsqueda, sugerencias, cercanía y asistente.
  - Validación (400).
  - Sin sesión (401) y CSRF (403).
  - Login fallido con mensaje genérico.
  - Aislamiento entre farmacias (404/403).
  - Cierre de sesión.
  - **Límite de abuso: 429 con `Retry-After`.**
- Detalle en `docs/sprint2/evidencias/postman/LEEME.md`.

### 8.2 k6 — carga progresiva hasta 2000 usuarios virtuales

#### Condiciones
- Script `tests/load/sprint2-ramp.js`, lanzado con `node scripts/load/sprint2.mjs` (imagen `grafana/k6:1.8.2`).
- Petición medida: `GET /api/v1/busquedas?q=…`, con 34 términos al azar. Cada usuario virtual busca, espera la respuesta y descansa 1 s.
- Rampa 50 → 250 → 500 → 1000 → 2000: 30 s de subida y 45 s de meseta por nivel. **Cada fila mide solo la meseta.**
- Datos ficticios: 527 productos, 47 farmacias y 5313 ofertas, en una base TEST efímera.
- Equipo: un portátil Intel Core i5-10210U (8 hilos), 16 GB, Windows 10 y Docker Desktop. La API, PostgreSQL, Redis y k6 compartían ese equipo. La DEMO estaba apagada.
- API: un solo proceso con 6 conexiones a PostgreSQL, igual que la DEMO.
- El límite por IP se subió **solo en esta copia** (`backend/src/config/load-test-limit.ts`), porque k6 sale de una sola IP. El valor normal sigue en 60 por minuto y tiene su prueba.
- Meta (AC01): p95 ≤ 2 s y errores < 1 %.

#### Resultados

| Usuarios | **Con Redis**: pet./s | p95 | p99 | Errores | ¿Cumple? | **Sin Redis**: pet./s | p95 | p99 | Errores | ¿Cumple? |
|---:|---:|---:|---:|---:|:---:|---:|---:|---:|---:|:---:|
| 50 | 49,4 | 15 ms | 30 ms | 0 % | Sí | 47,6 | 93 ms | 142 ms | 0 % | Sí |
| 250 | 245,0 | 68 ms | 138 ms | 0 % | Sí | 86,7 | 2,40 s | 2,47 s | 0 % | No |
| 500 | 336,1 | 3,65 s | 6,54 s | 0 % | No | 91,3 | 4,88 s | 4,96 s | 0 % | No |
| 1000 | 287,8 | 13,09 s | 15,19 s | 0 % | No | 89,9 | 10,63 s | 10,98 s | 0 % | No |
| 2000 | 172,7 | 25,08 s | 25,54 s | 0 % | No | 88,0 | 21,94 s | 22,06 s | 0 % | No |

| Medida (K6-02), corrida completa | Con Redis | Sin Redis |
|---|---:|---:|
| Peticiones respondidas (todas 200) | 81 293 | 32 072 |
| Peticiones por segundo (promedio) | 202,9 | 79,0 |
| Mediana | 182 ms | 4,77 s |
| p95 / p99 | 21,0 s / 24,7 s | 21,7 s / 22,1 s |
| Aciertos de caché | 71 218 (87,6 % de las peticiones) | — |
| CPU de PostgreSQL, media / máxima | 164 % / 474 % | 413 % / 518 % |
| CPU de la API, media / máxima | 54 % / 83 % | 58 % / 74 % |

- CPU: 100 % equivale a un hilo de los 8.
- El contador de fallos de Redis marcó 86 807, pero incluye una lectura por petición de la clave de generación, que no existe en una copia sin cambios de inventario. Por eso se informa el porcentaje de aciertos.
- En ninguna respuesta aparecieron campos privados de stock, y la API siguió respondiendo `/health` al terminar.

#### Hasta dónde llegó y por qué
- **El equipo sostuvo los 2000 usuarios virtuales sin errores HTTP, pero no cumplió la meta de tiempo.** El límite que cumple es 250 con Redis y 50 sin Redis. Entre esos niveles y el siguiente no se midió nada, así que no se afirma dónde está el punto exacto.
- **Sin Redis** las peticiones por segundo se estancan cerca de 90 desde 250 usuarios, y la espera crece al sumar usuarios: las peticiones hacen cola. PostgreSQL fue lo que más CPU usó. La causa más probable es el costo de la consulta de búsqueda con 6 conexiones.
- **Con Redis** el máximo medido fue de 336 pet./s (con 500 usuarios) y después bajó. La mediana siguió baja mientras el p95 subió mucho, lo que coincide con respuestas rápidas desde la caché y otras esperando a PostgreSQL.
  - Hipótesis, **no comprobada**: al vencer el TTL de 60 s muchas peticiones consultan a la vez lo mismo (no se agrupan), y con carga alta Redis puede superar los 150 ms y caer a PostgreSQL. Para confirmarlo hay que exponer las métricas de fallback.
- No hubo señales de que faltara memoria (siempre quedaron al menos 2,4 GB libres) ni de que k6 fuera el freno (menos de un hilo).
- Mejoras posibles, sin aplicar ni medir: agrupar consultas iguales simultáneas, revisar el tamaño del pool, y probar con más de una instancia de la API en otro equipo.

#### Límite real: ráfaga que devuelve 429
20 usuarios sin pausa durante 20 s, con el límite normal de 60 por minuto:

| Corrida | Peticiones | 200 | 429 | Otras | 429 con `Retry-After` |
|---|---:|---:|---:|---:|:---:|
| Repetición (la válida) | 10 892 | 60 | 10 832 | 0 | Todos |
| Primera | 9 798 | 60 | 9 733 | 5 | Todos |

Las 5 «otras» de la primera corrida no llegaron a la API: fueron tiempos de espera al abrir la conexión entre el contenedor de k6 y el equipo (`dial: i/o timeout`). El p95 de la repetición fue 54 ms.

Evidencia completa: `docs/sprint2/evidencias/k6/` (ver su `LEEME.md`).

## 9. Matriz de escenarios de calidad del Sprint 1 (AC01–AC09)

Definidos en el Documento Maestro v3.0 (`docs/referencias/FarmaFind_Documento_Maestro_v3_0_Consolidado.docx`, sección «Escenarios de calidad»).

| ID | Atributo y escenario | Prueba y evidencia | Estado |
|---|---|---|---|
| AC01 | Rendimiento: búsqueda p95 ≤ 2 s y errores < 1 % bajo carga controlada | k6, sección 8.2 y `evidencias/k6/` (K6-02: con y sin caché) | **Cumplido hasta 250 usuarios con Redis**; no cumple desde 500 |
| AC02 | Disponibilidad: 2 instancias de la API, una cae y el servicio sigue en ≤ 30 s; Redis caído → PostgreSQL | Solo la parte de Redis: `backend/tests/search/cache-aside.test.ts` y rampa k6 sin Redis (32 072 respuestas 200) | **Parcial: falta la prueba con 2 instancias** |
| AC03 | Escalabilidad: comparar 1 y 2 instancias | — | **Pendiente, sin prueba** |
| AC04 | Seguridad: 100 % de intentos no autorizados rechazados | Suites `test:f01:rls`, `test:f02:rls`, `test:f03:rls` en el CI; `specs/012-f025-incorporacion-farmacias/evidence.md` (T055); Postman (401, 403, 404 y 429) | Cumplido para los casos definidos |
| AC05 | Consistencia: 10 unidades y 100 solicitudes simultáneas → exactamente 10 | `docs/evidencias/integration/review-2026-11/load.txt`: 10 de 100, p95 1021 ms, sin sobreventa | Cumplido |
| AC06 | Mantenibilidad: cambiar Redis y Notificaciones por simulaciones | `backend/tests/search/cache-aside.test.ts`, `notifications/tests/events.http.test.ts` (repositorio en memoria), `backend/tests/notifications/notifications.integration.test.ts` | Cumplido (sin documento propio) |
| AC07 | Interoperabilidad: contratos, eventos duplicados y mapeo de Excel | `verify:contracts` en el CI; `notifications/tests/events.http.test.ts` (deduplica); `backend/tests/inventory/f021-detector.test.ts` (columnas) | Cumplido |
| AC08 | Resiliencia: Notificaciones caído 5 min; el Outbox se recupera | `npm run test:f05:recovery`; `specs/006-f05-notificaciones/implementation-evidence.md` | **Cumplido en simulación** (reloj controlado y dobles, no una caída real de 5 min) |
| AC09 | Observabilidad: correlación, registros y métricas | `correlationId` en respuestas de error y eventos; métricas de caché y del asistente | Parcial (sin panel ni métricas consultables desde fuera) |

**Pendientes, dichos con honestidad:**
- AC02, la parte de dos instancias de la API.
- AC03, la comparación entre una y dos instancias.
- AC01 por encima de 250 usuarios virtuales en este equipo.
- Un panel de observabilidad para AC09.
- AC08 con una caída real de Notificaciones.

Todas las pruebas de carga se corrieron en un solo portátil. No son una medida de producción.

## 10. Cómo reproducir

| Evidencia | Comando |
|---|---|
| Arquitectura y límites | `npm run check` |
| Contratos frente a rutas | `npm run verify:contracts` |
| Swagger UI | `npm run docs:swagger` y abrir `http://127.0.0.1:8088/` |
| Cobertura | `npm run test:coverage` y abrir `coverage/index.html` |
| Postman | `npm run test:postman -- .cache/<copia>/state.local.json` (copia temporal encendida) |
| k6 | Con la copia temporal encendida: `node scripts/load/sprint2.mjs .cache/<copia> <etiqueta> ramp` (o `limit`) |
