REVOKE ALL ON SCHEMA f04 FROM PUBLIC;
GRANT USAGE ON SCHEMA f04 TO f01_runtime;

CREATE OR REPLACE FUNCTION f04.can_reservation_action(scope_id uuid, requested_capability text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,f01,f04 AS $policy$
  SELECT scope_id::text=NULLIF(current_setting('app.farmacia_id',true),'')
    AND requested_capability IN ('reservation.read','reservation.accept','reservation.deliver','reservation.settings')
    AND EXISTS (
      SELECT 1 FROM f01.sesion s
      JOIN f01.usuario u ON u.id=s.usuario_id
      JOIN f01.usuario_farmacia m ON m.usuario_id=u.id AND m.farmacia_id=scope_id
      JOIN f01.farmacia_referencia f ON f.id=m.farmacia_id
      JOIN f01.delegacion d ON d.membresia_id=m.id AND d.farmacia_id=scope_id
      WHERE s.token_fingerprint=decode(NULLIF(current_setting('app.session_fingerprint',true),''),'hex')
        AND s.usuario_id=NULLIF(current_setting('app.actor_user_id',true),'')::uuid
        AND s.estado='VIGENTE' AND s.idle_expires_at>now() AND s.absolute_expires_at>now()
        AND u.estado='ACTIVO' AND m.estado='ACTIVA' AND f.estado='ACTIVA'
        AND m.rol IN ('DUENO','ADMINISTRADOR') AND d.capacidad=requested_capability AND d.estado='ACTIVA'
    );
$policy$;
REVOKE ALL ON FUNCTION f04.can_reservation_action(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION f04.can_reservation_action(uuid,text) TO f01_runtime;

CREATE FUNCTION f04.has_live_actor() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path=pg_catalog,f01 AS $policy$
  SELECT EXISTS(SELECT 1 FROM f01.sesion s JOIN f01.usuario u ON u.id=s.usuario_id
    WHERE s.token_fingerprint=decode(NULLIF(current_setting('app.session_fingerprint',true),''),'hex')
      AND s.usuario_id=NULLIF(current_setting('app.actor_user_id',true),'')::uuid
      AND s.estado='VIGENTE' AND s.idle_expires_at>now() AND s.absolute_expires_at>now() AND u.estado='ACTIVO');
$policy$;
REVOKE ALL ON FUNCTION f04.has_live_actor() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION f04.has_live_actor() TO f01_runtime;
