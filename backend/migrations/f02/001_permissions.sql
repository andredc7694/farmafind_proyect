-- F02 only adds tenant-scoped inventory authority. No global grant route or BOOT-01.
CREATE SCHEMA IF NOT EXISTS f02;
REVOKE ALL ON SCHEMA f02 FROM PUBLIC;
GRANT USAGE ON SCHEMA f02 TO f01_runtime;

CREATE FUNCTION f02.can_inventory_action(scope_id uuid, requested_capability text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, f01, f02
AS $policy$
  SELECT
    scope_id::text = NULLIF(current_setting('app.farmacia_id', true), '')
    AND requested_capability IN (
      'inventory.read', 'inventory.write', 'inventory.import.preview',
      'inventory.import.confirm', 'inventory.history'
    )
    AND EXISTS (
      SELECT 1
      FROM f01.sesion AS s
      JOIN f01.usuario AS u ON u.id=s.usuario_id
      JOIN f01.usuario_farmacia AS m ON m.usuario_id=u.id AND m.farmacia_id=scope_id
      JOIN f01.farmacia_referencia AS f ON f.id=m.farmacia_id
      JOIN f01.delegacion AS d ON d.membresia_id=m.id AND d.farmacia_id=scope_id
      WHERE s.token_fingerprint=decode(NULLIF(current_setting('app.session_fingerprint',true),''),'hex')
        AND s.usuario_id=NULLIF(current_setting('app.actor_user_id',true),'')::uuid
        AND s.estado='VIGENTE' AND s.idle_expires_at>now() AND s.absolute_expires_at>now()
        AND u.estado='ACTIVO' AND m.estado='ACTIVA' AND f.estado='ACTIVA'
        AND m.rol IN ('DUENO','ADMINISTRADOR')
        AND d.capacidad=requested_capability AND d.estado='ACTIVA'
    );
$policy$;

REVOKE ALL ON FUNCTION f02.can_inventory_action(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION f02.can_inventory_action(uuid,text) TO f01_runtime;
