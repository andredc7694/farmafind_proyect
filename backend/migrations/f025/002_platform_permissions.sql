-- F02.5 capability grants are separate from the closed F01 GLO-01 catalog.
-- This migration creates no privileged accounts and makes no grants to a user.
DO $roles$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='f025_policy') THEN
    CREATE ROLE f025_policy NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='f025_activation_executor') THEN
    CREATE ROLE f025_activation_executor NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname IN ('f025_policy','f025_activation_executor')
             AND (rolsuper OR rolbypassrls OR rolcanlogin OR rolcreatedb OR rolcreaterole OR rolreplication)) THEN
    RAISE EXCEPTION 'F02.5: rol interno con privilegios indebidos';
  END IF;
END;
$roles$;

GRANT USAGE ON SCHEMA f025 TO f01_runtime, f025_policy, f025_activation_executor;
GRANT USAGE ON SCHEMA f01 TO f025_policy;
-- Needed only while assigning ownership of scoped SECURITY DEFINER functions.
GRANT CREATE ON SCHEMA f025 TO f025_policy, f025_activation_executor;

CREATE TABLE f025.platform_capability_grant (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL REFERENCES f01.usuario(id) ON DELETE RESTRICT,
  capability_code text NOT NULL CHECK (capability_code IN (
    'F025_APPLICATION_READ', 'F025_APPLICATION_REVIEW', 'F025_DOCUMENT_READ',
    'F025_APPLICATION_DECIDE', 'F025_PHARMACY_ACTIVATE'
  )),
  estado text NOT NULL DEFAULT 'ACTIVA' CHECK (estado IN ('ACTIVA','REVOCADA')),
  approval_id uuid NOT NULL,
  approval_sha256 text NOT NULL CHECK (approval_sha256 ~ '^[a-f0-9]{64}$'),
  reason text NOT NULL CHECK (char_length(btrim(reason)) BETWEEN 8 AND 500),
  granted_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  CONSTRAINT capability_grant_revocation_consistent CHECK (
    (estado='ACTIVA' AND revoked_at IS NULL) OR
    (estado='REVOCADA' AND revoked_at IS NOT NULL)
  ),
  CONSTRAINT capability_grant_approval_unique UNIQUE (approval_id, capability_code)
);
CREATE UNIQUE INDEX capability_grant_active_unique
  ON f025.platform_capability_grant(actor_id, capability_code) WHERE estado='ACTIVA';
CREATE INDEX capability_grant_actor_idx
  ON f025.platform_capability_grant(actor_id, estado, capability_code);

REVOKE ALL ON f025.platform_capability_grant FROM PUBLIC;
-- No runtime mutation grant: provision/revoke only through an offline TEST-only procedure.
GRANT SELECT (actor_id, capability_code, estado) ON f025.platform_capability_grant TO f025_policy;
GRANT SELECT (usuario_id, role_code, estado) ON f01.platform_role_assignment TO f025_policy;
GRANT SELECT (id, estado) ON f01.usuario TO f025_policy;
GRANT SELECT (usuario_id, token_fingerprint, estado, idle_expires_at, absolute_expires_at)
  ON f01.sesion TO f025_policy;
