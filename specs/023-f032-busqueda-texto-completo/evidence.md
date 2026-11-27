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

## T011 · Medición con los 518 productos (D-04 A) · 2026-11-27
- Base TEST efímera `farmafind_f01_test_fb1e7b8c70d8` en el clúster de pruebas 55431, marcada y sin `CONNECT` para PUBLIC; **sin puertos nuevos**.
- Restaurada desde `farmafind_f01_test_d0570879cf41_antes-arranque-f032_20261127.dump` (621855 bytes) pasándola por la entrada estándar del contenedor: **el archivo no salió de `.cache`**. Restauración sin errores.
- Totales restaurados: 518 productos de inventario, 518 medicamentos, 1 farmacia activa. Migraciones aplicadas: F03 003_search_terms.sql; F07 010_search_terms_location.sql.
- 50 corridas por consulta tras 5 de calentamiento, como `f01_runtime`, sin caché. Tiempos en ms (ida y vuelta a la base). «Antes» = `f03.search_public_offers` con el texto completo; «después» = `f03.search_public_offers_terms`.

| Consulta | Filas antes | Filas después | Coincidencia (total) | Antes p50 / p95 | Después p50 / p95 | Caso de uso p95 | EXPLAIN |
|---|---|---|---|---|---|---|---|
| paracetamol | 7 | 7 | EXACTA (7) | 1.57 / 3.65 | 13.05 / 14.88 | 19.85 | 11.24 |
| paracetamol 500 mg tabletas x 10 | 0 | 7 | APROXIMADA (7) | 1.07 / 2.58 | 19.57 / 27.44 | 25.31 | 16.33 |
| paracetamol 500 | 0 | 7 | EXACTA (2) | 1.06 / 2.63 | 12.82 / 15.83 | 15.03 | 11.55 |
| amoxicilina capsulas | 0 | 17 | APROXIMADA (17) | 1 / 2.22 | 19.58 / 22.37 | 28.15 | 19.59 |
| ibuprofeno 400mg | 0 | 14 | EXACTA (4) | 1.13 / 2.62 | 13.68 / 15.25 | 15.47 | 12.4 |
| acido | 0 | 17 | EXACTA (17) | 1.07 / 2.75 | 13.51 / 16 | 14.61 | 10.55 |
| xyzol 500 mg | 0 | 0 | NINGUNA (0) | 1.16 / 2.31 | 12.3 / 20.17 | 15.65 | 10.79 |

- **Meta FR-011:** p95 ≤ 100 ms → **cumple** (peor p95 27.44 ms). Sin empeorar más de 2× → **no cumple** (peor relación 10.64×; la búsqueda actual tarda 1–3 ms porque compara sin limpiar, y la nueva limpia el texto de cada fila con expresiones regulares, unos 0,02 ms por fila).
- Un índice no resuelve esto: el costo está en limpiar el texto fila por fila, no en encontrar filas. Según D-05, se presenta a Andre una enmienda antes de seguir.
- **Base borrada y confirmada** (`borrada: true`). Quedan solo las bases de la DEMO: farmafind_f01_test_0e5a2f669e60, farmafind_f01_test_d0570879cf41. La DEMO no se leyó ni se tocó.
- Observación con los datos reales (sin nombres de productos): las presentaciones del catálogo se escriben «caja x N» o «frasco … ml», sin «tabletas» ni «cápsulas». Por eso «paracetamol 500 mg tabletas x 10» y «amoxicilina capsulas» dan **APROXIMADA**: muestran los del medicamento con el aviso, los más parecidos primero, como pide la spec.

## T013 · Copia temporal 3001/5174 · 2026-11-27
- Base efímera propia (marca TEST, clúster de pruebas), datos ficticios: 4 farmacias (3 con ubicación verificada) y 9 productos: paracetamol 500 mg tabletas x 10 y x 100, 1 g tabletas x 10, 120 mg/5 ml jarabe; amoxicilina 500 mg cápsulas x 100 y 250 mg/5 ml suspensión; ibuprofeno 400 mg y 600 mg; ácido acetilsalicílico 100 mg. Sin el Redis compartido (la caché apunta a un puerto sin servicio y cae a PostgreSQL). Sin servicio externo de direcciones.
- E2E con Chrome (toda petición externa bloqueada y contada):
  - API: «paracetamol 500 mg tabletas x 10» → EXACTA, solo esa presentación; «paracetamol 500» → las dos de 500 mg; «amoxicilina capsulas» → solo cápsulas; «ibuprofeno 400mg» = «IBUPROFENO 400 MG»; «acido acetilsalicilico» y «ÁCIDO» → el ácido acetilsalicílico; «paracetamol 750 mg» → APROXIMADA con los 4 paracetamoles; «tabletas» y «500 mg» → FALTA_NOMBRE; «xyzol 500 mg» → NINGUNA; «paracetamol» → los 4 (igual que antes).
  - Pantalla: sin aviso con EXACTA; aviso con APROXIMADA en lista y mapa; ayuda «Escribe también el nombre…» con FALTA_NOMBRE; vacío de siempre con NINGUNA.
  - Sugerencias: 13 distintas, todas EXACTAS y con resultados; elegir «paracetamol 500 mg tabletas x 100» en pantalla muestra 2 tarjetas sin aviso.
  - axe: sin violaciones graves ni críticas. Llamadas externas reales: 0 (solo se bloquearon las teselas de OpenStreetMap).
- Pendiente: revisión de Andre en http://localhost:5174/search.

## Enmienda de rendimiento (opción A) · 2026-11-27
- Andre eligió la opción A y pidió corregir los mismos archivos si la Constitution lo permite. **Lo permite:** solo exige migraciones versionadas y reproducibles; no prohíbe corregir una migración que aún no está en `main` ni en la DEMO. La v1 (`374AEED7…D922` y `C5F0D8F9…873B`) solo se aplicó en bases efímeras ya borradas y en la copia temporal de revisión. Las listas cerradas de hashes obligan a una nueva aprobación.
- **Primer intento (v2a, filtro previo por oferta):** resultados idénticos, pero poca mejora: con 5180 ofertas, p95 de 79 a 172 ms; «xyzol», que no limpia ninguna fila, tardaba 57 ms. Causa: el inventario tiene RLS forzado y la v2a seguía recorriendo todas las ofertas antes de filtrar. Se descartó.
- **v2 propuesta (catálogo primero):** filtra el catálogo con una comparación barata sin expresiones regulares, limpia el texto **una vez por medicamento** y solo después busca las ofertas públicas de esos medicamentos. Mismas reglas de publicación. Agrega un desempate final (concentración e id) porque en la v1 dos productos con el mismo nombre y presentación en la misma farmacia podían salir en orden variable.
- SHA-256 de los borradores v2 (texto con LF): `sql/f03_003_search_terms.sql` `FDCBBD7F0A7381D7C9A8700406C3A0D4C4CF84384E85B50C10AC4736E003E5BB`; `sql/f07_010_search_terms_location.sql` `005D52E14820CEA02DC431AE9B8CFD1240B5BB8305D753B39A43CF5F5E1A3F6D`. Siguen difiriendo solo en las coordenadas.

### Comparación v1 vs v2 (resultados idénticos)
- Base efímera restaurada desde `farmafind_f01_test_d0570879cf41_antes-arranque-f032_20261127.dump` (por la entrada estándar del contenedor; el archivo no salió de `.cache`), en el clúster de pruebas y sin puertos nuevos. La v2 se creó **solo en esa base** con otro nombre, junto a la v1 real (versión con F07 y versión solo-F03), con el mismo dueño `f03_projection_owner` y ejecutada como `f01_runtime`.
- **120 casos:** las 15 sugerencias de la verificación (35/35), «ÁCIDO», «Ácido», «acido», «paracetamol 500 mg tabletas x 10» y otros textos de la spec; palabras cortas («ib», «pa», «para», «p x», «paracetamol b c»); textos raros («vitamina b12», «co-trimoxazol», «0,5%»); las sugerencias que dan los datos reales para 15 comienzos, y llamadas directas con palabras de una letra, `5.5`, `x%`, `b12` y sin palabras.
- Con 518 ofertas: 2062 filas comparadas; **0 diferencias** en filas, en orden de la clave (coincidencias, nombre, presentación, farmacia) y en orden completo (la v1 ordenada con el desempate = la v2).
- Con 5180 ofertas (518 reales + 9 farmacias sintéticas ficticias con el mismo catálogo y precios variados): 21458 filas; **0 diferencias**.
- La base se borró y se comprobó (`borrada: true`). Quedan las dos bases de la DEMO y la de la copia temporal de revisión.

### Tiempos (ms, 50 corridas tras 5 de calentamiento, como `f01_runtime`, sin caché)
«Actual» = `f03.search_public_offers` (texto completo, sin limpieza). Atención: la actual da **0 filas** en todas las consultas salvo «paracetamol» (por eso es tan rápida en ellas).

**518 ofertas**
| Consulta | Filas | Actual p50 / p95 | v1 p50 / p95 | v2 p50 / p95 |
|---|---|---|---|---|
| paracetamol | 7 | 2.3 / 3.35 | 13.59 / 19.37 | 5.97 / 8.71 |
| paracetamol 500 mg tabletas x 10 | 7 | 1.43 / 3.35 | 19.99 / 24.2 | 10.45 / 13.5 |
| paracetamol 500 | 7 | 1.16 / 2.58 | 12.93 / 14.21 | 5.93 / 8.54 |
| amoxicilina capsulas | 17 | 1.29 / 2.77 | 20.24 / 26.14 | 12.92 / 15.92 |
| ibuprofeno 400mg | 14 | 2.29 / 5.71 | 15.77 / 21.48 | 6.97 / 8.45 |
| acido | 17 | 1.25 / 1.64 | 14.45 / 17.42 | 6.92 / 7.4 |
| xyzol 500 mg | 0 | 1.24 / 1.95 | 14.91 / 23.86 | 7.41 / 14.09 |

**5180 ofertas**
| Consulta | Filas | Actual p50 / p95 | v1 p50 / p95 | v2 p50 / p95 |
|---|---|---|---|---|
| paracetamol | 106 | 20.75 / 32.46 | 85.32 / 93.83 | 8.83 / 10.89 |
| paracetamol 500 mg tabletas x 10 | 106 | 1.28 / 2.36 | 165.09 / 183.84 | 13.33 / 14.8 |
| paracetamol 500 | 106 | 1.22 / 2.61 | 85.66 / 105.9 | 9.06 / 10.45 |
| amoxicilina capsulas | 179 | 1.25 / 2.51 | 165.92 / 217.63 | 14.27 / 16.24 |
| ibuprofeno 400mg | 140 | 1.31 / 2.17 | 91.36 / 116.56 | 10.51 / 13.5 |
| acido | 188 | 1.3 / 2.44 | 89.91 / 107.12 | 10.81 / 13.75 |
| xyzol 500 mg | 0 | 1.26 / 2.21 | 77.39 / 91.52 | 6.07 / 7.15 |

- **Meta ≤ 100 ms p95:** cumple holgado (peor p95 de la v2: 15.92 ms con 518 y 16.24 ms con 5180).
- **«No más de 2× la actual»:** con la misma consulta que ambas resuelven («paracetamol»), la v2 tarda 8.71 ms contra 3.35 ms con 518 (≈2.6×) y **10.89 ms contra 32.46 ms con 5180** (más rápida que la actual). Queda un costo fijo de unos 6 ms por revisar el catálogo. En las consultas que la actual no resuelve (0 filas), la relación no compara trabajos equivalentes.
- Frente a la v1: entre 2 y 14 veces más rápida, y su costo ya no crece con el número de ofertas.

### Mejora futura (opción C), anotada a pedido de Andre
- Guardar el texto ya limpio en el catálogo (`f02.medicamento`, columna calculada) para quitar también el costo fijo. Cambia la tabla de F02, así que se evaluará **junto con la spec 020** (identidad de producto y catálogo, en opción A). Sin empezar.
