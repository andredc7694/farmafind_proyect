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
