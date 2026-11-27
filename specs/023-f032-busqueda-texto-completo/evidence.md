# Evidencia F03.2 — Búsqueda con texto completo

## T001 · SQL copiado sin cambios · 2026-11-27
- `backend/migrations/f03/003_search_terms.sql`: SHA-256 (LF) `374AEED785DA2AFB2C73A82406857D2C5F3B28B6E730C13F782707B6058BD922`, igual a `sql/f03_003_search_terms.sql` aprobado (commit `1b2e100`).
- `backend/migrations/f07/010_search_terms_location.sql`: `C5F0D8F990767E2DC37DCB3C0A02665B946533DF449DAB48E572882256BB873B`, igual a `sql/f07_010_search_terms_location.sql`.
- Listas cerradas en `migrate.ts`: `F07_APPROVED` suma 010 con su hash; **nueva** `F03_APPROVED` (001–002 sin hash histórico, 003 con hash). Ambos migradores rechazan un archivo distinto o de más.
- `f071-migrations.test.ts` pasa a diez migraciones, comprueba el hash de 010 y que es aditiva (sin DROP, BYPASSRLS ni f025).
- Primera aplicación en base efímera: **sin errores**; no hubo que corregir el SQL.

## T002–T004, T008 · PostgreSQL real · 2026-11-27
- `scripts/f03/verify-f032-search.mjs`: crea una base TEST efímera y marcada en el clúster de pruebas 55431 (sin puertos nuevos, `CONNECT` quitado a PUBLIC), aplica F01→F03, prueba sin F07, aplica F07 001–010, prueba con F07 y **borra la base al final** (también si falla).
- Resultado: **35/35** (base `farmafind_f01_test_b361d5d87661`, borrada: sí; la DEMO no se tocó).
  - Publicación: farmacia inactiva, sin stock, medicamento inactivo y sin principio activo quedan fuera; solo columnas públicas; sin F07 nunca hay coordenadas; con F07 solo la verificada (PENDIENTE con coordenadas guardadas → null).
  - Funciones: `SECURITY DEFINER`, dueño `f03_projection_owner` sin BYPASSRLS, `search_path` fijo, sin EXECUTE para PUBLIC; `f01_runtime` ejecuta la búsqueda pero no la limpieza. `f03.search_public_offers` no cambió.
  - Comparación: los casos de la spec (exacta, «paracetamol 500», «amoxicilina capsulas», «400mg», «x10», «500» ≠ «1500 mg», APROXIMADA, NINGUNA y FALTA_NOMBRE). Orden por coincidencias antes del límite.
  - Pedidos de Andre: «ÁCIDO», «Ácido» y «acido» dan lo mismo (limpieza y búsqueda en la base real); `concat_ws` conserva el texto con una parte NULL; el catálogo rechaza un producto sin presentación (`NOT NULL` de F02, código 23502), así que no puede existir; palabras de una letra → 0 filas en la función; «ib» solo trae ibuprofeno; «p x» → ayuda sin consultar (la API ya rechaza «p» por tener menos de 2 caracteres).
  - **Paridad TS/SQL** de la limpieza: 14 textos iguales.
  - **Sugerencias (FR-007):** las 15 sugerencias que da la base real llevan cada una a ≥ 1 resultado EXACTO.
- Hallazgos corregidos durante las pruebas: «para» no se descarta como relleno si es la única palabra; la sugerencia ya no puede escribir «null».

## T005–T007, T009–T010 · Backend, contrato y pantalla · 2026-11-27
- `backend/tests/search/f032-full-text.test.ts` 20/20; `public-contract.test.ts` y `check-openapi-routes.mjs` apuntan al contrato 0.3.0 (41 operaciones con ruta).
- `frontend/tests/f032/texto-completo.test.jsx` 5/5: aviso APROXIMADA (`role="status"`) en lista y mapa, ayuda FALTA_NOMBRE, sin aviso con EXACTA o con una respuesta vieja sin el campo.
- `scripts/f03/verify-f031-location.mjs` actualizado a la firma nueva del repositorio.
- Regresión: backend 645 pasan (2 fallos de entorno conocidos de F06.1 que necesitan su base madre); asistente F06.1 sin fallos nuevos; frontend **282/282**; `check` correcto (329 archivos).
