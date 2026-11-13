# F03 — Modelo de datos y proyección pública

## Entidades

| Entidad | Campos relevantes | Reglas |
|---|---|---|
| Referencia de medicamento | id, nombre comercial, principio activo, concentración, presentación, clasificación, estado | Catálogo común. Solo ACTIVO se publica; principio activo no se infiere. |
| Perfil público de farmacia | farmacia_id, dirección, latitud/longitud opcionales, actualización | Uno a uno con F01; solo farmacia ACTIVA. |
| Inventario fuente | farmacia_id, medicamento_id, precio, física, comprometida, última revisión | Privado y RLS. Disponible = física − comprometida. |
| Oferta pública | medicamento/presentación, farmacia/dirección, precio, disponible, revisión, ubicación opcional | Solo lectura; no expone cantidades internas ni personas. |
| Consulta pública | término, filtros, orden, página, tamaño, coordenadas efímeras | Coordenadas no persisten ni entran en la clave. |
| Entrada de caché | versión, generación, hash, payload público, caducidad | Derivada y descartable. |

## Relaciones

`f02.medicamento 1—N f02.inventario N—1 f01.farmacia_referencia`. `f03.farmacia_publica` extiende uno a uno la referencia F01. La función pública devuelve solo filas con medicamento/farmacia activos y disponibilidad positiva.

## Migración

1. Crear esquema F03 y rol de proyección.
2. Añadir principio activo nullable; completar solo fixtures verificados.
3. Excluir referencias incompletas de publicación e imponer obligatoriedad a nuevas referencias.
4. Crear perfil público con FK restrictiva, dirección 1–240 y coordenadas ambas nulas o ambas válidas.
5. Crear índices de búsqueda/estado y comprobar `EXPLAIN`.
6. Aplicar RLS, función fija y grants mínimos.

## Validaciones

- Término normalizado, 2–120 caracteres; presentaciones siguen separadas.
- Precio en centavos no negativo; mínimo ≤ máximo.
- Disponibilidad pública booleana: física − comprometida > 0.
- La fecha pública es `ultima_revision_at`; leer/cachear no la cambia.
- Coordenadas ambas o ninguna; latitud −90..90, longitud −180..180.
- Página desde 1, tamaño 1–50 y orden estable con desempates.

## RLS y permisos

- F03 no amplía mutación de `f01_runtime`.
- `f03_projection_owner`: NOLOGIN, NOSUPERUSER, NOBYPASSRLS y no dueño de tablas.
- Función con search_path fijo, sin SQL dinámico y columnas declaradas.
- Runtime HTTP solo ejecuta proyección; no accede a movimientos, importaciones, membresías, sesiones, auditoría o reservas.

## Ciclo de caché

`MISS/EXPIRED/INVALID → PostgreSQL → VALIDATED → CACHED`. Un cambio confirmado incrementa generación; entradas anteriores quedan obsoletas y expiran. Redis caído produce BYPASS a PostgreSQL.
