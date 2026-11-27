# Research — F03.2

## R-01 · Por qué da 0 hoy
- `f03.search_public_offers` (F03 002 y F07 003) usa `position(p_query in m.nombre)` o en `m.principio_activo`.
- El término llega en minúsculas (`canonicalizeTerm`) y los datos también (restricciones de F02 002), pero las **tildes se guardan**. «paracetamol 500 mg tabletas x 10» no está entero en ningún campo.
- La sugerencia «presentación» (`suggest-public.ts`) arma `nombre concentración presentación`, por eso lleva al vacío.

## R-02 · Quitar tildes sin extensiones
- `unaccent` es una extensión (D-01 C, descartada). `translate(lower(x), 'áàäâãéèëêíìïîóòöôõúùüûñç', 'aaaaaeeeeiiiiooooouuuunc')` es parte de PostgreSQL y es `IMMUTABLE`.
- En TypeScript: `normalize('NFD')` y quitar marcas (`\p{M}`), que da el mismo resultado para esas letras. Una prueba de paridad lo garantiza.
- PostgreSQL 18 (`compose.f025-postgres.yaml`) admite `(?<!…)` y `(?!…)` en expresiones regulares, usados para tratar el punto decimal.

## R-03 · Palabras y números
- Números y unidades como **palabra entera**: evita que «500» encuentre «1500 mg» y que «g» encuentre cualquier texto con g.
- Palabras como **parte del texto**: conserva lo de hoy («parace» encuentra paracetamol).
- Singular quitando «s»/«es» al final: el resultado es un prefijo del original, así que nunca se pierde una coincidencia que hoy existe.

## R-04 · Dónde decidir «exacta»
- La base devuelve `coincidencias` por fila; el caso de uso conoce el total de palabras. Así no se repite la lógica en la pantalla (D-03 A) y la función SQL no necesita listas de vocabulario.
- Ordenar en SQL por `coincidencias DESC` antes del límite de 200 asegura que los exactos no se pierdan por el límite.

## R-05 · Rendimiento esperado
- Con 518 productos, la función recorre como mucho 518 filas de inventario y limpia 2 textos por fila. Se espera muy por debajo de 100 ms; se mide (FR-011) antes de decidir índices (D-05 A).

## R-06 · Alternativas descartadas
- Solo backend (D-01 B): no resuelve las tildes guardadas y el límite de 200 puede esconder exactos.
- `pg_trgm`/`unaccent` (D-01 C): extensiones e índices nuevos; tolera errores de tipeo, que quedaron fuera.
- Búsqueda de texto completo de PostgreSQL (`to_tsvector`): su diccionario español cambia palabras de forma difícil de predecir y no maneja «500mg»; no aporta frente a lo propuesto.
