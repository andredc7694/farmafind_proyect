# Propuesta de enmienda F07.1 · Historial en «Revisar ubicaciones» (PENDIENTE de aprobación de Andre)

**Estado (2026-11-26):** **aprobada por Andre («si»), con D-06 en A.** Incorporada a `spec.md` (FR-017, FR-018) y a `tasks.md` (T026–T031); SQL 009 copiado sin cambios a `backend/migrations/f07/`.

## Por qué hace falta
Las políticas aprobadas de la 007 solo muestran al revisor de plataforma las propuestas **pendientes** y las que **él mismo** decidió. Un historial con las decisiones de cualquier revisor necesita dos políticas nuevas de solo lectura (borrador `sql-review/009_platform_location_history.sql`, hash `21B8A3F6445C9DDA1DDD756663D5AE27631E11827DF859749A849297555845BF`).

## Requisitos propuestos
- **F071-FR-017 · Historial de decisiones:** «Revisar ubicaciones» muestra, además de las pendientes, las propuestas ya decididas, con el filtro «Pendientes / Aprobadas / Rechazadas».
  - **Cada fila:** farmacia, dirección y ciudad, coordenadas, decisión, motivo, fecha de envío, fecha de decisión y quién decidió.
  - **Orden y paginación:** de la más reciente a la más antigua, 20 filas por página.
  - **Privacidad:** igual que ahora. Solo datos de ubicación de la propuesta y de la decisión; nada de inventario, personal, contacto privado, RUC ni documentos. El revisor no ve propuestas ni historial de farmacias de las que forma parte, en ningún estado.
- **F071-FR-018 · Formulario de decisión ordenado:** etiquetas encima de cada campo, la casilla con su texto en su propia línea y espaciado correcto. Hoy se lee «Comprobé la dirección y el puntoMotivo».

## Decisión abierta
- **D-06 · «Quién decidió»:**
  - **A (recomendada):** «Tú» si lo decidió el propio revisor y «Otro revisor de FarmaFind» si no. No se muestran correos de otros administradores.
  - **B:** el correo del administrador que decidió, que expone la cuenta de otro miembro del personal.

## Columnas que podrá leer el revisor (y la API devolverá)
- **De la propuesta (`f07.ubicacion_propuesta`):** dirección publicable, ciudad, latitud, longitud, estado, fecha de envío, fecha de revisión, farmacia y versión.
- **De la decisión (`f07.ubicacion_auditoria`):** acción (APROBACION o RECHAZO), motivo, evidencia confirmada y fecha.
- **Nombre público de la farmacia:** `f01.farmacia_referencia.nombre_publico`, ya visible hoy.
- **Límite que debes conocer:** a nivel de base, `f01_runtime` ya tiene SELECT de tabla completa sobre esas dos tablas desde la 002. Restringirlo por columnas cambiaría un permiso aprobado de F07 y afectaría a los dueños. Esta propuesta **no lo cambia**. La restricción de columnas la aplica la API, que proyecta solo los campos listados; los identificadores de usuario (`propuesta_por`, `revisada_por`, `actor_usuario_id`) nunca se devuelven. Las pruebas lo comprobarán.

## Matriz de pruebas añadida (base TEST efímera, conexión reutilizada Alfa → Beta)
| # | Caso | Esperado |
|---|---|---|
| H1 | R ve decisiones de Alfa y Beta tomadas por otro revisor R3 | Las ve, con decisión y motivo |
| H2 | R2, miembro de Alfa, pide el historial | No ve nada de Alfa, ni pendiente ni decidido; sí ve Beta |
| H3 | RF sin concesión F07.1, dueño, trabajador o cliente | 0 filas / 403 |
| H4 | Bajo la sesión de R: `f02.inventario`, `f02.movimiento`, `f04` reservas, `f01.usuario_farmacia` y `f01.delegacion` ajenas, `f025.farmacia_perfil`, `f025.documento` | 0 filas (las políticas nuevas solo tocan las dos tablas de ubicación) |
| H5 | Respuesta de la API del historial | Solo las claves listadas; sin `propuesta_por`, `revisada_por`, `actor_usuario_id`, contacto ni identificadores de usuario |
| H6 | Filtro y paginación | El orden por fecha de decisión o envío es descendente y estable; página 2 sin repetidos |
| H7 | Concesión revocada o sesión cerrada | La siguiente consulta del historial se deniega |
| H8 | Regresión de la 007 | Decidir sigue limitado a la última pendiente; nadie aprueba lo propio |

## Tareas propuestas
- **T026** Aprobación de Andre de esta enmienda, D-06 y el SQL 009 (hash arriba).
- **T027** Copiar la 009 sin cambios a `backend/migrations/f07/` y añadirla a la lista cerrada con su hash.
- **T028** Servidor: `GET /api/v1/platform/location-proposals/historial?estado=PENDIENTE|APROBADA|RECHAZADA&pagina=N` (20 por página, solo los campos listados). Pruebas unitarias y HTTP con datos simulados.
- **T029** Pantalla: filtro, tabla o tarjetas paginadas y formulario de decisión ordenado. Pruebas.
- **T030** **[PUERTO]** Matriz H1 a H8 en una base efímera. Se puede hacer en la base de la copia temporal, que es efímera y no es la DEMO.
- **T031** Mostrar el resultado en la copia temporal (3001 y 5174), sin tocar la DEMO, su base ni su Redis.
