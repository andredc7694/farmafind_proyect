# Data Model — F03.2

Sin tablas, columnas ni índices nuevos. Ningún dato guardado cambia.

## Funciones nuevas (propuesta en `sql/`)
| Función | Tipo | Dueño | Ejecuta |
|---|---|---|---|
| `f03.normalize_search_text(text) → text` | `IMMUTABLE STRICT` | `f03_projection_owner` | solo su dueño |
| `f03.search_public_offers_terms(text[], text[], bigint, bigint, integer)` | `STABLE SECURITY DEFINER`, `search_path` fijo | `f03_projection_owner` (NOBYPASSRLS) | `f01_runtime` |

Columnas devueltas: las 13 de `f03.search_public_offers` + `coincidencias integer`.

## Objetos de la aplicación
- **SearchTerms**: `{ words: string[]; tokens: string[]; nameless: boolean }` (≤ 8 + 8, cada uno ≤ 40 caracteres).
- **Coincidencia**: `EXACTA | APROXIMADA | NINGUNA | FALTA_NOMBRE`.
- **PublicSearchResponse** (contrato 0.3.0): `consulta`, `ofertas`, `paginacion`, `aviso`, **`coincidencia`**.

## Caché
- Clave: `farmafind:f03:v2:g<generación>:search:<sha256>`; el contenido del hash no cambia (término, filtros, orden, página y tamaño).
- `validCached` exige además `coincidencia` dentro del enum. Una entrada sin ella se descarta (`invalid`) y se recalcula.
