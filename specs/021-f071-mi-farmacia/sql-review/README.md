# F07.1 — Paquete de revisión del SQL (T001, T002)

**Estado:** borradores **sin ejecutar**, fuera de `backend/migrations/` para que no se apliquen solos. Tras la aprobación de Andre se copian sin cambios a `backend/migrations/f07/` (T003).

| Archivo | SHA-256 (LF) | Alcance |
|---|---|---|
| [007_platform_location_review.sql](007_platform_location_review.sql) | `6D7E0C118858D9160EEB3479241B00A0674DCE86CD227FB314F55967063BB0F9` | Revisión de ubicaciones por el administrador de plataforma y límites del Perú |
| [008_opening_hours.sql](008_opening_hours.sql) | `0A6EB089740950D3AD1B31FB9FAC8E3FAB4CF58D76AB6CC1EC0C3D2FC26D2EBF` | Horario de atención (P2) |

## Qué toca y qué no
- **No modifica ni elimina** ninguna política, función ni restricción de F07 001–006. Tampoco toca F02.5: ni la restricción de `f025.platform_capability_grant` ni `f025.has_capability`. Todas las políticas nuevas son **permisivas** y se suman a las existentes.
- **Hallazgo de diseño:** las migraciones de F07 se aplican antes que las de F02.5, y también en clústeres sin F02.5. Por eso el SQL no usa `f025.*`: tiene su propio rol de políticas `f071_policy` y su propia función de actor `f07.location_actor()`, con el mismo patrón que `f025_policy` y `f025.authenticated_actor()`.
- **Aviso (no son políticas de F07 ni de F02.5, pero sí políticas nuevas en tablas de F01):** dos políticas de **solo lectura** para el rol interno `f071_policy` (NOLOGIN, NOBYPASSRLS):
  - `f01.sesion`: solo la sesión de la huella actual (idéntica a `f025_policy_session`);
  - `f01.usuario_farmacia`: solo las membresías del propio actor, para impedir que revise su propia farmacia.
  - No dan nada a los roles de aplicación.
- **Restricción nueva** `f071_ubicacion_en_peru` (NOT VALID): solo afecta a propuestas nuevas. Las coordenadas de prueba de F07 (Lima y Arequipa) están dentro de los límites.
- **Concesión de revisión:** ningún rol de aplicación puede darla de alta. En TEST/DEMO la crea un guion de aprovisionamiento como migrador, con aprobación registrada (T018, con tu autorización expresa).

## Funciones SECURITY DEFINER
| Función | Propietario | Qué lee | Devuelve |
|---|---|---|---|
| `f07.location_actor()` | `f071_policy` | la sesión de la huella actual y `usuario.estado` | id del actor o NULL |
| `f07.can_platform_location_review(farmacia)` | `f071_policy` | rol de plataforma, concesión propia y membresías propias | verdadero si es administrador activo, tiene la concesión y **no es miembro** de esa farmacia |
| `f07.public_opening_hours(ids[])` | `f03_projection_owner` | horario de farmacias ACTIVAS (política propia) | día, cerrado, abre y cierra; máximo 50 farmacias |

`f07.can_opening_hours` es SECURITY INVOKER: corre con los permisos de `f01_runtime`.

## Matriz de pruebas (T013 y T014, base TEST efímera, conexión reutilizada Alfa → Beta)
**Actores:**
- **R:** revisor de plataforma con la concesión F07.1 y **sin** capacidades F025.
- **R2:** revisor con la concesión que además es miembro de Alfa.
- **RF:** revisor F025 **sin** la concesión F07.1.
- **DA / DB:** dueños de Alfa y Beta.
- **T:** trabajador de Alfa.
- **C:** cliente.

| # | Caso | Esperado |
|---|---|---|
| 1 | R lista las propuestas pendientes de Alfa y Beta | Las ve, solo con columnas públicas |
| 2 | R lee `f02.inventario`, `f02.movimiento` e importaciones de Alfa y Beta | 0 filas |
| 3 | R lee reservas y resúmenes de `f04` | 0 filas y funciones F04 denegadas |
| 4 | R lee `f01.usuario_farmacia`, `f01.delegacion`, invitaciones y credenciales temporales (personal) | 0 filas ajenas |
| 5 | R lee el contacto (`f025.farmacia_perfil`) y documentos (`f025.documento`) | 0 filas (R no tiene capacidades F025) |
| 6 | R lee `f07.horario_atencion` privado | 0 filas (solo la función pública) |
| 7 | R aprueba la última pendiente de Beta | Publicada, con auditoría APROBACION y versión pública +1 |
| 8 | R decide sobre una pendiente que ya no es la última | 0 filas afectadas → 409 |
| 9 | R decide con versión pública obsoleta | La publicación falla → se revierte |
| 10 | R2 intenta revisar Alfa (es miembro) | No ve ni decide nada de Alfa; sí puede decidir Beta |
| 11 | Quien propone intenta aprobar su propia propuesta (aunque sea administrador con concesión) | Denegado (CHECK de F07 + política) |
| 12 | RF (sin concesión) lista o decide | 0 filas / denegado |
| 13 | DA, T y C intentan la ruta de plataforma | 403 en API y 0 filas en SQL |
| 14 | Concesión revocada o sesión cerrada | La siguiente consulta se deniega (sin caché) |
| 15 | Rechazo | Lo publicado no cambia; auditoría RECHAZO con motivo |
| 16 | Propuesta fuera del Perú | Rechazada por `f071_ubicacion_en_peru` |
| 17 | Horario: DA guarda el de Alfa; T y DB intentan escribir el de Alfa | DA sí; T y DB no (0 filas o violación de política) |
| 18 | Horario: cierre ≤ apertura, «Cerrado» con horas | Rechazado por `horario_tramo_valido` |
| 19 | Horario público de una farmacia INACTIVA, o más de 50 ids | 0 filas |
| 20 | Alfa → Beta con la misma conexión (GUC limpiados) | Sin filtración en todos los casos anteriores |
| 21 | Regresión F07: la revisión por farmacia (`GEO_LOCATION_REVIEW`) sigue funcionando igual | Pruebas F07 existentes en verde |

**Fuera del alcance de F07.1:** un revisor que además tenga capacidades F025 (como el de la DEMO) ya puede leer documentos de **solicitudes** por F02.5. F07.1 no amplía ni reduce ese acceso, y el caso 5 lo prueba con R sin capacidades F025.
