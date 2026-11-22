DO $role$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'f01_runtime') THEN
    CREATE ROLE f01_runtime NOLOGIN NOSUPERUSER NOBYPASSRLS;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'f01_runtime' AND (rolsuper OR rolbypassrls OR rolcanlogin)) THEN
    RAISE EXCEPTION 'f01_runtime debe ser NOLOGIN NOSUPERUSER NOBYPASSRLS';
  END IF;
END;
$role$;

REVOKE ALL ON SCHEMA f01 FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA f01 FROM PUBLIC;
GRANT USAGE ON SCHEMA f01 TO f01_runtime;

-- Global authentication data is not a pharmacy tenant. No public role receives these grants.
GRANT SELECT (id, email_canonico, password_hash, estado) ON f01.usuario TO f01_runtime;
GRANT SELECT, INSERT, UPDATE ON f01.sesion TO f01_runtime;
GRANT SELECT (id, estado, nombre_publico) ON f01.farmacia_referencia TO f01_runtime;
GRANT SELECT ON f01.usuario_farmacia TO f01_runtime;

ALTER TABLE f01.usuario_farmacia ENABLE ROW LEVEL SECURITY;
ALTER TABLE f01.usuario_farmacia FORCE ROW LEVEL SECURITY;
CREATE POLICY usuario_farmacia_propia_lectura ON f01.usuario_farmacia
  FOR SELECT TO f01_runtime
  USING (usuario_id = NULLIF(current_setting('app.actor_user_id', true), '')::uuid);

-- Until later approved migrations, both tables are inaccessible to the runtime role.
ALTER TABLE f01.delegacion ENABLE ROW LEVEL SECURITY;
ALTER TABLE f01.delegacion FORCE ROW LEVEL SECURITY;
ALTER TABLE f01.auditoria_acceso ENABLE ROW LEVEL SECURITY;
ALTER TABLE f01.auditoria_acceso FORCE ROW LEVEL SECURITY;
