# Modelo de datos propuesto F02.1

## Entidades existentes reutilizadas

- `f02.importacion`: id, farmacia, actor, digest, estado, errores, creación, caducidad y confirmación. Se conserva su máquina de estados y límite de 30 minutos.
- `f02.importacion_fila`: una fila normalizada de vista previa, referencia, precio, cantidad y `error_code` legado. Se conserva para compatibilidad.
- Inventario/movimientos F02 y compromisos F04 no cambian de propiedad ni de invariantes.

## Nuevas entidades propuestas

| Entidad | Campos mínimos | Reglas |
|---|---|---|
| `f02.perfil_importacion` | id, farmacia_id, nombre no sensible, versión, huella de encabezados, hoja/fila/mapeo, actor, fechas | Unicidad de nombre por farmacia; solo columnas del catálogo de seis campos; RLS y capacidad explícita; no incluye archivo ni valores de productos. |
| `f02.importacion_incidencia` | importacion_id, farmacia_id, numero_fila, columna_origen, campo_destino, codigo, parámetros seguros | FK a importación/farmacia; varias incidencias por fila; no guarda valor bruto, stack trace ni PII; RLS sigue propietario de importación. |

La tabla `f02.importacion_fila.error_code` permanece como resumen compatible. Los metadatos de hoja/fila/huella seleccionados se proponen como columnas aditivas en `f02.importacion` o referencia a perfil, sin reemplazar filas históricas. La migración deberá ser reversible mediante nueva migración explícita, sin borrar tablas ni datos históricos.

## Validaciones y estados

1. `INSPECCIONADO` es solo respuesta temporal, no nuevo estado persistido del importador F02.
2. Vista previa conserva `VISTA_PREVIA → CONFIRMADA | RECHAZADA | EXPIRADA`; una incidencia impide `CONFIRMADA`.
3. Cada perfil pertenece a una sola farmacia; usuario con dos membresías usa contexto activo y no comparte el perfil por identidad.
4. Guardar perfil requiere `inventory.import.confirm` y acción explícita independiente; confirmar inventario requiere esa misma capacidad y otra acción explícita.
5. RLS en tablas nuevas: rol runtime sin SUPERUSER/BYPASSRLS, FORCE ROW LEVEL SECURITY, actor/farmacia en contexto transaccional, comprobación de membresía/capacidad. Propietario de migración separado y sin acceso runtime general.
6. El catálogo solo ofrece coincidencias por atributos normalizados aprobados. Diferente concentración/presentación nunca se fusiona automáticamente.
7. Una confirmación válida aplica stock y movimientos en una transacción; la invalidación Redis ocurre después del commit. Una falla no deja cambios parciales.
