-- F01.1 (specs/014-f011-identidad-personal): identidad y personal de farmacia.
-- Migración aditiva. Solo para bases TEST efímeras o fixtures marcados hasta nueva aprobación.
-- Ningún rol obtiene BYPASSRLS; las tablas nuevas usan ENABLE y FORCE ROW LEVEL SECURITY.

-- ---------------------------------------------------------------------------
-- usuario: alias interno y correo opcional (al menos un identificador).
-- ---------------------------------------------------------------------------
ALTER TABLE f01.usuario ALTER COLUMN email_canonico DROP NOT NULL;
ALTER TABLE f01.usuario
  ADD COLUMN alias_canonico text,
  ADD COLUMN email_verificado_at timestamptz;
ALTER TABLE f01.usuario
  ADD CONSTRAINT usuario_alias_formato CHECK (
    alias_canonico IS NULL OR alias_canonico ~ '^[a-z0-9][a-z0-9._-]{2,39}$'),
  ADD CONSTRAINT usuario_identificador CHECK (
    email_canonico IS NOT NULL OR alias_canonico IS NOT NULL);
CREATE UNIQUE INDEX usuario_alias_unico ON f01.usuario(alias_canonico) WHERE alias_canonico IS NOT NULL;

GRANT SELECT (alias_canonico, email_verificado_at) ON f01.usuario TO f01_auth;

-- ---------------------------------------------------------------------------
-- sesion: sesión restringida (cambio de clave / segundo factor pendiente).
-- ---------------------------------------------------------------------------
ALTER TABLE f01.sesion
  ADD COLUMN restringida_motivo text
    CHECK (restringida_motivo IS NULL OR restringida_motivo IN ('CAMBIO_CLAVE', 'MFA_PENDIENTE')),
  ADD COLUMN mfa_verificada_at timestamptz;
GRANT UPDATE (restringida_motivo, mfa_verificada_at) ON f01.sesion TO f01_auth;
-- El runtime solo lee columnas concretas de sesion (004): añade las nuevas para bloquear sesiones restringidas.
GRANT SELECT (restringida_motivo, mfa_verificada_at) ON f01.sesion TO f01_runtime;

-- ---------------------------------------------------------------------------
-- abuse_attempt: nuevos ámbitos (HMAC; sin correo ni IP en claro).
-- ---------------------------------------------------------------------------
ALTER TABLE f01.abuse_attempt DROP CONSTRAINT abuse_attempt_scope_check;
ALTER TABLE f01.abuse_attempt ADD CONSTRAINT abuse_attempt_scope_check CHECK (scope IN (
  'LOGIN_ACCOUNT', 'LOGIN_IP', 'REGISTER_IP',
  'TEMP_KEY_ACCOUNT', 'RESET_ACCOUNT', 'RESET_IP', 'TOTP_ACCOUNT', 'STAFF_CREATE_IP'));

-- ---------------------------------------------------------------------------
-- credencial_temporal: una por usuario; clave de un solo uso con vigencia de 24 h.
-- ---------------------------------------------------------------------------
CREATE TABLE f01.credencial_temporal (
  usuario_id uuid PRIMARY KEY REFERENCES f01.usuario(id) ON DELETE RESTRICT,
  clave_hash text NOT NULL CHECK (clave_hash LIKE '$argon2id$%'),
  farmacia_id uuid NOT NULL REFERENCES f01.farmacia_referencia(id) ON DELETE RESTRICT,
  emitida_por_usuario_id uuid NOT NULL REFERENCES f01.usuario(id) ON DELETE RESTRICT,
  motivo text NOT NULL CHECK (motivo IN ('ALTA', 'RECUPERACION')),
  emitida_at timestamptz NOT NULL DEFAULT now(),
  expira_at timestamptz NOT NULL,
  consumida_at timestamptz,
  CONSTRAINT credencial_temporal_vigencia CHECK (
    expira_at > emitida_at AND expira_at <= emitida_at + interval '24 hours')
);
ALTER TABLE f01.credencial_temporal ENABLE ROW LEVEL SECURITY;
ALTER TABLE f01.credencial_temporal FORCE ROW LEVEL SECURITY;
GRANT SELECT (usuario_id, clave_hash, farmacia_id, expira_at, consumida_at) ON f01.credencial_temporal TO f01_auth;
GRANT UPDATE (consumida_at) ON f01.credencial_temporal TO f01_auth;
CREATE POLICY credencial_auth_lectura ON f01.credencial_temporal
  FOR SELECT TO f01_auth
  USING (usuario_id = NULLIF(current_setting('app.auth_user_id', true), '')::uuid);
CREATE POLICY credencial_auth_consumo ON f01.credencial_temporal
  FOR UPDATE TO f01_auth
  USING (usuario_id = NULLIF(current_setting('app.auth_user_id', true), '')::uuid)
  WITH CHECK (usuario_id = NULLIF(current_setting('app.auth_user_id', true), '')::uuid);

-- ---------------------------------------------------------------------------
-- invitacion_personal: vinculación de una cuenta existente, solo al aceptar.
-- ---------------------------------------------------------------------------
CREATE TABLE f01.invitacion_personal (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farmacia_id uuid NOT NULL REFERENCES f01.farmacia_referencia(id) ON DELETE RESTRICT,
  usuario_destino_id uuid NOT NULL REFERENCES f01.usuario(id) ON DELETE RESTRICT,
  invitado_por_usuario_id uuid NOT NULL REFERENCES f01.usuario(id) ON DELETE RESTRICT,
  rol text NOT NULL DEFAULT 'TRABAJADOR' CHECK (rol = 'TRABAJADOR'),
  estado text NOT NULL DEFAULT 'PENDIENTE'
    CHECK (estado IN ('PENDIENTE', 'ACEPTADA', 'RECHAZADA', 'VENCIDA', 'REVOCADA')),
  creada_at timestamptz NOT NULL DEFAULT now(),
  expira_at timestamptz NOT NULL,
  resuelta_at timestamptz,
  CONSTRAINT invitacion_vigencia CHECK (expira_at > creada_at AND expira_at <= creada_at + interval '7 days'),
  CONSTRAINT invitacion_no_autoinvitacion CHECK (usuario_destino_id <> invitado_por_usuario_id)
);
CREATE UNIQUE INDEX invitacion_pendiente_unica
  ON f01.invitacion_personal(farmacia_id, usuario_destino_id) WHERE estado = 'PENDIENTE';
CREATE INDEX invitacion_destino_estado_idx ON f01.invitacion_personal(usuario_destino_id, estado);
ALTER TABLE f01.invitacion_personal ENABLE ROW LEVEL SECURITY;
ALTER TABLE f01.invitacion_personal FORCE ROW LEVEL SECURITY;
GRANT SELECT ON f01.invitacion_personal TO f01_runtime;
GRANT INSERT (farmacia_id, usuario_destino_id, invitado_por_usuario_id, rol, expira_at)
  ON f01.invitacion_personal TO f01_runtime;
GRANT UPDATE (estado, resuelta_at) ON f01.invitacion_personal TO f01_runtime;
CREATE POLICY invitacion_gestor_lectura ON f01.invitacion_personal
  FOR SELECT TO f01_runtime
  USING (farmacia_id::text = NULLIF(current_setting('app.farmacia_id', true), '')
         AND f01.can_manage_local_worker(farmacia_id, NULL));
CREATE POLICY invitacion_destino_lectura ON f01.invitacion_personal
  FOR SELECT TO f01_runtime
  USING (usuario_destino_id = NULLIF(current_setting('app.actor_user_id', true), '')::uuid);
CREATE POLICY invitacion_gestor_alta ON f01.invitacion_personal
  FOR INSERT TO f01_runtime
  WITH CHECK (rol = 'TRABAJADOR' AND estado = 'PENDIENTE'
    AND invitado_por_usuario_id = NULLIF(current_setting('app.actor_user_id', true), '')::uuid
    AND farmacia_id::text = NULLIF(current_setting('app.farmacia_id', true), '')
    AND f01.can_manage_local_worker(farmacia_id, usuario_destino_id));
CREATE POLICY invitacion_gestor_revocacion ON f01.invitacion_personal
  FOR UPDATE TO f01_runtime
  USING (estado = 'PENDIENTE'
    AND farmacia_id::text = NULLIF(current_setting('app.farmacia_id', true), '')
    AND f01.can_manage_local_worker(farmacia_id, NULL))
  WITH CHECK (estado = 'REVOCADA'
    AND farmacia_id::text = NULLIF(current_setting('app.farmacia_id', true), ''));
CREATE POLICY invitacion_destino_respuesta ON f01.invitacion_personal
  FOR UPDATE TO f01_runtime
  USING (estado = 'PENDIENTE' AND expira_at > now()
    AND usuario_destino_id = NULLIF(current_setting('app.actor_user_id', true), '')::uuid)
  WITH CHECK (estado IN ('ACEPTADA', 'RECHAZADA')
    AND usuario_destino_id = NULLIF(current_setting('app.actor_user_id', true), '')::uuid);

-- ---------------------------------------------------------------------------
-- token_cuenta: verificación de correo y restablecimiento; solo se guarda el hash.
-- ---------------------------------------------------------------------------
CREATE TABLE f01.token_cuenta (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES f01.usuario(id) ON DELETE RESTRICT,
  proposito text NOT NULL CHECK (proposito IN ('VERIFICAR_CORREO', 'RESTABLECER_CLAVE', 'CAMBIO_CORREO')),
  token_hash bytea NOT NULL UNIQUE CHECK (octet_length(token_hash) = 32),
  correo_destino text CHECK (correo_destino IS NULL OR correo_destino = lower(btrim(correo_destino))),
  creado_at timestamptz NOT NULL DEFAULT now(),
  expira_at timestamptz NOT NULL,
  usado_at timestamptz,
  CONSTRAINT token_cuenta_vigencia CHECK (expira_at > creado_at AND expira_at <= creado_at + interval '24 hours')
);
CREATE INDEX token_cuenta_usuario_idx ON f01.token_cuenta(usuario_id, proposito);
ALTER TABLE f01.token_cuenta ENABLE ROW LEVEL SECURITY;
ALTER TABLE f01.token_cuenta FORCE ROW LEVEL SECURITY;
GRANT SELECT (id, usuario_id, proposito, token_hash, correo_destino, expira_at, usado_at) ON f01.token_cuenta TO f01_auth;
GRANT INSERT (usuario_id, proposito, token_hash, correo_destino, expira_at) ON f01.token_cuenta TO f01_auth;
GRANT UPDATE (usado_at) ON f01.token_cuenta TO f01_auth;
-- Consulta por hash del token presentado o por la cuenta del contexto de autenticación.
CREATE POLICY token_auth_lectura ON f01.token_cuenta
  FOR SELECT TO f01_auth
  USING (token_hash = decode(NULLIF(current_setting('app.auth_token_hash', true), ''), 'hex')
         OR usuario_id = NULLIF(current_setting('app.auth_user_id', true), '')::uuid);
CREATE POLICY token_auth_alta ON f01.token_cuenta
  FOR INSERT TO f01_auth
  WITH CHECK (usuario_id = NULLIF(current_setting('app.auth_user_id', true), '')::uuid);
CREATE POLICY token_auth_uso ON f01.token_cuenta
  FOR UPDATE TO f01_auth
  USING (usado_at IS NULL AND (token_hash = decode(NULLIF(current_setting('app.auth_token_hash', true), ''), 'hex')
         OR usuario_id = NULLIF(current_setting('app.auth_user_id', true), '')::uuid))
  WITH CHECK (usado_at IS NOT NULL);

-- ---------------------------------------------------------------------------
-- mfa_totp: secreto cifrado (AES-256-GCM en la aplicación); solo administradores generales.
-- ---------------------------------------------------------------------------
CREATE TABLE f01.mfa_totp (
  usuario_id uuid PRIMARY KEY REFERENCES f01.usuario(id) ON DELETE RESTRICT,
  secreto_cifrado bytea NOT NULL,
  nonce bytea NOT NULL CHECK (octet_length(nonce) = 12),
  estado text NOT NULL DEFAULT 'PENDIENTE' CHECK (estado IN ('PENDIENTE', 'ACTIVO', 'REINICIADO')),
  ultimo_paso_usado bigint,
  activado_at timestamptz,
  creado_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE f01.mfa_totp ENABLE ROW LEVEL SECURITY;
ALTER TABLE f01.mfa_totp FORCE ROW LEVEL SECURITY;
GRANT SELECT, INSERT (usuario_id, secreto_cifrado, nonce, estado) ON f01.mfa_totp TO f01_auth;
GRANT UPDATE (estado, ultimo_paso_usado, activado_at) ON f01.mfa_totp TO f01_auth;
CREATE POLICY mfa_auth_lectura ON f01.mfa_totp FOR SELECT TO f01_auth
  USING (usuario_id = NULLIF(current_setting('app.auth_user_id', true), '')::uuid);
CREATE POLICY mfa_auth_alta ON f01.mfa_totp FOR INSERT TO f01_auth
  WITH CHECK (usuario_id = NULLIF(current_setting('app.auth_user_id', true), '')::uuid AND estado = 'PENDIENTE');
CREATE POLICY mfa_auth_cambio ON f01.mfa_totp FOR UPDATE TO f01_auth
  USING (usuario_id = NULLIF(current_setting('app.auth_user_id', true), '')::uuid)
  WITH CHECK (usuario_id = NULLIF(current_setting('app.auth_user_id', true), '')::uuid);

-- ---------------------------------------------------------------------------
-- perfil_usuario: datos y preferencias propias; nunca roles ni permisos.
-- ---------------------------------------------------------------------------
CREATE TABLE f01.perfil_usuario (
  usuario_id uuid PRIMARY KEY REFERENCES f01.usuario(id) ON DELETE RESTRICT,
  nombre text CHECK (nombre IS NULL OR char_length(btrim(nombre)) BETWEEN 1 AND 120),
  telefono text CHECK (telefono IS NULL OR telefono ~ '^\+?[0-9 ()-]{6,20}$'),
  avatar_preset smallint CHECK (avatar_preset IS NULL OR avatar_preset BETWEEN 1 AND 12),
  tema text NOT NULL DEFAULT 'SISTEMA' CHECK (tema IN ('CLARO', 'OSCURO', 'SISTEMA')),
  notif_reservas boolean NOT NULL DEFAULT true,
  notif_seguridad boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE f01.perfil_usuario ENABLE ROW LEVEL SECURITY;
ALTER TABLE f01.perfil_usuario FORCE ROW LEVEL SECURITY;
GRANT SELECT ON f01.perfil_usuario TO f01_runtime;
GRANT INSERT (usuario_id, nombre) ON f01.perfil_usuario TO f01_runtime;
GRANT UPDATE (nombre, telefono, avatar_preset, tema, notif_reservas, notif_seguridad, updated_at)
  ON f01.perfil_usuario TO f01_runtime;
CREATE POLICY perfil_propio_lectura ON f01.perfil_usuario FOR SELECT TO f01_runtime
  USING (usuario_id = NULLIF(current_setting('app.actor_user_id', true), '')::uuid);
CREATE POLICY perfil_propio_alta ON f01.perfil_usuario FOR INSERT TO f01_runtime
  WITH CHECK (usuario_id = NULLIF(current_setting('app.actor_user_id', true), '')::uuid);
CREATE POLICY perfil_propio_cambio ON f01.perfil_usuario FOR UPDATE TO f01_runtime
  USING (usuario_id = NULLIF(current_setting('app.actor_user_id', true), '')::uuid)
  WITH CHECK (usuario_id = NULLIF(current_setting('app.actor_user_id', true), '')::uuid);

-- ---------------------------------------------------------------------------
-- auditoria_identidad: catálogo cerrado, solo inserción, sin secretos.
-- ---------------------------------------------------------------------------
CREATE TABLE f01.auditoria_identidad (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_usuario_id uuid REFERENCES f01.usuario(id) ON DELETE RESTRICT,
  objetivo_usuario_id uuid REFERENCES f01.usuario(id) ON DELETE RESTRICT,
  farmacia_id uuid REFERENCES f01.farmacia_referencia(id) ON DELETE RESTRICT,
  accion text NOT NULL CHECK (accion IN (
    'STAFF_CREATE', 'TEMP_KEY_ISSUE', 'TEMP_KEY_CONSUME', 'INVITE_CREATE', 'INVITE_ACCEPT', 'INVITE_DECLINE',
    'INVITE_REVOKE', 'CAPABILITY_GRANT', 'CAPABILITY_REVOKE', 'MEMBERSHIP_REVOKE', 'PASSWORD_CHANGE',
    'PASSWORD_RESET', 'EMAIL_VERIFY', 'EMAIL_CHANGE', 'MFA_ENROLL', 'MFA_VERIFY', 'MFA_RESET',
    'SESSION_REVOKE', 'ELEVATION_DENIED')),
  resultado text NOT NULL CHECK (resultado IN ('PERMITIDO', 'DENEGADO')),
  ocurrido_at timestamptz NOT NULL DEFAULT now(),
  correlation_id uuid NOT NULL
);
CREATE INDEX auditoria_identidad_farmacia_idx ON f01.auditoria_identidad(farmacia_id, ocurrido_at DESC);
CREATE INDEX auditoria_identidad_actor_idx ON f01.auditoria_identidad(actor_usuario_id, ocurrido_at DESC);
ALTER TABLE f01.auditoria_identidad ENABLE ROW LEVEL SECURITY;
ALTER TABLE f01.auditoria_identidad FORCE ROW LEVEL SECURITY;
GRANT SELECT ON f01.auditoria_identidad TO f01_runtime;
GRANT INSERT (actor_usuario_id, objetivo_usuario_id, farmacia_id, accion, resultado, ocurrido_at, correlation_id)
  ON f01.auditoria_identidad TO f01_runtime, f01_auth;
-- Sin UPDATE ni DELETE para ningún rol de aplicación.
CREATE POLICY auditoria_identidad_runtime_alta ON f01.auditoria_identidad
  FOR INSERT TO f01_runtime
  WITH CHECK (actor_usuario_id = NULLIF(current_setting('app.actor_user_id', true), '')::uuid
    AND (farmacia_id IS NULL OR farmacia_id::text = NULLIF(current_setting('app.farmacia_id', true), '')));
CREATE POLICY auditoria_identidad_auth_alta ON f01.auditoria_identidad
  FOR INSERT TO f01_auth
  WITH CHECK (farmacia_id IS NULL AND accion IN (
    'TEMP_KEY_CONSUME', 'PASSWORD_CHANGE', 'PASSWORD_RESET', 'EMAIL_VERIFY', 'MFA_ENROLL', 'MFA_VERIFY',
    'SESSION_REVOKE', 'ELEVATION_DENIED'));
CREATE POLICY auditoria_identidad_gestor_lectura ON f01.auditoria_identidad
  FOR SELECT TO f01_runtime
  USING (farmacia_id IS NOT NULL
    AND farmacia_id::text = NULLIF(current_setting('app.farmacia_id', true), '')
    AND f01.can_manage_local_worker(farmacia_id, NULL));
CREATE POLICY auditoria_identidad_propia_lectura ON f01.auditoria_identidad
  FOR SELECT TO f01_runtime
  USING (actor_usuario_id = NULLIF(current_setting('app.actor_user_id', true), '')::uuid);
