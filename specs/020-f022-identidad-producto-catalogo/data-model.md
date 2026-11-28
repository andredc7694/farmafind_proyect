# Modelo de datos (actualizado 2026-11-27; SQL en `sql/`)

## `f02.medicamento` (se amplía, sin reescribir filas)
- `forma_farmaceutica text NOT NULL DEFAULT ''`: '' o una de 16 formas (tableta, capsula, jarabe, suspension, solucion, gotas, crema, gel, unguento, inyectable, supositorio, ovulo, sobre, parche, spray, inhalador), la misma lista del asistente F06.2.
- `laboratorio`, `marca` `text NOT NULL DEFAULT ''`: minúsculas y espacios simples, hasta 120.
- Identidad única: `(nombre, concentracion, presentacion, forma_farmaceutica, clasificacion, laboratorio, marca)`; se retira `medicamento_referencia_unica`. Los 518 productos actuales quedan con los tres campos en ''.

## Propuestas (RLS + FORCE)
- `f02.propuesta_lote`: farmacia, solicitante, importación de origen, total (1–1000).
- `f02.propuesta_producto`: la ficha propuesta (nombre, principio activo obligatorio, concentración, presentación, forma, condición, laboratorio, marca, fila y código del archivo), aviso (`SIN_LABORATORIO`, `SIN_FORMA`, `POSIBLE_DUPLICADO`), producto sugerido, estado (`PROPUESTA`, `APROBADA`, `RECHAZADA`, `YA_EXISTE`), `automatica` (vinculación D-09), producto del catálogo, motivo, decisión. **Sin precio, stock, reservas ni archivo.** Una sola propuesta abierta por farmacia e identidad.
- `f02.revision_lote` y `f02.revision_muestra`: la selección del revisor (hasta 1000, vigencia de 30 min, de un solo uso) y la muestra al azar que debe marcar como correcta.
- `f02.catalogo_auditoria`: cada decisión (aprobar, rechazar, vincular, vínculo automático), inmutable.
- `f02.catalogo_revisor`: concesión `CATALOG_REVIEW`, alta y revocación solo offline TEST.

## Quién ve qué
- Farmacia: sus lotes y propuestas (si puede previsualizar o confirmar importaciones en ella).
- Revisor: propuestas de farmacias donde no es miembro, con rol de plataforma, concesión y segundo factor; sus revisiones; auditoría de esas farmacias. Nunca inventario, importaciones ni reservas.
- Escritura: solo por las funciones `submit_catalog_proposals`, `start_catalog_review`, `mark_catalog_sample` y `decide_catalog_proposals` (rol `f022_catalog`, NOLOGIN, NOBYPASSRLS).

## Inventario (sin cambios de esquema)
- D-08: el reemplazo usa las columnas y permisos actuales (`cantidad_fisica` a 0 y un movimiento) dentro de la confirmación de importación.
