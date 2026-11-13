# Tasks: F03 — Consultas públicas

**Input**: [spec.md](spec.md), [plan.md](plan.md), [research.md](research.md), [data-model.md](data-model.md), [public-search.openapi.yaml](contracts/public-search.openapi.yaml) y [quickstart.md](quickstart.md).

**Tests**: obligatorios por F03-FR-015/016, los siete criterios F03-SC y la Constitution.

**Estado actual**: 58/58 tareas completadas con comprobación real; aceptación humana final pendiente.

## Phase 1: Setup

- [X] T001 Registrar aprobación de spec/plan y límites F03 en specs/004-f03-consultas-publicas/plan.md
- [X] T002 Añadir y fijar el cliente oficial Redis compatible en backend/package.json y package-lock.json, tras comprobar Node.js 24.17.0, licencia y auditoría
- [X] T003 [P] Añadir variables públicas/privadas sin secretos reales en backend/.env.example y frontend/.env.example
- [X] T004 [P] Reutilizar PostgreSQL local aprobado en compose.f01-postgres.yaml y definir Redis aislado, puerto 127.0.0.1, imagen exacta y healthcheck en compose.f03-search.yaml
- [X] T005 Añadir scripts F03 de build, unitarias, integración, RLS, demo y carga en package.json
- [X] T006 [P] Crear estructura del módulo en backend/src/modules/busqueda/README.md y rutas de pruebas/scripts previstas
- [X] T007 Verificar exclusiones de .env.local, .cache, volúmenes, resultados de carga, node_modules y dist en .gitignore y .dockerignore

## Phase 2: Foundational

**Checkpoint**: ninguna historia comienza hasta completar configuración, migraciones y fronteras de seguridad.

- [X] T008 [P] Escribir pruebas de configuración Redis, TTL 60 s configurable, timeout y secretos ausentes en backend/tests/search/search-config.test.ts
- [X] T009 [P] Escribir pruebas de migración aditiva, roles, owners, grants, RLS y datos incompletos en backend/tests/search/migrations.rls.test.ts
- [X] T010 [P] Escribir pruebas del contrato OpenAPI y ausencia de campos prohibidos en backend/tests/search/public-contract.test.ts
- [X] T011 Crear migraciones aditivas de esquema, principio activo y perfil público en backend/migrations/f03/001_public_search.sql
- [X] T012 Crear rol no-login, políticas RLS y función fija con search_path cerrado en backend/migrations/f03/002_public_projection.sql
- [X] T013 Implementar ejecutor ordenado e idempotente de migraciones F03 en backend/src/modules/busqueda/infrastructure/migrate.ts
- [X] T014 Implementar carga y validación de SEARCH_REDIS_URL, TTL, timeout y límites en backend/src/config/search.ts
- [X] T015 [P] Definir DTO/puertos de repositorio, caché, métricas, reloj e invalidación en backend/src/modules/busqueda/application/ports.ts
- [X] T016 [P] Definir errores y campos públicos permitidos en backend/src/modules/busqueda/contracts/public-search.ts
- [X] T017 Ejecutar build y pruebas foundational; corregir hasta pasar sin relajar RLS ni contrato

## Phase 3: User Story 1 — Encontrar medicamentos sin sesión (P1)

**Goal**: buscar por nombre comercial o principio activo y mostrar farmacias activas con disponibilidad.

**Independent Test**: dataset Alfa/Beta; búsqueda sin cookie encuentra ambas formas y una consulta sin coincidencia devuelve lista vacía.

- [X] T018 [P] [US1] Escribir pruebas de normalización 2–120, acentos, espacios y presentaciones distintas en backend/tests/search/search-domain.test.ts
- [X] T019 [P] [US1] Escribir pruebas HTTP públicas, estado vacío, paginación 1–50 y farmacias inactivas en backend/tests/search/search.http.test.ts
- [X] T020 [P] [US1] Escribir pruebas React de formulario, carga, resultado y vacío en frontend/tests/search/public-search.test.jsx
- [X] T021 [US1] Implementar consulta, filtros básicos, paginación y orden estable en backend/src/modules/busqueda/domain/public-query.ts
- [X] T022 [US1] Implementar repositorio PostgreSQL mediante función de proyección en backend/src/modules/busqueda/infrastructure/public-offer-repository.ts
- [X] T023 [US1] Implementar caso de uso público sin sesión en backend/src/modules/busqueda/application/search-public-offers.ts
- [X] T024 [US1] Implementar validación y GET /api/v1/busquedas conforme al contrato en backend/src/modules/busqueda/presentation/public-search-router.ts
- [X] T025 [US1] Integrar el router público sin alterar autenticación F01/F02 en backend/src/identity-app.ts
- [X] T026 [US1] Implementar cliente y vista React en frontend/src/search/search-client.js y frontend/src/search/PublicSearch.jsx
- [X] T027 [US1] Integrar ruta /search y navegación mínima en frontend/src/main.jsx
- [X] T028 [US1] Ejecutar pruebas US1 y comprobar F03-FR-001/002/006/012/014/017 y F03-SC-001

## Phase 4: User Story 2 — Comparar ofertas referenciales (P1)

**Goal**: comparar precio, disponibilidad, dirección, revisión y cercanía opcional sin inventar datos.

**Independent Test**: dos ofertas ficticias se ordenan por precio/disponibilidad/cercanía y conservan dirección si falta ubicación.

- [X] T029 [P] [US2] Escribir pruebas de precio, disponibilidad booleana, última revisión y ausencia de cantidades internas en backend/tests/search/public-offer.test.ts
- [X] T030 [P] [US2] Escribir pruebas de distancia efímera, coordenadas válidas y orden estable en backend/tests/search/distance.test.ts
- [X] T031 [P] [US2] Escribir pruebas UI de filtros, comparación, aviso referencial y dirección fallback en frontend/tests/search/comparison.test.jsx
- [X] T032 [US2] Implementar oferta pública y cálculo de distancia sin persistir coordenadas en backend/src/modules/busqueda/domain/public-offer.ts
- [X] T033 [US2] Ampliar caso de uso con precio, disponibilidad, cercanía y máximo de 200 candidatos en backend/src/modules/busqueda/application/search-public-offers.ts
- [X] T034 [US2] Implementar GET /api/v1/farmacias/{id} público y respuesta minimizada en backend/src/modules/busqueda/presentation/public-pharmacy-router.ts
- [X] T035 [US2] Integrar filtros y tarjetas comparables accesibles en frontend/src/search/PublicSearch.jsx y frontend/src/style.css
- [X] T036 [US2] Ejecutar pruebas US2 y comprobar F03-FR-003/004/005/013 y F03-SC-002/003/007

## Phase 5: User Story 3 — Continuar si falla la caché (P1)

**Goal**: Cache-Aside real con TTL, invalidación post-commit, métricas y fallback PostgreSQL.

**Independent Test**: hit/miss equivalentes; Redis detenido mantiene búsqueda; un cambio F02 confirmado cambia generación.

- [X] T037 [P] [US3] Escribir pruebas unitarias de clave SHA-256, generación, payload inválido, TTL y fallback en backend/tests/search/cache-aside.test.ts
- [X] T038 [P] [US3] Escribir integración Redis real para hit/miss/expire/corrupción/timeout/recuperación en backend/tests/search/redis.integration.test.ts
- [X] T039 [P] [US3] Escribir prueba de invalidación tras cambio manual/importación y no antes del commit en backend/tests/search/invalidation.integration.test.ts
- [X] T040 [US3] Implementar adaptador node-redis con timeout/reconexión acotados en backend/src/modules/busqueda/infrastructure/redis-search-cache.ts
- [X] T041 [US3] Integrar Cache-Aside, métricas y composición de adaptadores en backend/src/modules/busqueda/application/search-public-offers.ts y backend/src/identity-app.ts
- [X] T042 [US3] Implementar generación de invalidación post-commit en backend/src/modules/busqueda/infrastructure/search-invalidator.ts
- [X] T043 [US3] Conectar invalidación a cambios F02 confirmados en backend/src/modules/inventario/application/manual-review.ts y backend/src/modules/inventario/application/confirm-import.ts
- [X] T044 [US3] Ejecutar pruebas con Redis sano, detenido y recuperado; comprobar F03-FR-007/008/009/016 y F03-SC-004/005

## Phase 6: User Story 4 — No revelar datos privados (P1)

**Goal**: demostrar que el acceso público solo obtiene la proyección permitida.

**Independent Test**: runtime, proyección y API sobre Alfa/Beta no exponen ninguna columna privada ni eluden RLS.

- [X] T045 [P] [US4] Escribir pruebas SQL directas de grants, RLS, owner, ausencia de tenant y A/B en backend/tests/search/public-projection.rls.test.ts
- [X] T046 [P] [US4] Escribir pruebas adversariales HTTP de parámetros, errores, rate limit y campos prohibidos en backend/tests/search/public-security.http.test.ts
- [X] T047 [US4] Implementar limitador público por proceso detrás de puerto sin persistir IP en backend/src/modules/busqueda/presentation/public-rate-limit.ts
- [X] T048 [US4] Endurecer respuestas, correlación y logs minimizados en backend/src/modules/busqueda/presentation/public-search-router.ts
- [X] T049 [US4] Ejecutar pruebas US4 y comprobar F03-FR-010/011/015/018 y F03-SC-006 con rechazo del 100 % definido

## Phase 7: Validation, evidence and polish

- [X] T050 Crear fixture F03 aislado con Alfa/Beta, datos ficticios y roles mínimos en scripts/f03/fixture.mjs
- [X] T051 Crear arranque y smoke público reproducible en scripts/f03/start.mjs y scripts/f03/smoke.mjs
- [X] T052 [P] Crear Playwright F03 para búsqueda, comparación y fallback visual en frontend/tests/search/f03.spec.js
- [X] T053 [P] Crear escenario k6 caché fría/caliente/Redis caído en tests/load/f03-search.js
- [X] T054 Ejecutar check, build, unitarias, HTTP, PostgreSQL/RLS, Redis, regresión F00–F02, Playwright Linux y npm audit; corregir errores
- [X] T055 Ejecutar k6 con dataset/carga documentados y registrar p95/p99, throughput, errores, hit/miss, fallback y límites reales
- [X] T056 Verificar secretos/artefactos ignorados, git diff --check y ausencia de datos privados en cambios preparados
- [X] T057 Registrar comandos, versiones, resultados y trazabilidad de 18 FR/7 SC/16 criterios en specs/004-f03-consultas-publicas/implementation-evidence.md y evidence-traceability.md
- [X] T058 Reconciliar estados local/overall/acceptance y pendientes reales en specs/004-f03-consultas-publicas/quickstart.md

## Dependencies & execution order

- Setup T001–T007 → Foundational T008–T017 → historias.
- US1 es el MVP y habilita la respuesta base.
- US2 depende de US1; US3 depende de US1 y del puerto T015; US4 depende de T012/T022/T024 y puede avanzar en paralelo con US2/US3 después de US1.
- Validación T050–T058 depende de las cuatro historias.
- T043 requiere que T042 y los casos F02 existentes estén verificados; un fallo no autoriza invalidar antes del commit.
- T054 bloquea T055–T058 si fallan controles obligatorios.

## Parallel opportunities

- T003/T004/T006; T008/T009/T010; T015/T016.
- Pruebas marcadas [P] dentro de cada historia antes de sus implementaciones.
- US2, US3 y parte de US4 pueden prepararse tras US1, respetando archivos compartidos.
- T052/T053 pueden escribirse en paralelo, pero su ejecución espera T050–T051.

## Implementation strategy

1. Completar Setup y Foundational con migración segura y pruebas fallando primero.
2. Entregar US1 como búsqueda pública mínima y verificarla.
3. Añadir comparación y cercanía US2.
4. Añadir Redis real/fallback/invalidation US3.
5. Cerrar seguridad RLS/proyección US4.
6. Ejecutar suite completa, carga y evidencias. No declarar aceptación si falta cualquier control obligatorio.

## Traceability summary

- F03-FR-001–002: T018–T028.
- F03-FR-003–006: T021, T029–T036.
- F03-FR-007–009: T037–T044.
- F03-FR-010–015: T009–T012, T045–T049.
- F03-FR-016: T053–T055/T057.
- F03-FR-017–018: T025/T049/T054.
- F03-SC-001–007: T028, T036, T044, T049 y T054–T058.

No hay tareas de reservas, IA, AWS, privilegios globales o BOOT-01.
