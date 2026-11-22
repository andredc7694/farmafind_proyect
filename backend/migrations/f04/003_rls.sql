DO $role$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='f04_expiration_worker') THEN
    CREATE ROLE f04_expiration_worker NOLOGIN NOSUPERUSER NOBYPASSRLS;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='f04_expiration_worker' AND (rolsuper OR rolbypassrls OR rolcanlogin)) THEN
    RAISE EXCEPTION 'worker F04 debe ser NOLOGIN NOSUPERUSER NOBYPASSRLS';
  END IF;
END $role$;

ALTER TABLE f04.configuracion_farmacia ENABLE ROW LEVEL SECURITY; ALTER TABLE f04.configuracion_farmacia FORCE ROW LEVEL SECURITY;
ALTER TABLE f04.reserva ENABLE ROW LEVEL SECURITY; ALTER TABLE f04.reserva FORCE ROW LEVEL SECURITY;
ALTER TABLE f04.transicion_reserva ENABLE ROW LEVEL SECURITY; ALTER TABLE f04.transicion_reserva FORCE ROW LEVEL SECURITY;
ALTER TABLE f04.idempotencia ENABLE ROW LEVEL SECURITY; ALTER TABLE f04.idempotencia FORCE ROW LEVEL SECURITY;
ALTER TABLE f04.incidencia_stock ENABLE ROW LEVEL SECURITY; ALTER TABLE f04.incidencia_stock FORCE ROW LEVEL SECURITY;
ALTER TABLE f04.outbox_evento ENABLE ROW LEVEL SECURITY; ALTER TABLE f04.outbox_evento FORCE ROW LEVEL SECURITY;

GRANT SELECT,INSERT,UPDATE ON f04.reserva TO f01_runtime;
GRANT SELECT,INSERT ON f04.transicion_reserva,f04.idempotencia,f04.incidencia_stock,f04.outbox_evento TO f01_runtime;
GRANT UPDATE(resultado,reserva_id) ON f04.idempotencia TO f01_runtime;
GRANT SELECT,INSERT,UPDATE ON f04.configuracion_farmacia TO f01_runtime;
GRANT UPDATE(cantidad_comprometida,cantidad_fisica,version) ON f02.inventario TO f01_runtime;
GRANT USAGE ON SCHEMA f04,f02 TO f04_expiration_worker;
GRANT EXECUTE ON FUNCTION f04.can_reservation_action(uuid,text) TO f04_expiration_worker;
GRANT SELECT,UPDATE(estado,motivo_cierre,version,actualizado_en) ON f04.reserva TO f04_expiration_worker;
GRANT INSERT ON f04.transicion_reserva,f04.outbox_evento TO f04_expiration_worker;
GRANT SELECT ON f04.outbox_evento TO f04_expiration_worker;
GRANT SELECT,UPDATE(cantidad_comprometida,version) ON f02.inventario TO f04_expiration_worker;

CREATE POLICY reserva_select ON f04.reserva FOR SELECT TO f01_runtime USING (
  usuario_id=NULLIF(current_setting('app.actor_user_id',true),'')::uuid OR f04.can_reservation_action(farmacia_id,'reservation.read'));
CREATE POLICY reserva_insert ON f04.reserva FOR INSERT TO f01_runtime WITH CHECK (
  usuario_id=NULLIF(current_setting('app.actor_user_id',true),'')::uuid AND
  farmacia_id::text=NULLIF(current_setting('app.farmacia_id',true),'') AND f04.has_live_actor());
CREATE POLICY reserva_update ON f04.reserva FOR UPDATE TO f01_runtime USING (
  usuario_id=NULLIF(current_setting('app.actor_user_id',true),'')::uuid OR
  f04.can_reservation_action(farmacia_id,'reservation.accept') OR f04.can_reservation_action(farmacia_id,'reservation.deliver'))
  WITH CHECK (usuario_id=NULLIF(current_setting('app.actor_user_id',true),'')::uuid OR
  f04.can_reservation_action(farmacia_id,'reservation.accept') OR f04.can_reservation_action(farmacia_id,'reservation.deliver'));

CREATE POLICY config_select ON f04.configuracion_farmacia FOR SELECT TO f01_runtime USING (
  farmacia_id::text=NULLIF(current_setting('app.farmacia_id',true),'') AND f04.has_live_actor());
CREATE POLICY config_write ON f04.configuracion_farmacia FOR ALL TO f01_runtime USING (
  f04.can_reservation_action(farmacia_id,'reservation.settings')) WITH CHECK (
  f04.can_reservation_action(farmacia_id,'reservation.settings') AND actualizado_por=NULLIF(current_setting('app.actor_user_id',true),'')::uuid);

CREATE POLICY transition_select ON f04.transicion_reserva FOR SELECT TO f01_runtime USING (
  EXISTS(SELECT 1 FROM f04.reserva r WHERE r.id=reserva_id));
CREATE POLICY transition_insert ON f04.transicion_reserva FOR INSERT TO f01_runtime WITH CHECK (
  farmacia_id::text=NULLIF(current_setting('app.farmacia_id',true),'') AND f04.has_live_actor());
CREATE POLICY idempotency_actor ON f04.idempotencia FOR ALL TO f01_runtime USING (
  actor_usuario_id=NULLIF(current_setting('app.actor_user_id',true),'')::uuid) WITH CHECK (
  actor_usuario_id=NULLIF(current_setting('app.actor_user_id',true),'')::uuid);
CREATE POLICY incidence_staff ON f04.incidencia_stock FOR ALL TO f01_runtime USING (
  f04.can_reservation_action(farmacia_id,'reservation.accept')) WITH CHECK (f04.can_reservation_action(farmacia_id,'reservation.accept'));
CREATE POLICY outbox_tenant ON f04.outbox_evento FOR ALL TO f01_runtime USING (
  farmacia_id::text=NULLIF(current_setting('app.farmacia_id',true),'') AND f04.has_live_actor()) WITH CHECK (
  farmacia_id::text=NULLIF(current_setting('app.farmacia_id',true),'') AND f04.has_live_actor());

CREATE POLICY inventory_reservation_select ON f02.inventario FOR SELECT TO f01_runtime USING (
  farmacia_id::text=NULLIF(current_setting('app.farmacia_id',true),'') AND f04.has_live_actor());
CREATE POLICY inventory_reservation_update ON f02.inventario FOR UPDATE TO f01_runtime USING (
  farmacia_id::text=NULLIF(current_setting('app.farmacia_id',true),'') AND f04.has_live_actor()) WITH CHECK (
  farmacia_id::text=NULLIF(current_setting('app.farmacia_id',true),'') AND f04.has_live_actor());
CREATE POLICY movement_reservation_insert ON f02.movimiento FOR INSERT TO f01_runtime WITH CHECK (
  actor_usuario_id=NULLIF(current_setting('app.actor_user_id',true),'')::uuid AND
  (f04.can_reservation_action(farmacia_id,'reservation.accept') OR f04.can_reservation_action(farmacia_id,'reservation.deliver')));

CREATE POLICY reservation_worker_select ON f04.reserva FOR SELECT TO f04_expiration_worker USING (
  true);
CREATE POLICY reservation_worker_update ON f04.reserva FOR UPDATE TO f04_expiration_worker USING (
  estado IN ('PENDIENTE','CONFIRMADA')) WITH CHECK (estado='EXPIRADA');
CREATE POLICY transition_worker_insert ON f04.transicion_reserva FOR INSERT TO f04_expiration_worker WITH CHECK (
  origen='WORKER' AND actor_usuario_id IS NULL AND estado_destino='EXPIRADA');
CREATE POLICY outbox_worker_insert ON f04.outbox_evento FOR INSERT TO f04_expiration_worker WITH CHECK (
  tipo='RESERVA_EXPIRADA');
CREATE POLICY outbox_worker_select ON f04.outbox_evento FOR SELECT TO f04_expiration_worker USING (
  tipo='RESERVA_EXPIRADA');
CREATE POLICY inventory_worker_select ON f02.inventario FOR SELECT TO f04_expiration_worker USING (
  EXISTS(SELECT 1 FROM f04.reserva r WHERE r.inventario_id=inventario.id AND r.farmacia_id=inventario.farmacia_id
    AND ((r.estado='PENDIENTE' AND r.respuesta_expira_en<=now()) OR (r.estado='CONFIRMADA' AND r.recogida_expira_en<=now()))));
CREATE POLICY inventory_worker_update ON f02.inventario FOR UPDATE TO f04_expiration_worker USING (
  EXISTS(SELECT 1 FROM f04.reserva r WHERE r.inventario_id=inventario.id AND r.farmacia_id=inventario.farmacia_id
    AND ((r.estado='PENDIENTE' AND r.respuesta_expira_en<=now()) OR (r.estado='CONFIRMADA' AND r.recogida_expira_en<=now())))) WITH CHECK (
  EXISTS(SELECT 1 FROM f04.reserva r WHERE r.inventario_id=inventario.id AND r.farmacia_id=inventario.farmacia_id
    AND ((r.estado='PENDIENTE' AND r.respuesta_expira_en<=now()) OR (r.estado='CONFIRMADA' AND r.recogida_expira_en<=now()))));
