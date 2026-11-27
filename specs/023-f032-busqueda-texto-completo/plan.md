# Implementation Plan: F03.2 — Búsqueda con texto completo

**Branch**: `feat/f032-busqueda-texto-completo` | **Spec**: `spec.md` (aprobada 2026-11-27, D-01 a D-05 en A + FR-013)
**Status**: **Aprobado por Andre el 2026-11-27** (commit `6d90f9d`). SQL aprobado con dos correcciones (`concat_ws` y mayúsculas con tilde) y una prueba más (palabras cortas); ver `approval.md`.

## Resumen
La pantalla y la API siguen igual por fuera. Cambia cómo se compara el texto:
1. El **backend** limpia lo escrito (sin tildes, minúsculas, «500mg» → «500 mg», «x10» → «x 10»), lo divide en palabras, quita las de relleno, pasa las palabras a singular y separa **palabras** de **números y unidades**.
2. Una **función SQL nueva** (`f03.search_public_offers_terms`) limpia los datos con la misma regla, exige que al menos una palabra esté en el nombre o el principio activo y cuenta cuántas palabras coinciden en total.
3. El **caso de uso** decide: si hay exactos, solo esos (D-02 A); si no, todos con `coincidencia: APROXIMADA`; sin resultados, `NINGUNA` o `FALTA_NOMBRE` (FR-013).
4. La **pantalla** muestra el aviso «No encontramos esa presentación exacta; estas son otras disponibles» o la ayuda «Escribe también el nombre del medicamento, por ejemplo: paracetamol 500 mg».

## Contexto técnico
- Node + Express + TypeScript (backend); React + Vite + JSX (frontend); PostgreSQL 18 con RLS; Redis cache-aside.
- Sin librerías, extensiones ni servicios nuevos. US$0.
- Pruebas: Vitest (backend y frontend), base TEST efímera marcada en el clúster de pruebas 55431, E2E en la copia 3001/5174.

## Revisión constitucional
| Principio | Cumplimiento |
|---|---|
| Búsqueda por nombre comercial o principio activo | Toda fila exige una palabra en el nombre o el principio activo; concentración y presentación solo afinan. |
| VIII · proyecciones públicas, sin desactivar RLS | La función nueva es `SECURITY DEFINER` del mismo dueño sin BYPASSRLS (`f03_projection_owner`), `search_path` fijo, mismas condiciones de publicación y mismas columnas públicas. |
| IX · Redis cache-aside con respaldo | Igual flujo; clave `v2` y validador con `coincidencia`. Entradas `v1` quedan sin leer y caducan por TTL. |
| Clean Architecture | Reglas de texto en `domain/search-terms.ts`; SQL en infraestructura; decisión de coincidencia en el caso de uso. |
| US$0 / sin datos privados | Sin servicios nuevos. La clave de caché no lleva datos personales. |
| SQL aprobado intacto | Migraciones **nuevas** `f03/003` y `f07/010`; ninguna aprobada se edita. `f03.search_public_offers` sigue igual (la usa F07 para `/geo`). |

## Diseño

### Base de datos (D-01 A) — SQL en `sql/` para tu revisión
- `f03/003_search_terms.sql`: `f03.normalize_search_text(text)` y `f03.search_public_offers_terms(words[], tokens[], min, max, limit)` con coordenadas NULL.
- `f07/010_search_terms_location.sql`: reemplaza solo la función nueva para dar coordenadas verificadas (mismo patrón que F07 003). Su SHA-256 se agrega a `F07_APPROVED`.
- Al aprobar: se copian **literalmente**; en `evidence.md` queda el SHA-256 de la propuesta y del archivo copiado (deben ser iguales). Si la primera prueba en la base efímera muestra un error de sintaxis, **me detengo y te presento la corrección** antes de seguir.
- Sin índices (D-05 A). Si la medición supera 100 ms p95, te presento un índice como enmienda.

### Backend
- `domain/search-terms.ts` (nuevo): `normalizeSearchText`, `searchTerms(term)` → `{ words, tokens, nameless }`.
  - Relleno: de, del, la, el, los, las, x, en, con, para, por, y, a.
  - Unidades (token entero): mg, g, mcg, ug, ml, l, ui, kg, %.
  - Singular: «-es» → quita «es» (≥ 5 letras), «-s» → quita «s» (≥ 4 letras). Siempre queda un prefijo, así que solo amplía.
  - `nameless` = no hay palabras, o todas son de presentación (tableta, capsula, comprimido, jarabe, suspension, solucion, gota, ampolla, inyectable, crema, gel, unguento, pomada, ovulo, supositorio, sobre, polvo, frasco, spray, inhalador, parche, blister, caja, unidad, recubierto, efervescente).
  - Las palabras de una sola letra que no son unidad se descartan (la función SQL también ignora las de menos de 2).
  - Máximo 8 palabras y 8 tokens (el resto se ignora); cada uno ≤ 40 caracteres.
- `ports.ts`: método nuevo `searchTerms(terms, minimumPrice, maximumPrice, limit)` → ofertas con `coincidencias`. `search()` antiguo se conserva para `/geo`.
- `public-offer-repository.ts`: llama a la función nueva; misma regla `exposeVerifiedLocation`.
- `search-public-offers.ts`: calcula `coincidencia`; filtra a exactos si existen; ordena por coincidencias y luego por el orden elegido; clave `farmafind:f03:v2:…`; `validCached` exige `coincidencia` válida.
- `suggest-public.ts`: usa `searchTerms` (las sugerencias salen de la misma búsqueda).
- Asistente F06.1: sin cambios de código; usa el caso de uso. Se corre su regresión.

### Contrato (D-03 A)
- `contracts/public-search.openapi.yaml` **0.3.0**: `SearchResponse.coincidencia` obligatorio, enum `EXACTA | APROXIMADA | NINGUNA | FALTA_NOMBRE`. Nada más cambia.
- `public-contract.test.ts` y `check-openapi-routes.mjs` pasan a apuntar a la spec 023.

### Frontend
- `PublicSearch.jsx`: aviso (`role="status"`) encima de la lista y del mapa si `APROXIMADA`; en el vacío, ayuda si `FALTA_NOMBRE`; si falta el campo (respuesta vieja), se comporta como hoy.
- Sin cambios en `SuggestBox`, mapa ni tarjetas.

### Medición (D-04 A, FR-011)
- Script en `.cache/f032-perf/` (no se sube a git):
  1. Crea en el clúster de pruebas 55431 una base `farmafind_f01_test_<12 hex>` con la marca TEST, **sin puertos nuevos**, y quita `CONNECT` a `PUBLIC` (solo entra el migrador de pruebas).
  2. Restaura la copia `…antes-f031_20261126.dump` pasándola por la entrada estándar del contenedor (`docker exec -i … pg_restore`), **sin copiar el archivo** fuera de `.cache`.
  3. Aplica `f03/003` y `f07/010` con los migradores protegidos. Mide 50 veces cada búsqueda (la función actual y la nueva) con nombres genéricos (paracetamol, amoxicilina, ibuprofeno y sus variantes con concentración y presentación) y anota p50/p95 y el número de filas. Sin nombres de productos de HUAMANFAR en la evidencia.
  4. Borra la base con comprobaciones (marca TEST, no es la DEMO ni `farmafind_f01_test`, sin conexiones) y confirma que ya no existe.
- La DEMO no se lee ni se enciende. Hoy su contenedor está apagado; para medir solo hace falta encender el contenedor del clúster de pruebas, que también aloja la base de la DEMO. **No se toca esa base.** Si prefieres no encender el contenedor mientras la DEMO está apagada, te lo pregunto en el momento (T011).

### Copia temporal 3001/5174 (FR-012)
- Con los guiones de `.cache/f071-copy/`: base efímera, sin el Redis compartido, con datos ficticios en 2 farmacias:
  - paracetamol 500 mg tabletas x 10, 500 mg tabletas x 100, 1 g tabletas x 10 y 120 mg/5 ml jarabe;
  - amoxicilina 500 mg cápsulas x 100 y 250 mg/5 ml suspensión;
  - ibuprofeno 400 mg tabletas x 10 y 600 mg tabletas x 10;
  - ácido acetilsalicílico 100 mg tabletas (para probar tildes).
- Al terminar: apagar y borrar solo su base y sus dos usuarios técnicos.

## Riesgos
- **Paridad TS/SQL** de la limpieza: prueba que compara ambas con la misma lista de textos.
- **Ranking**: una palabra corta (dos letras) puede coincidir dentro de otra; solo afecta el orden, no lo que se publica.
- **Sugerencias**: el texto de las sugerencias sale de los mismos campos, así que siempre es exacto; prueba automática contra la base real.
- **Despliegue en la DEMO**: no en esta rama. Tras integrar, la DEMO necesitará `f03/003` y `f07/010`: te pediré autorización con copia de seguridad.

## Estructura de archivos
- `specs/023-f032-busqueda-texto-completo/`: `spec.md`, `plan.md`, `research.md`, `data-model.md`, `quickstart.md`, `tasks.md`, `approval.md`, `contracts/`, `sql/`, luego `evidence.md` y `acceptance.md`.
- `backend/migrations/f03/003_search_terms.sql`, `backend/migrations/f07/010_search_terms_location.sql` (solo tras aprobar).
- `backend/src/modules/busqueda/{domain/search-terms.ts, application/*, infrastructure/*}`.
- `backend/tests/search/f032-*.test.ts`; `frontend/tests/f032/`.
