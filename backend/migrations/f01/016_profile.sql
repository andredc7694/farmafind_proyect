-- F01.1 US5 (T044–T047): perfil y seguridad personal (F011-FR-013/014).
-- Todas las operaciones son del PROPIO usuario, derivado de la sesión vigente y sin restricción (app.auth_fingerprint);
-- ninguna función recibe un identificador de usuario ni toca roles, membresías o permisos.

-- Reautenticación fallida: presupuesto propio (HMAC, sin datos en claro).
ALTER TABLE f01.abuse_attempt DROP CONSTRAINT abuse_attempt_scope_check;
ALTER TABLE f01.abuse_attempt ADD CONSTRAINT abuse_attempt_scope_check CHECK (scope IN (
  'LOGIN_ACCOUNT', 'LOGIN_IP', 'REGISTER_IP',
  'TEMP_KEY_ACCOUNT', 'RESET_ACCOUNT', 'RESET_IP', 'TOTP_ACCOUNT', 'STAFF_CREATE_IP', 'REAUTH_ACCOUNT'));

-- Usuario de la sesión vigente y sin restricción; NULL si no hay. Solo uso interno de las funciones siguientes.
CREATE FUNCTION f01.own_session_user()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, f01
AS $fn$
  SELECT s.usuario_id
    FROM f01.sesion s JOIN f01.usuario u ON u.id = s.usuario_id
   WHERE s.token_fingerprint = decode(NULLIF(current_setting('app.auth_fingerprint', true), ''), 'hex')
     AND s.estado = 'VIGENTE' AND s.idle_expires_at > now() AND s.absolute_expires_at > now()
     AND s.restringida_motivo IS NULL AND u.estado = 'ACTIVO';
$fn$;
REVOKE ALL ON FUNCTION f01.own_session_user() FROM PUBLIC;

-- ---------------------------------------------------------------------------
-- Perfil propio.
-- ---------------------------------------------------------------------------
CREATE FUNCTION f01.get_own_profile()
RETURNS TABLE(usuario_id uuid, nombre text, telefono text, avatar_preset smallint, tema text,
              notif_reservas boolean, notif_seguridad boolean, email text, email_verificado boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = pg_catalog, f01
AS $fn$
DECLARE
  v_user uuid := f01.own_session_user();
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'No autorizado' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT u.id, p.nombre, p.telefono, p.avatar_preset, COALESCE(p.tema, 'SISTEMA'),
           COALESCE(p.notif_reservas, true), COALESCE(p.notif_seguridad, true),
           u.email_canonico, (u.email_canonico IS NOT NULL AND u.email_verificado_at IS NOT NULL)
      FROM f01.usuario u LEFT JOIN f01.perfil_usuario p ON p.usuario_id = u.id
     WHERE u.id = v_user;
END;
$fn$;

-- Solo estas seis claves; cualquier otra (roles, permisos, estado...) se rechaza.
CREATE FUNCTION f01.update_own_profile(p_patch jsonb)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, f01
AS $fn$
DECLARE
  v_user uuid := f01.own_session_user();
  v_key text;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'No autorizado' USING ERRCODE = '42501';
  END IF;
  IF p_patch IS NULL OR jsonb_typeof(p_patch) <> 'object' OR p_patch = '{}'::jsonb THEN
    RAISE EXCEPTION 'Entrada inválida' USING ERRCODE = '22023';
  END IF;
  FOR v_key IN SELECT jsonb_object_keys(p_patch) LOOP
    IF v_key NOT IN ('displayName', 'phone', 'avatarPreset', 'theme', 'notifyReservations', 'notifySecurity') THEN
      RAISE EXCEPTION 'Campo no editable' USING ERRCODE = '22023';
    END IF;
  END LOOP;
  INSERT INTO f01.perfil_usuario(usuario_id) VALUES (v_user) ON CONFLICT (usuario_id) DO NOTHING;
  UPDATE f01.perfil_usuario SET
    nombre = CASE WHEN p_patch ? 'displayName' THEN NULLIF(btrim(p_patch ->> 'displayName'), '') ELSE nombre END,
    telefono = CASE WHEN p_patch ? 'phone' THEN NULLIF(btrim(p_patch ->> 'phone'), '') ELSE telefono END,
    avatar_preset = CASE WHEN p_patch ? 'avatarPreset' THEN (p_patch ->> 'avatarPreset')::smallint ELSE avatar_preset END,
    tema = CASE WHEN p_patch ? 'theme' THEN p_patch ->> 'theme' ELSE tema END,
    notif_reservas = CASE WHEN p_patch ? 'notifyReservations' THEN (p_patch ->> 'notifyReservations')::boolean ELSE notif_reservas END,
    notif_seguridad = CASE WHEN p_patch ? 'notifySecurity' THEN (p_patch ->> 'notifySecurity')::boolean ELSE notif_seguridad END,
    updated_at = now()
   WHERE usuario_id = v_user;
END;
$fn$;

-- ---------------------------------------------------------------------------
-- Sesiones propias.
-- ---------------------------------------------------------------------------
CREATE FUNCTION f01.list_own_sessions()
RETURNS TABLE(id uuid, created_at timestamptz, last_used_at timestamptz, is_current boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = pg_catalog, f01
AS $fn$
DECLARE
  v_user uuid := f01.own_session_user();
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'No autorizado' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT s.id, s.created_at, s.last_used_at,
           s.token_fingerprint = decode(NULLIF(current_setting('app.auth_fingerprint', true), ''), 'hex')
      FROM f01.sesion s
     WHERE s.usuario_id = v_user AND s.estado = 'VIGENTE'
       AND s.idle_expires_at > now() AND s.absolute_expires_at > now()
     ORDER BY s.created_at DESC, s.id;
END;
$fn$;

-- Cierra una sesión propia. Una sesión ajena o inexistente no se distingue: F0404.
CREATE FUNCTION f01.revoke_own_session(p_session uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, f01
AS $fn$
DECLARE
  v_user uuid := f01.own_session_user();
  v_done uuid;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'No autorizado' USING ERRCODE = '42501';
  END IF;
  UPDATE f01.sesion SET estado = 'REVOCADA', revoked_at = now()
   WHERE id = p_session AND usuario_id = v_user AND estado = 'VIGENTE'
  RETURNING id INTO v_done;
  IF v_done IS NULL THEN
    RAISE EXCEPTION 'No visible' USING ERRCODE = 'F0404';
  END IF;
  INSERT INTO f01.auditoria_identidad(actor_usuario_id, objetivo_usuario_id, accion, resultado, correlation_id)
    VALUES (v_user, v_user, 'SESSION_REVOKE', 'PERMITIDO', gen_random_uuid());
END;
$fn$;

CREATE FUNCTION f01.revoke_other_sessions()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, f01
AS $fn$
DECLARE
  v_user uuid := f01.own_session_user();
  v_count integer;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'No autorizado' USING ERRCODE = '42501';
  END IF;
  UPDATE f01.sesion SET estado = 'REVOCADA', revoked_at = now()
   WHERE usuario_id = v_user AND estado = 'VIGENTE'
     AND token_fingerprint <> decode(NULLIF(current_setting('app.auth_fingerprint', true), ''), 'hex');
  GET DIAGNOSTICS v_count = ROW_COUNT;
  INSERT INTO f01.auditoria_identidad(actor_usuario_id, objetivo_usuario_id, accion, resultado, correlation_id)
    VALUES (v_user, v_user, 'SESSION_REVOKE', 'PERMITIDO', gen_random_uuid());
  RETURN v_count;
END;
$fn$;

-- ---------------------------------------------------------------------------
-- Cambio de clave propio (la aplicación ya verificó la clave actual). Conserva solo la sesión actual.
-- ---------------------------------------------------------------------------
CREATE FUNCTION f01.change_own_password(p_new_hash text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, f01
AS $fn$
DECLARE
  v_user uuid := f01.own_session_user();
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'No autorizado' USING ERRCODE = '42501';
  END IF;
  IF p_new_hash IS NULL OR p_new_hash NOT LIKE '$argon2id$%' THEN
    RAISE EXCEPTION 'Hash inválido' USING ERRCODE = '22023';
  END IF;
  UPDATE f01.usuario SET password_hash = p_new_hash, updated_at = now() WHERE id = v_user;
  UPDATE f01.credencial_temporal SET consumida_at = now() WHERE usuario_id = v_user AND consumida_at IS NULL;
  UPDATE f01.sesion SET estado = 'REVOCADA', revoked_at = now()
   WHERE usuario_id = v_user AND estado = 'VIGENTE'
     AND token_fingerprint <> decode(NULLIF(current_setting('app.auth_fingerprint', true), ''), 'hex');
  INSERT INTO f01.auditoria_identidad(actor_usuario_id, objetivo_usuario_id, accion, resultado, correlation_id)
    VALUES (v_user, v_user, 'PASSWORD_CHANGE', 'PERMITIDO', gen_random_uuid());
END;
$fn$;

-- ---------------------------------------------------------------------------
-- verify_email ahora también confirma un CAMBIO_CORREO: el correo nuevo se activa solo con el token enviado a él.
-- Si otra cuenta lo tomó mientras tanto, devuelve false (sin distinguir).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION f01.verify_email(p_token_hash bytea)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, f01
AS $fn$
DECLARE
  v_token uuid;
  v_user uuid;
  v_purpose text;
  v_target text;
BEGIN
  SELECT t.id, t.usuario_id, t.proposito, t.correo_destino INTO v_token, v_user, v_purpose, v_target
    FROM f01.token_cuenta t JOIN f01.usuario u ON u.id = t.usuario_id
   WHERE t.token_hash = p_token_hash AND t.proposito IN ('VERIFICAR_CORREO', 'CAMBIO_CORREO')
     AND t.usado_at IS NULL AND t.expira_at > now() AND u.estado = 'ACTIVO'
     AND (t.proposito = 'CAMBIO_CORREO' AND t.correo_destino IS NOT NULL
          OR t.proposito = 'VERIFICAR_CORREO' AND u.email_canonico IS NOT NULL)
   FOR UPDATE OF t;
  IF v_token IS NULL THEN RETURN false; END IF;
  IF v_purpose = 'CAMBIO_CORREO' THEN
    BEGIN
      UPDATE f01.usuario SET email_canonico = v_target, email_verificado_at = now(), updated_at = now() WHERE id = v_user;
    EXCEPTION WHEN unique_violation THEN
      RETURN false;
    END;
    UPDATE f01.token_cuenta SET usado_at = now()
     WHERE usuario_id = v_user AND proposito IN ('CAMBIO_CORREO', 'VERIFICAR_CORREO') AND usado_at IS NULL;
    INSERT INTO f01.auditoria_identidad(actor_usuario_id, objetivo_usuario_id, accion, resultado, correlation_id)
      VALUES (v_user, v_user, 'EMAIL_CHANGE', 'PERMITIDO', gen_random_uuid());
    RETURN true;
  END IF;
  UPDATE f01.token_cuenta SET usado_at = now() WHERE id = v_token;
  UPDATE f01.usuario SET email_verificado_at = now(), updated_at = now() WHERE id = v_user;
  INSERT INTO f01.auditoria_identidad(actor_usuario_id, objetivo_usuario_id, accion, resultado, correlation_id)
    VALUES (v_user, v_user, 'EMAIL_VERIFY', 'PERMITIDO', gen_random_uuid());
  RETURN true;
END;
$fn$;

REVOKE ALL ON FUNCTION f01.get_own_profile(), f01.update_own_profile(jsonb), f01.list_own_sessions(),
  f01.revoke_own_session(uuid), f01.revoke_other_sessions(), f01.change_own_password(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION f01.get_own_profile(), f01.update_own_profile(jsonb), f01.list_own_sessions(),
  f01.revoke_own_session(uuid), f01.revoke_other_sessions(), f01.change_own_password(text) TO f01_auth;

-- El rol de autenticación también audita la reautenticación fallida del cambio de correo.
DROP POLICY auditoria_identidad_auth_alta ON f01.auditoria_identidad;
CREATE POLICY auditoria_identidad_auth_alta ON f01.auditoria_identidad
  FOR INSERT TO f01_auth
  WITH CHECK (farmacia_id IS NULL AND accion IN (
    'TEMP_KEY_CONSUME', 'PASSWORD_CHANGE', 'PASSWORD_RESET', 'EMAIL_VERIFY', 'EMAIL_CHANGE', 'MFA_ENROLL', 'MFA_VERIFY',
    'SESSION_REVOKE', 'ELEVATION_DENIED'));
