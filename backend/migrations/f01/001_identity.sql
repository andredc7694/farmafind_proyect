CREATE SCHEMA IF NOT EXISTS f01;

CREATE TABLE f01.usuario (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_canonico text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  estado text NOT NULL DEFAULT 'ACTIVO' CHECK (estado IN ('ACTIVO', 'INACTIVO')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT usuario_email_canonico CHECK (
    email_canonico = lower(btrim(email_canonico))
    AND char_length(email_canonico) BETWEEN 3 AND 320
    AND position('@' IN email_canonico) > 1
  ),
  CONSTRAINT usuario_hash_argon2id CHECK (password_hash LIKE '$argon2id$%')
);

CREATE TABLE f01.sesion (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES f01.usuario(id) ON DELETE RESTRICT,
  token_fingerprint bytea NOT NULL UNIQUE CHECK (octet_length(token_fingerprint) = 32),
  estado text NOT NULL DEFAULT 'VIGENTE' CHECK (estado IN ('VIGENTE', 'EXPIRADA', 'REVOCADA')),
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz NOT NULL DEFAULT now(),
  idle_expires_at timestamptz NOT NULL,
  absolute_expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  CONSTRAINT sesion_vencimientos CHECK (idle_expires_at <= absolute_expires_at AND absolute_expires_at > created_at)
);

CREATE INDEX sesion_usuario_estado_idx ON f01.sesion(usuario_id, estado);
