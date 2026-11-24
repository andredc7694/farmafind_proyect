-- F04.1 (specs/015): preferencia de recogida opcional, inmutable y separada de la reserva.
-- No altera f04.reserva, reserve_stock, close_reservation_stock ni el vencimiento (F04-TIME-01).
-- Solo bases TEST efímeras o fixtures marcados. Sin BYPASSRLS; el worker de expiración no recibe permisos.

CREATE TABLE f04.preferencia_recogida (
  reserva_id uuid PRIMARY KEY REFERENCES f04.reserva(id) ON DELETE RESTRICT,
  farmacia_id uuid NOT NULL REFERENCES f01.farmacia_referencia(id) ON DELETE RESTRICT,
  usuario_id uuid NOT NULL REFERENCES f01.usuario(id) ON DELETE RESTRICT,
  tipo text NOT NULL CHECK (tipo IN ('MINUTOS', 'FRANJA')),
  minutos integer CHECK (minutos IS NULL OR minutos IN (30, 60, 120)),
  franja_inicio timestamptz,
  franja_fin timestamptz,
  creado_en timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT preferencia_coherente CHECK (
    (tipo = 'MINUTOS' AND minutos IS NOT NULL AND franja_inicio IS NULL AND franja_fin IS NULL) OR
    (tipo = 'FRANJA' AND minutos IS NULL AND franja_inicio IS NOT NULL AND franja_fin IS NOT NULL
      AND franja_fin > franja_inicio
      AND franja_fin - franja_inicio BETWEEN interval '15 minutes' AND interval '120 minutes'))
);

ALTER TABLE f04.preferencia_recogida ENABLE ROW LEVEL SECURITY;
ALTER TABLE f04.preferencia_recogida FORCE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON f04.preferencia_recogida TO f01_runtime;

CREATE POLICY preferencia_select ON f04.preferencia_recogida FOR SELECT TO f01_runtime USING (
  usuario_id = NULLIF(current_setting('app.actor_user_id', true), '')::uuid
  OR f04.can_reservation_action(farmacia_id, 'reservation.read'));

CREATE POLICY preferencia_insert ON f04.preferencia_recogida FOR INSERT TO f01_runtime WITH CHECK (
  usuario_id = NULLIF(current_setting('app.actor_user_id', true), '')::uuid
  AND farmacia_id::text = NULLIF(current_setting('app.farmacia_id', true), '')
  AND f04.has_live_actor()
  AND EXISTS (SELECT 1 FROM f04.reserva r
               WHERE r.id = reserva_id AND r.usuario_id = preferencia_recogida.usuario_id
                 AND r.farmacia_id = preferencia_recogida.farmacia_id));

CREATE INDEX reserva_historial_idx ON f04.reserva (farmacia_id, creado_en DESC, id)
  WHERE estado IN ('ENTREGADA', 'CANCELADA', 'EXPIRADA');
