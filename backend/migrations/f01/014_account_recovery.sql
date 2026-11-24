-- F01.1 US3: restablecimiento de clave, verificación de correo y reemisión de clave temporal de personal.
-- Funciones SECURITY DEFINER con comprobación explícita. SQLSTATE: 42501 permiso · F0404 no visible/ inválido · 22023 entrada inválida.

-- ---------------------------------------------------------------------------
-- Restablecer la clave con un token de un solo uso (rol de autenticación, sin sesión).
-- Invalida los demás tokens de restablecimiento, consume la clave temporal y cierra TODAS las sesiones.
-- Un token inexistente, usado o vencido devuelve false (no se distingue entre ellos).
-- ---------------------------------------------------------------------------
CREATE FUNCTION f01.complete_password_reset(p_token_hash bytea, p_new_hash text)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, f01
AS $fn$
DECLARE
  v_token uuid;
  v_user uuid;
BEGIN
  IF p_new_hash IS NULL OR p_new_hash NOT LIKE '$argon2id$%' THEN
    RAISE EXCEPTION 'Hash inválido' USING ERRCODE = '22023';
  END IF;
  SELECT t.id, t.usuario_id INTO v_token, v_user
    FROM f01.token_cuenta t JOIN f01.usuario u ON u.id = t.usuario_id
   WHERE t.token_hash = p_token_hash AND t.proposito = 'RESTABLECER_CLAVE'
     AND t.usado_at IS NULL AND t.expira_at > now() AND u.estado = 'ACTIVO'
   FOR UPDATE OF t;
  IF v_token IS NULL THEN RETURN false; END IF;
  UPDATE f01.token_cuenta SET usado_at = now()
   WHERE usuario_id = v_user AND proposito = 'RESTABLECER_CLAVE' AND usado_at IS NULL;
  UPDATE f01.usuario SET password_hash = p_new_hash, updated_at = now() WHERE id = v_user;
  UPDATE f01.credencial_temporal SET consumida_at = now() WHERE usuario_id = v_user AND consumida_at IS NULL;
  UPDATE f01.sesion SET estado = 'REVOCADA', revoked_at = now() WHERE usuario_id = v_user AND estado = 'VIGENTE';
  INSERT INTO f01.auditoria_identidad(actor_usuario_id, objetivo_usuario_id, accion, resultado, correlation_id)
    VALUES (v_user, v_user, 'PASSWORD_RESET', 'PERMITIDO', gen_random_uuid());
  RETURN true;
END;
$fn$;
REVOKE ALL ON FUNCTION f01.complete_password_reset(bytea, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION f01.complete_password_reset(bytea, text) TO f01_auth;

-- ---------------------------------------------------------------------------
-- Verificar el correo propio con un token de un solo uso (VERIFICAR_CORREO).
-- ---------------------------------------------------------------------------
CREATE FUNCTION f01.verify_email(p_token_hash bytea)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, f01
AS $fn$
DECLARE
  v_token uuid;
  v_user uuid;
BEGIN
  SELECT t.id, t.usuario_id INTO v_token, v_user
    FROM f01.token_cuenta t JOIN f01.usuario u ON u.id = t.usuario_id
   WHERE t.token_hash = p_token_hash AND t.proposito = 'VERIFICAR_CORREO'
     AND t.usado_at IS NULL AND t.expira_at > now() AND u.estado = 'ACTIVO' AND u.email_canonico IS NOT NULL
   FOR UPDATE OF t;
  IF v_token IS NULL THEN RETURN false; END IF;
  UPDATE f01.token_cuenta SET usado_at = now() WHERE id = v_token;
  UPDATE f01.usuario SET email_verificado_at = now(), updated_at = now() WHERE id = v_user;
  INSERT INTO f01.auditoria_identidad(actor_usuario_id, objetivo_usuario_id, accion, resultado, correlation_id)
    VALUES (v_user, v_user, 'EMAIL_VERIFY', 'PERMITIDO', gen_random_uuid());
  RETURN true;
END;
$fn$;
REVOKE ALL ON FUNCTION f01.verify_email(bytea) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION f01.verify_email(bytea) TO f01_auth;

-- ---------------------------------------------------------------------------
-- Reemisión de clave temporal para un trabajador SIN correo creado por esta farmacia (rol runtime).
-- Un propietario nunca puede fijar credenciales de una cuenta global con correo ni de otra farmacia.
-- Cierra las sesiones de la cuenta; la clave anterior deja de servir.
-- ---------------------------------------------------------------------------
CREATE FUNCTION f01.issue_temporary_key(p_pharmacy uuid, p_user uuid, p_key_hash text)
RETURNS timestamptz
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, f01
AS $fn$
DECLARE
  v_actor uuid := NULLIF(current_setting('app.actor_user_id', true), '')::uuid;
  v_expires timestamptz := now() + interval '24 hours';
BEGIN
  IF NOT f01.can_manage_local_worker(p_pharmacy, p_user) THEN
    RAISE EXCEPTION 'Permiso insuficiente' USING ERRCODE = '42501';
  END IF;
  IF p_key_hash IS NULL OR p_key_hash NOT LIKE '$argon2id$%' THEN
    RAISE EXCEPTION 'Hash inválido' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM f01.usuario u
      JOIN f01.usuario_farmacia m ON m.usuario_id = u.id AND m.farmacia_id = p_pharmacy
      JOIN f01.credencial_temporal c ON c.usuario_id = u.id AND c.farmacia_id = p_pharmacy
     WHERE u.id = p_user AND u.estado = 'ACTIVO' AND u.email_canonico IS NULL AND u.alias_canonico IS NOT NULL
       AND m.rol = 'TRABAJADOR' AND m.estado = 'ACTIVA') THEN
    RAISE EXCEPTION 'No visible' USING ERRCODE = 'F0404';
  END IF;
  UPDATE f01.credencial_temporal
     SET clave_hash = p_key_hash, emitida_por_usuario_id = v_actor, motivo = 'RECUPERACION',
         emitida_at = now(), expira_at = v_expires, consumida_at = NULL
   WHERE usuario_id = p_user AND farmacia_id = p_pharmacy;
  UPDATE f01.sesion SET estado = 'REVOCADA', revoked_at = now() WHERE usuario_id = p_user AND estado = 'VIGENTE';
  INSERT INTO f01.auditoria_identidad(actor_usuario_id, objetivo_usuario_id, farmacia_id, accion, resultado, correlation_id)
    VALUES (v_actor, p_user, p_pharmacy, 'TEMP_KEY_ISSUE', 'PERMITIDO', gen_random_uuid());
  RETURN v_expires;
END;
$fn$;
REVOKE ALL ON FUNCTION f01.issue_temporary_key(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION f01.issue_temporary_key(uuid, uuid, text) TO f01_runtime;
