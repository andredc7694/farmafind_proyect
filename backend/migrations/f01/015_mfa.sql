-- F01.1 US4 (T038–T040): segundo factor TOTP para administradores generales (F011-FR-012).
-- La tabla f01.mfa_totp y las columnas de sesión ya existen (011). Aquí: exigencia en el servidor de base de datos
-- para /platform/** y funciones con autorización explícita para las transiciones sensibles.

-- 1) /platform/** exige sesión con segundo factor verificado y sin restricción pendiente.
CREATE OR REPLACE FUNCTION f01.has_platform_permission(required_permission text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, f01
AS $policy$
  SELECT required_permission IN (
      'PLATFORM_USER_READ', 'PLATFORM_USER_STATUS_MANAGE',
      'PLATFORM_GLOBAL_AUTH_READ', 'PLATFORM_GLOBAL_AUTH_MANAGE', 'PLATFORM_AUDIT_READ'
    )
    AND EXISTS (
      SELECT 1
      FROM f01.sesion s
      JOIN f01.usuario u ON u.id=s.usuario_id
      JOIN f01.platform_role_assignment a ON a.usuario_id=u.id AND a.estado='ACTIVA'
      JOIN f01.platform_role_permission p ON p.role_code=a.role_code
      WHERE s.token_fingerprint=decode(NULLIF(current_setting('app.session_fingerprint',true),''),'hex')
        AND s.usuario_id=NULLIF(current_setting('app.actor_user_id',true),'')::uuid
        AND s.estado='VIGENTE' AND s.idle_expires_at>now() AND s.absolute_expires_at>now()
        AND s.mfa_verificada_at IS NOT NULL AND s.restringida_motivo IS NULL
        AND u.estado='ACTIVO' AND p.permission_code=required_permission
    );
$policy$;

-- 2) ¿Qué exige el inicio de sesión de este usuario? (usa solo app.auth_user_id; no sirve para sondear a otros)
CREATE FUNCTION f01.mfa_requirement()
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, f01
AS $fn$
  SELECT CASE
    WHEN NOT EXISTS (SELECT 1 FROM f01.platform_role_assignment a
                     WHERE a.usuario_id = NULLIF(current_setting('app.auth_user_id', true), '')::uuid
                       AND a.estado = 'ACTIVA') THEN 'NONE'
    WHEN EXISTS (SELECT 1 FROM f01.mfa_totp m
                 WHERE m.usuario_id = NULLIF(current_setting('app.auth_user_id', true), '')::uuid
                   AND m.estado = 'ACTIVO') THEN 'VERIFY'
    ELSE 'ENROLL'
  END;
$fn$;

-- 3) Alta del factor: solo administradores generales con sesión sin restricción; reemplaza un alta PENDIENTE o REINICIADA.
CREATE FUNCTION f01.begin_mfa_enrollment(p_cipher bytea, p_nonce bytea)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, f01
AS $fn$
DECLARE
  v_user uuid;
  v_state text;
BEGIN
  SELECT s.usuario_id INTO v_user
    FROM f01.sesion s JOIN f01.usuario u ON u.id = s.usuario_id
   WHERE s.token_fingerprint = decode(NULLIF(current_setting('app.auth_fingerprint', true), ''), 'hex')
     AND s.estado = 'VIGENTE' AND s.idle_expires_at > now() AND s.absolute_expires_at > now()
     AND s.restringida_motivo IS NULL AND u.estado = 'ACTIVO';
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'No autorizado' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM f01.platform_role_assignment a WHERE a.usuario_id = v_user AND a.estado = 'ACTIVA') THEN
    INSERT INTO f01.auditoria_identidad(actor_usuario_id, objetivo_usuario_id, accion, resultado, correlation_id)
      VALUES (v_user, v_user, 'ELEVATION_DENIED', 'DENEGADO', gen_random_uuid());
    RETURN 'FORBIDDEN';
  END IF;
  SELECT m.estado INTO v_state FROM f01.mfa_totp m WHERE m.usuario_id = v_user FOR UPDATE;
  IF v_state = 'ACTIVO' THEN RETURN 'CONFLICT'; END IF;
  INSERT INTO f01.mfa_totp(usuario_id, secreto_cifrado, nonce, estado)
    VALUES (v_user, p_cipher, p_nonce, 'PENDIENTE')
    ON CONFLICT (usuario_id) DO UPDATE
      SET secreto_cifrado = EXCLUDED.secreto_cifrado, nonce = EXCLUDED.nonce, estado = 'PENDIENTE',
          ultimo_paso_usado = NULL, activado_at = NULL, creado_at = now();
  INSERT INTO f01.auditoria_identidad(actor_usuario_id, objetivo_usuario_id, accion, resultado, correlation_id)
    VALUES (v_user, v_user, 'MFA_ENROLL', 'PERMITIDO', gen_random_uuid());
  RETURN 'OK';
END;
$fn$;

-- 4) Cierre de un código ya validado por la aplicación: consume el paso de forma atómica (un código, un uso).
--    p_mode = 'ACTIVATE' (alta, sesión sin restricción) | 'VERIFY' (inicio de sesión MFA_PENDIENTE).
CREATE FUNCTION f01.complete_mfa(p_mode text, p_step bigint)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, f01
AS $fn$
DECLARE
  v_session uuid;
  v_user uuid;
  v_restriction text;
  v_state text;
  v_last bigint;
BEGIN
  IF p_mode NOT IN ('ACTIVATE', 'VERIFY') OR p_step IS NULL OR p_step < 0 THEN
    RAISE EXCEPTION 'Entrada inválida' USING ERRCODE = '22023';
  END IF;
  SELECT s.id, s.usuario_id, s.restringida_motivo INTO v_session, v_user, v_restriction
    FROM f01.sesion s JOIN f01.usuario u ON u.id = s.usuario_id
   WHERE s.token_fingerprint = decode(NULLIF(current_setting('app.auth_fingerprint', true), ''), 'hex')
     AND s.estado = 'VIGENTE' AND s.idle_expires_at > now() AND s.absolute_expires_at > now()
     AND u.estado = 'ACTIVO'
   FOR UPDATE OF s;
  IF v_session IS NULL THEN
    RAISE EXCEPTION 'No autorizado' USING ERRCODE = '42501';
  END IF;
  SELECT m.estado, m.ultimo_paso_usado INTO v_state, v_last FROM f01.mfa_totp m WHERE m.usuario_id = v_user FOR UPDATE;
  IF v_state IS NULL
     OR (p_mode = 'ACTIVATE' AND (v_state <> 'PENDIENTE' OR v_restriction IS NOT NULL))
     OR (p_mode = 'VERIFY' AND (v_state <> 'ACTIVO' OR v_restriction IS DISTINCT FROM 'MFA_PENDIENTE')) THEN
    RETURN 'INVALID_STATE';
  END IF;
  IF v_last IS NOT NULL AND p_step <= v_last THEN
    RETURN 'REUSED';
  END IF;
  UPDATE f01.mfa_totp SET ultimo_paso_usado = p_step,
         estado = 'ACTIVO', activado_at = COALESCE(activado_at, now())
   WHERE usuario_id = v_user;
  UPDATE f01.sesion SET mfa_verificada_at = now(), restringida_motivo = NULL WHERE id = v_session;
  INSERT INTO f01.auditoria_identidad(actor_usuario_id, objetivo_usuario_id, accion, resultado, correlation_id)
    VALUES (v_user, v_user, 'MFA_VERIFY', 'PERMITIDO', gen_random_uuid());
  RETURN 'OK';
END;
$fn$;

REVOKE ALL ON FUNCTION f01.mfa_requirement(), f01.begin_mfa_enrollment(bytea, bytea), f01.complete_mfa(text, bigint)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION f01.mfa_requirement(), f01.begin_mfa_enrollment(bytea, bytea), f01.complete_mfa(text, bigint)
  TO f01_auth;
