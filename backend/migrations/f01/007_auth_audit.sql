-- Authentication events have no pharmacy context and cannot read audit rows.
GRANT INSERT (actor_usuario_id,farmacia_id,accion,recurso_tipo,resultado,occurred_at,correlation_id)
  ON f01.auditoria_acceso TO f01_auth;
CREATE POLICY auditoria_auth_alta ON f01.auditoria_acceso
  FOR INSERT TO f01_auth
  WITH CHECK (
    farmacia_id IS NULL AND recurso_tipo='IDENTITY'
    AND accion IN ('REGISTER','LOGIN','LOGOUT')
    AND resultado IN ('PERMITIDO','DENEGADO')
  );
