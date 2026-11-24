# Data model — F04.1

Migración aditiva `backend/migrations/f04/008_pickup_preference.sql`. Solo bases TEST efímeras o fixtures marcados. Tabla nueva con `ENABLE` y `FORCE ROW LEVEL SECURITY`; el rol `f01_runtime` no obtiene permisos globales ni `BYPASSRLS`.

## `f04.preferencia_recogida`
| Columna | Tipo / regla |
|---|---|
| `reserva_id` | `uuid PRIMARY KEY REFERENCES f04.reserva(id) ON DELETE RESTRICT` |
| `farmacia_id` | `uuid NOT NULL REFERENCES f01.farmacia_referencia(id)` (copia de la reserva; permite RLS directa) |
| `usuario_id` | `uuid NOT NULL REFERENCES f01.usuario(id)` (dueño de la reserva) |
| `tipo` | `text NOT NULL CHECK IN ('MINUTOS','FRANJA')` |
| `minutos` | `integer` — `CHECK (minutos IN (30,60,120))`; obligatorio si `tipo='MINUTOS'` |
| `franja_inicio`, `franja_fin` | `timestamptz` — obligatorios si `tipo='FRANJA'`; `fin > inicio` y `fin - inicio BETWEEN 15 AND 120 minutos` |
| `creado_en` | `timestamptz NOT NULL DEFAULT now()` |
CHECK de coherencia: `MINUTOS` ⇒ minutos no nulo y franja nula; `FRANJA` ⇒ franja no nula y minutos nulo. Coherencia con la reserva: FK compuesta no es posible (la PK de reserva es `id`); la política de inserción exige que la reserva exista, pertenezca al actor y a la farmacia del contexto.

### Políticas (todas `TO f01_runtime`)
- `SELECT`: `usuario_id = app.actor_user_id` **o** `f04.can_reservation_action(farmacia_id,'reservation.read')`.
- `INSERT`: `usuario_id = app.actor_user_id` **y** `farmacia_id = app.farmacia_id` **y** `f04.has_live_actor()` **y** existe la reserva con ese `id`, `usuario_id` y `farmacia_id`.
- Sin `UPDATE` ni `DELETE` para ningún rol de aplicación (la preferencia es inmutable).
- El worker de expiración **no** recibe permisos sobre esta tabla.

### Índice
`reserva_historial_idx ON f04.reserva (farmacia_id, creado_en DESC, id) WHERE estado IN ('ENTREGADA','CANCELADA','EXPIRADA')`.

## Sin cambios
`f04.reserva`, `f04.idempotencia` (la huella de creación incluye la preferencia en la aplicación), `f04.outbox_evento`, funciones `reserve_stock` y `close_reservation_stock`.
