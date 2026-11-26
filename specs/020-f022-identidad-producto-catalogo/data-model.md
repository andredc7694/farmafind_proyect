# Modelo de datos
## `f02.medicamento` (se amplía)
`forma_farmaceutica`, `laboratorio`, `marca`: `text NOT NULL DEFAULT ''` (longitudes 80/120/120, minúsculas, espacios simples).
Identidad única nueva: `(nombre, concentracion, presentacion, forma_farmaceutica, clasificacion, laboratorio, marca)`.
## `f02.propuesta_producto` (nueva, RLS + FORCE)
`id, farmacia_id, solicitante_id, lote_id, codigo_archivo, nombre, concentracion, presentacion, forma_farmaceutica, clasificacion, laboratorio, marca, estado (PROPUESTA|APROBADA|RECHAZADA|YA_EXISTE), aviso, medicamento_sugerido_id, medicamento_id, motivo, decidido_por, decidido_at, created_at, version`.
Sin precios ni stock. Única propuesta abierta por farmacia e identidad.
## `f02.propuesta_muestra` (nueva)
`lote_id, revisor_id, propuesta_id, resultado (PENDIENTE|CORRECTA|INCORRECTA), created_at`: la muestra que el servidor exige antes de decidir en lote.
## `f02.catalogo_revisor` y `f02.catalogo_auditoria` (nuevas)
Capacidad `CATALOG_REVIEW` (alta solo offline TEST, con aprobación y revocación) y registro inmutable de cada decisión.
## Políticas
Farmacia: lee y crea solo las suyas con `can_propose_catalog(farmacia_id)`. Revisor: lee propuestas con `can_review_catalog()` y sin ser miembro de esa farmacia; no obtiene ninguna política sobre inventario, importaciones ni reservas. Cambios de estado solo por función.
