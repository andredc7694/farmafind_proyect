-- Denied own-membership operations are global audit events without a pharmacy id.
ALTER POLICY auditoria_auth_alta ON f01.auditoria_acceso
  WITH CHECK (
    farmacia_id IS NULL AND recurso_tipo='IDENTITY'
    AND accion IN ('REGISTER','LOGIN','LOGOUT','MEMBERSHIP_LIST','PHARMACY_SELECT')
    AND resultado IN ('PERMITIDO','DENEGADO')
  );
