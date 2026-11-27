# Tasks: F03.2 — Búsqueda con texto completo

**Estado**: **aprobadas por Andre el 2026-11-27** (commit `6d90f9d`). El SQL, aprobado con correcciones, se copia a `backend/migrations` solo después de que Andre vea el SQL corregido y su hash.
Formato: `T000: descripción (requisitos)`. Una casilla se marca solo con evidencia real en `evidence.md`.

## Fase 1 · Base de datos (solo tras aprobar el SQL)
- [ ] T001: Copiar **literalmente** `sql/f03_003_search_terms.sql` a `backend/migrations/f03/003_search_terms.sql` y `sql/f07_010_search_terms_location.sql` a `backend/migrations/f07/010_search_terms_location.sql`; registrar ambos SHA-256 (propuesta = copia) y agregar el de 010 a `F07_APPROVED`. Si al aplicarlo en la base efímera hay un error, detenerse y presentar la corrección. (D-01, FR-008)
- [ ] T002: Prueba de base en una base TEST efímera marcada (clúster 55431): la función nueva respeta la publicación (farmacia inactiva, sin stock, medicamento inactivo, sin principio activo → fuera), coordenadas solo verificadas y NULL sin F07; `f01_runtime` solo puede ejecutarla; `f03.search_public_offers` no cambia. (FR-008)
- [ ] T003: Prueba de base de comparación: tildes en datos («acido» → «ácido»), «500mg» = «500 mg», «500» no encuentra «1500 mg», «x10» = «x 10», orden por coincidencias antes del límite. Agregadas por Andre: un producto **sin presentación** y otro **sin concentración** conservan sus puntos (`concat_ws`); «ÁCIDO», «Ácido» y «acido» dan lo mismo en la base real; palabras de una letra o muy cortas no devuelven todo el catálogo (la función las ignora y el backend no las envía). (FR-001 a FR-004)

## Fase 2 · Backend
- [ ] T004: `domain/search-terms.ts`: limpieza, palabras/tokens, relleno, singular, unidades, `nameless`, límites 8/8/40. Pruebas unitarias, incluida la **paridad TS/SQL** sobre una lista fija (contra la base efímera). (FR-001 a FR-003, FR-013)
- [ ] T005: Puerto `searchTerms` y repositorio Pg con la función nueva (misma regla `exposeVerifiedLocation`). Pruebas. (D-01, FR-008)
- [ ] T006: Caso de uso: `coincidencia` (EXACTA/APROXIMADA/NINGUNA/FALTA_NOMBRE), solo exactos si existen (D-02 A), orden por coincidencias y luego por el orden elegido; sin palabras no consulta la base. Pruebas. (FR-004 a FR-006, FR-013)
- [ ] T007: Caché `v2` y `validCached` con `coincidencia`; prueba de que una entrada vieja se descarta sin error y de hit/miss/caída. (D-03, FR-009)
- [ ] T008: Sugerencias con `searchTerms` y **prueba automática: toda sugerencia de los datos de prueba lleva a ≥ 1 resultado**, con repositorio en memoria y contra la base efímera real. (FR-007)
- [ ] T009: Contrato 0.3.0: `public-contract.test.ts` y `check-openapi-routes.mjs` apuntan a la spec 023; regresión del asistente F06.1. (D-03, SC-003)

## Fase 3 · Frontend
- [ ] T010: `PublicSearch.jsx`: aviso de `APROXIMADA` sobre lista y mapa (`role="status"`), ayuda de `FALTA_NOMBRE` en el vacío, sin cambios si falta el campo. Pruebas en `frontend/tests/f032/`. (FR-005, FR-013)

## Fase 4 · Medición, regresión y copia
- [ ] T011: Medición con los 518 productos (D-04 A): base efímera restaurada desde la copia de seguridad en el clúster de pruebas, sin puertos nuevos ni datos fuera de `.cache`; p50/p95 antes/después en `evidence.md`; borrar la base y confirmarlo a Andre. Si supera la meta, presentar índice como enmienda (D-05). (FR-011)
- [ ] T012: Regresión: backend y frontend completos, `check`, verificadores de RLS y permisos que correspondan; registrar resultados reales (incluidos fallos de entorno ya conocidos). (SC-003)
- [ ] T013: Copia temporal 3001/5174 con los datos ficticios del plan, sin el Redis compartido; E2E de los casos de `quickstart.md` y axe. Andre la revisa. (FR-012)
- [ ] T014: Revisión de seguridad (sin datos nuevos publicados, entrada limitada, sin SQL dinámico) y converge contra la spec. (FR-008, FR-010)
- [ ] T015: Aceptación de Andre en `acceptance.md` (**solo Andre decide**). Después: apagar la copia, borrar su base y usuarios, PR y merge con las condiciones de siempre. La DEMO recibe `f03/003` y `f07/010` solo con su autorización y copia de seguridad.
