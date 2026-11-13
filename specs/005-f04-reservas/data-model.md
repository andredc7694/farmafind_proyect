# F04 — Modelo de datos

## `f04.configuracion_farmacia`

| Campo | Regla |
|---|---|
| `farmacia_id` | PK/FK a farmacia; mismo tenant. |
| `plazo_recogida_horas` | entero, `1..8`, default `4`. |
| `actualizado_por` / `actualizado_en` | actor autorizado y timestamp. |

Ausencia de fila equivale a default 4. Actualización exige `reservation.settings` y no cambia reservas existentes.

## `f04.reserva`

| Campo | Regla |
|---|---|
| `id` | UUID. |
| `usuario_id` | propietario autenticado. |
| `farmacia_id`, `inventario_id`, `medicamento_id` | relación consistente con F02. |
| `cantidad` | entero positivo. |
| `estado` | PENDIENTE, CONFIRMADA, ENTREGADA, CANCELADA o EXPIRADA. |
| `respuesta_expira_en` | creación + plazo PENDIENTE. |
| `confirmado_en`, `recogida_expira_en` | nulos hasta confirmar; vencimiento exacto inmutable. |
| `motivo_cierre` | requerido para cancelación especial. |
| `version` | aumenta en cada transición. |
| timestamps | creación/actualización oficiales. |

Transiciones: `PENDIENTE → CONFIRMADA|CANCELADA|EXPIRADA`; `CONFIRMADA → ENTREGADA|CANCELADA|EXPIRADA`. Terminales no cambian.

## Entidades auxiliares

- `f04.transicion_reserva`: historial inmutable con origen/destino, actor/worker, motivo, correlación y tiempo.
- `f04.idempotencia`: hash de clave, actor, operación, huella y resultado; unicidad por actor+operación+hash.
- `f04.incidencia_stock`: reserva, tenant, inventario, cantidad, motivo fijo, actor, correlación y fecha; no corrige automáticamente inventario.
- `f04.outbox_evento`: UUID, tenant, reserva, tipo, payload mínimo, correlación, creado_en, publicado_en nulo e intentos cero.

## Inventario F02

F04 incrementa compromiso al crear; libera al cancelar/expirar; al entregar reduce físico y comprometido. Siempre `0 ≤ comprometida ≤ física`. Reservar no cambia fecha de revisión.

## Índices y RLS

- Cliente: `(usuario_id, creado_en desc)`.
- Farmacia/cola: `(farmacia_id, estado, respuesta_expira_en, recogida_expira_en)`.
- Expiración parcial por estados vigentes.
- Outbox pendiente para F05.
- Todas las filas tenant llevan `farmacia_id`, `ENABLE/FORCE RLS`, `USING/WITH CHECK` y FK coherentes.
