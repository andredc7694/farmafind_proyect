-- Global identity access is isolated from the tenant runtime role.
DO $role$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='f01_auth') THEN
    CREATE ROLE f01_auth NOLOGIN NOSUPERUSER NOBYPASSRLS;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='f01_auth' AND (rolsuper OR rolbypassrls OR rolcanlogin)) THEN
    RAISE EXCEPTION 'f01_auth debe ser NOLOGIN NOSUPERUSER NOBYPASSRLS';
  END IF;
END;
$role$;

GRANT USAGE ON SCHEMA f01 TO f01_auth;
GRANT SELECT (id,email_canonico,password_hash,estado,created_at,updated_at),
      INSERT (email_canonico,password_hash) ON f01.usuario TO f01_auth;
GRANT SELECT, INSERT ON f01.sesion TO f01_auth;
GRANT UPDATE (estado,revoked_at,last_used_at,idle_expires_at) ON f01.sesion TO f01_auth;

CREATE POLICY sesion_auth_lectura ON f01.sesion
  FOR SELECT TO f01_auth
  USING (token_fingerprint = decode(NULLIF(current_setting('app.auth_fingerprint',true),''),'hex'));
CREATE POLICY sesion_auth_alta ON f01.sesion
  FOR INSERT TO f01_auth
  WITH CHECK (usuario_id = NULLIF(current_setting('app.auth_user_id',true),'')::uuid);
CREATE POLICY sesion_auth_cambio ON f01.sesion
  FOR UPDATE TO f01_auth
  USING (token_fingerprint = decode(NULLIF(current_setting('app.auth_fingerprint',true),''),'hex'))
  WITH CHECK (token_fingerprint = decode(NULLIF(current_setting('app.auth_fingerprint',true),''),'hex'));
