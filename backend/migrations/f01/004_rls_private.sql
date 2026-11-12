-- Additive hardening: previous migrations remain immutable for databases that
-- already applied them. Auth writes need a separately approved role later.
REVOKE SELECT (email_canonico, password_hash) ON f01.usuario FROM f01_runtime;
REVOKE ALL ON f01.sesion FROM f01_runtime;
GRANT SELECT (usuario_id, token_fingerprint, estado, idle_expires_at, absolute_expires_at)
  ON f01.sesion TO f01_runtime;

ALTER TABLE f01.sesion ENABLE ROW LEVEL SECURITY;
ALTER TABLE f01.sesion FORCE ROW LEVEL SECURITY;
CREATE POLICY sesion_por_huella_actual ON f01.sesion
  FOR SELECT TO f01_runtime
  USING (token_fingerprint = decode(NULLIF(current_setting('app.session_fingerprint', true), ''), 'hex'));

-- A person may read only active delegations on their own active membership.
-- This does not grant any delegated mutation, approval or cross-tenant access.
GRANT SELECT ON f01.delegacion TO f01_runtime;
CREATE POLICY delegacion_propia_lectura ON f01.delegacion
  FOR SELECT TO f01_runtime
  USING (EXISTS (
    SELECT 1 FROM f01.usuario_farmacia AS m
    JOIN f01.farmacia_referencia AS f ON f.id=m.farmacia_id
    WHERE m.id=delegacion.membresia_id
      AND m.usuario_id=NULLIF(current_setting('app.actor_user_id', true), '')::uuid
      AND m.estado='ACTIVA' AND f.estado='ACTIVA'
  ));

-- Audit remains closed to the business role pending a scoped writer design.
