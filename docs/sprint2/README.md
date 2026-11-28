# FarmaFind — Entrega Sprint 2 (IS-488 Arquitectura de Software)

Fecha: 2026-11-27 · Rama `feat/sprint2-validacion` · Base: `main` `b0557d5`.
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
  - `npm run check` (`scripts/f03/check-project.mjs`): TypeScript estricto y límites entre módulos. Resultado real: «339 archivos JS, TypeScript estricto y límites modulares correctos».
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
  4. Es más rápido.

### Números reales
- 225 archivos de prueba en el repositorio.
- Suites sin base de datos (las del CI): **149 archivos, 867 pruebas aprobadas** y 1 omitida.
- Suites con PostgreSQL (RLS e integración): se corren aparte, y en el CI con una base efímera.
- Última regresión completa local: 1073 pruebas aprobadas.

### CI con GitHub Actions (`.github/workflows/ci.yml`)
- Corre en cada push y en cada PR a `main`, con permisos de solo lectura.
- Trabajo 1 (sin base de datos): `npm run check`, compilación, verificación de contratos OpenAPI, y **unitarias, API con dobles y frontend con cobertura** (`npm run test:coverage`). Sube el artefacto **`cobertura`**.
- Trabajo 2: PostgreSQL 18.6 efímero con migraciones y pruebas **RLS** de F01, F02 y F03.

### Cobertura (`@vitest/coverage-v8`)
- Comando: `npm run test:coverage` (`scripts/test-coverage/run.mjs`). Corre cada suite, guarda un informe parcial y los fusiona.
- Informe: `coverage/index.html` (HTML), `coverage/lcov.info` y `coverage/coverage-summary.json`. En GitHub se descarga desde la corrida del CI, en el artefacto «cobertura».
- **Resultado real**, igual en local y en el CI (corrida `46106323980`):

| Métrica | % | Cubiertas / total |
|---|---|---|
| Líneas | **57,73 %** | 3945 / 6833 |
| Sentencias | 56,24 % | 5526 / 9825 |
| Funciones | 57,16 % | 1393 / 2437 |
| Ramas | 55,15 % | 4089 / 7413 |

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
*(Pendiente en este borrador: se completará con los resultados reales de la corrida.)*

## 9. Matriz de escenarios de calidad del Sprint 1 (AC01–AC09)

Definidos en el Documento Maestro v3.0 (`docs/referencias/FarmaFind_Documento_Maestro_v3_0_Consolidado.docx`, sección «Escenarios de calidad»).

| ID | Atributo y escenario | Prueba y evidencia | Estado |
|---|---|---|---|
| AC01 | Rendimiento: búsqueda p95 ≤ 2 s y errores < 1 % | k6 con 3 usuarios virtuales: p95 68 ms y 0 % de fallos (`docs/evidencias/integration/review-2026-11/load.txt`); rampa hasta 2000 en la sección 8.2 | Ver 8.2 |
| AC02 | Disponibilidad: 2 instancias de la API, una cae y el servicio sigue en ≤ 30 s; Redis caído → PostgreSQL | Probada solo la parte de Redis: la búsqueda sigue sin Redis (pruebas de integración F03 con y sin Redis, y k6 sin Redis en 8.2) | **Parcial: falta la prueba con 2 instancias** |
| AC03 | Escalabilidad: comparar 1 y 2 instancias | — | **Sin prueba** |
| AC04 | Seguridad: 100 % de intentos no autorizados rechazados | Suites RLS F01–F03 en el CI; 20 casos negativos entre farmacias (F02.5 T055); Postman (401, 403, 404 y 429) | Cumplido |
| AC05 | Consistencia: 10 unidades y 100 solicitudes simultáneas → exactamente 10 | `load.txt`: 10 de 100, p95 1021 ms, sin sobreventa | Cumplido |
| AC06 | Mantenibilidad: cambiar Redis y Notificaciones por simulaciones | Pruebas con dobles de `SearchCache`, del proveedor del asistente y de Notificaciones (suites unitarias y de API) | Cumplido (sin documento propio) |
| AC07 | Interoperabilidad: contratos, eventos duplicados y mapeo de Excel | `verify:contracts` en el CI; deduplicación de eventos en F05; importación con mapeo de columnas | Cumplido |
| AC08 | Resiliencia: Notificaciones caído 5 min; el Outbox se recupera | `npm run test:f05:recovery` | Cumplido |
| AC09 | Observabilidad: correlación, registros y métricas | `correlationId` en errores, métricas de caché y del asistente | Parcial (sin panel) |

**Pendientes, dichos con honestidad:**
- AC02, la parte de dos instancias de la API.
- AC03, la comparación entre una y dos instancias.
- Un panel de observabilidad para AC09.

Todas las pruebas de carga se corrieron en un solo portátil. No son una medida de producción.

## 10. Cómo reproducir

| Evidencia | Comando |
|---|---|
| Arquitectura y límites | `npm run check` |
| Contratos frente a rutas | `npm run verify:contracts` |
| Swagger UI | `npm run docs:swagger` y abrir `http://127.0.0.1:8088/` |
| Cobertura | `npm run test:coverage` y abrir `coverage/index.html` |
| Postman | `npm run test:postman -- .cache/<copia>/state.local.json` (copia temporal encendida) |
| k6 | Ver la sección 8.2 |
