# Data Model: F07.1

## Existente (F07, sin cambios de estructura)
- **`f07.ubicacion_propuesta`**: `id`, `farmacia_id`, `version`, `direccion_publicable`, `ciudad`, `latitud`, `longitud`, `precision_m`, `fuente`, `evidencia_referencia`, `estado` (PENDIENTE, PUBLICADA_VERIFICADA o RECHAZADA), `propuesta_por`, `propuesta_at`, `revisada_por`, `revisada_at`, `base_public_version`.
  - Regla: quien propone ≠ quien revisa.
  - «Reemplazada» no se guarda: se calcula cuando existe una propuesta PENDIENTE más reciente de la misma farmacia.
- **`f07.ubicacion_auditoria`**: `farmacia_id`, `propuesta_id`, `actor_usuario_id`, `accion` (PROPUESTA, APROBACION o RECHAZO), `evidencia_confirmada`, `motivo`, `ocurrido_at`.
- **`f03.farmacia_publica`**: dirección pública, ciudad, coordenadas, `estado_ubicacion`, `public_version`, `propuesta_por`, `revisada_por` y `fecha_verificacion`.
- **Perfil privado (014)**: contacto con versión y auditoría.

## Nuevo
### `f07.platform_location_grant`
| Campo | Regla |
|---|---|
| `id` | uuid |
| `actor_id` | usuario con rol `ADMINISTRADOR_PLATAFORMA` |
| `estado` | ACTIVA o REVOCADA; una sola ACTIVA por actor |
| `approval_id`, `approval_sha256`, `reason` | aprobación TEST registrada, como en F02.5 |
| `granted_at`, `revoked_at` | fechas |

### `f07.horario_atencion` (P2)
| Campo | Regla |
|---|---|
| `farmacia_id`, `dia` | clave; `dia` es un día ISO de 1 (lunes) a 7 (domingo) |
| `abre`, `cierra` | `time`, en hora de Lima; nulas si `cerrado` |
| `cerrado` | boolean; CHECK `cerrado OR (abre IS NOT NULL AND cierra IS NOT NULL AND abre < cierra)` |
| `version` | control optimista por farmacia |
| `actualizado_por`, `actualizado_at` | auditoría mínima |

### Delegación nueva por activación
`f01.delegacion` (`GEO_LOCATION_PROPOSE`, ACTIVA), concedida por la `f025/017`.

## Transiciones de estado de la ubicación
`(sin ubicación)` → propuesta **PENDIENTE** («En revisión») → **PUBLICADA_VERIFICADA** («Verificada»; se publica) o **RECHAZADA** («Rechazada», con motivo; lo publicado no cambia). Una PENDIENTE con otra PENDIENTE más reciente se muestra «Reemplazada» y no puede decidirse.
