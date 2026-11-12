-- EXC-01/ROL-01: a narrowly scoped local worker membership operation.
-- The definer is the migration owner; f01_runtime never owns tables or bypasses RLS.
-- This helper is boolean only and checks a live opaque session, active local
-- membership, explicit delegation and the transaction-local pharmacy context.
CREATE FUNCTION f01.can_manage_local_worker(scope_id uuid, target_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, f01
AS $policy$
  SELECT
    scope_id::text = NULLIF(current_setting('app.farmacia_id', true), '')
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
        AND u.estado='ACTIVO'
        AND m.estado='ACTIVA' AND m.rol IN ('DUENO','ADMINISTRADOR')
        AND f.estado='ACTIVA'
        AND d.capacidad='membership.manage' AND d.estado='ACTIVA'
        AND (target_user_id IS NULL OR target_user_id<>u.id)
    );
$policy$;

REVOKE ALL ON FUNCTION f01.can_manage_local_worker(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION f01.can_manage_local_worker(uuid,uuid) TO f01_runtime;

-- SELECT is needed for a minimal local worker list and UPDATE ... RETURNING.
CREATE POLICY usuario_farmacia_trabajador_local_lectura ON f01.usuario_farmacia
  FOR SELECT TO f01_runtime
  USING (rol='TRABAJADOR' AND f01.can_manage_local_worker(farmacia_id,usuario_id));

GRANT INSERT (usuario_id,farmacia_id,rol,estado,changed_by_usuario_id)
  ON f01.usuario_farmacia TO f01_runtime;
CREATE POLICY usuario_farmacia_trabajador_local_alta ON f01.usuario_farmacia
  FOR INSERT TO f01_runtime
  WITH CHECK (
    rol='TRABAJADOR' AND estado='ACTIVA'
    AND changed_by_usuario_id=NULLIF(current_setting('app.actor_user_id',true),'')::uuid
    AND f01.can_manage_local_worker(farmacia_id,usuario_id)
  );

GRANT UPDATE (estado,changed_by_usuario_id,updated_at)
  ON f01.usuario_farmacia TO f01_runtime;
CREATE POLICY usuario_farmacia_trabajador_local_revocacion ON f01.usuario_farmacia
  FOR UPDATE TO f01_runtime
  USING (
    rol='TRABAJADOR' AND estado='ACTIVA'
    AND f01.can_manage_local_worker(farmacia_id,usuario_id)
  )
  WITH CHECK (
    rol='TRABAJADOR' AND estado='REVOCADA'
    AND changed_by_usuario_id=NULLIF(current_setting('app.actor_user_id',true),'')::uuid
    AND f01.can_manage_local_worker(farmacia_id,usuario_id)
  );

-- Audit append is permitted only in the same authorized tenant transaction.
GRANT INSERT (actor_usuario_id,farmacia_id,accion,recurso_tipo,resultado,occurred_at,correlation_id)
  ON f01.auditoria_acceso TO f01_runtime;
CREATE POLICY auditoria_trabajador_local_alta ON f01.auditoria_acceso
  FOR INSERT TO f01_runtime
  WITH CHECK (
    actor_usuario_id=NULLIF(current_setting('app.actor_user_id',true),'')::uuid
    AND farmacia_id::text=NULLIF(current_setting('app.farmacia_id',true),'')
    AND f01.can_manage_local_worker(farmacia_id,NULL)
    AND accion IN ('MEMBERSHIP_GRANT','MEMBERSHIP_REVOKE')
    AND recurso_tipo='MEMBERSHIP' AND resultado='PERMITIDO'
  );
