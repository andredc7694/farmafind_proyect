-- Explicit local capabilities only; no global permission or self-approval path.
CREATE FUNCTION f07.can_location_action(scope_id uuid, requested_capability text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, f01, f07
AS $policy$
  SELECT scope_id::text = NULLIF(current_setting('app.farmacia_id',true),'')
    AND requested_capability IN ('GEO_LOCATION_PROPOSE','GEO_LOCATION_REVIEW')
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
        AND d.capacidad=requested_capability AND d.estado='ACTIVA'
    );
$policy$;
REVOKE ALL ON FUNCTION f07.can_location_action(uuid,text) FROM PUBLIC;
GRANT USAGE ON SCHEMA f07 TO f01_runtime;
GRANT EXECUTE ON FUNCTION f07.can_location_action(uuid,text) TO f01_runtime;

ALTER TABLE f07.ubicacion_propuesta ENABLE ROW LEVEL SECURITY;
ALTER TABLE f07.ubicacion_propuesta FORCE ROW LEVEL SECURITY;
ALTER TABLE f07.ubicacion_auditoria ENABLE ROW LEVEL SECURITY;
ALTER TABLE f07.ubicacion_auditoria FORCE ROW LEVEL SECURITY;
REVOKE ALL ON f07.ubicacion_propuesta,f07.ubicacion_auditoria FROM PUBLIC;

GRANT SELECT ON f07.ubicacion_propuesta,f07.ubicacion_auditoria TO f01_runtime;
GRANT INSERT (farmacia_id,direccion_publicable,ciudad,latitud,longitud,precision_m,fuente,
  evidencia_referencia,propuesta_por) ON f07.ubicacion_propuesta TO f01_runtime;
GRANT UPDATE (estado,revisada_por,revisada_at,version) ON f07.ubicacion_propuesta TO f01_runtime;
GRANT INSERT (farmacia_id,propuesta_id,actor_usuario_id,accion) ON f07.ubicacion_auditoria TO f01_runtime;

CREATE POLICY ubicacion_propuesta_lectura ON f07.ubicacion_propuesta
  FOR SELECT TO f01_runtime USING (
    f07.can_location_action(farmacia_id,'GEO_LOCATION_PROPOSE') OR
    f07.can_location_action(farmacia_id,'GEO_LOCATION_REVIEW'));
CREATE POLICY ubicacion_propuesta_alta ON f07.ubicacion_propuesta
  FOR INSERT TO f01_runtime WITH CHECK (
    propuesta_por=NULLIF(current_setting('app.actor_user_id',true),'')::uuid
    AND f07.can_location_action(farmacia_id,'GEO_LOCATION_PROPOSE'));
CREATE POLICY ubicacion_propuesta_revision ON f07.ubicacion_propuesta
  FOR UPDATE TO f01_runtime
  USING (estado='PENDIENTE' AND propuesta_por<>NULLIF(current_setting('app.actor_user_id',true),'')::uuid
    AND f07.can_location_action(farmacia_id,'GEO_LOCATION_REVIEW'))
  WITH CHECK (estado IN ('PUBLICADA_VERIFICADA','RECHAZADA')
    AND revisada_por=NULLIF(current_setting('app.actor_user_id',true),'')::uuid
    AND propuesta_por<>revisada_por
    AND f07.can_location_action(farmacia_id,'GEO_LOCATION_REVIEW'));
CREATE POLICY ubicacion_auditoria_lectura ON f07.ubicacion_auditoria
  FOR SELECT TO f01_runtime USING (
    f07.can_location_action(farmacia_id,'GEO_LOCATION_PROPOSE') OR
    f07.can_location_action(farmacia_id,'GEO_LOCATION_REVIEW'));
CREATE POLICY ubicacion_auditoria_alta ON f07.ubicacion_auditoria
  FOR INSERT TO f01_runtime WITH CHECK (
    actor_usuario_id=NULLIF(current_setting('app.actor_user_id',true),'')::uuid
    AND ((accion='PROPUESTA' AND f07.can_location_action(farmacia_id,'GEO_LOCATION_PROPOSE')) OR
         (accion IN ('APROBACION','RECHAZO') AND f07.can_location_action(farmacia_id,'GEO_LOCATION_REVIEW'))));
