-- F01.1 US1: operaciones atómicas de personal. Funciones SECURITY DEFINER con comprobación explícita
-- de autorización (patrón de 009/010). Ningún rol de aplicación obtiene BYPASSRLS ni permisos globales.
-- Supuesto de TEST: el propietario de las funciones puede escribir en tablas con FORCE RLS (migrador local).

-- ---------------------------------------------------------------------------
-- Alta atómica de una cuenta operativa de trabajador (propietario/administrador autorizado, rol runtime).
-- La vigencia de la clave temporal la fija la base: 24 horas desde ahora.
-- ---------------------------------------------------------------------------
CREATE FUNCTION f01.create_staff_account(
  p_pharmacy uuid, p_alias text, p_display_name text, p_unusable_hash text, p_temp_hash text, p_capabilities text[])
RETURNS TABLE (user_id uuid, expires_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, f01
AS $fn$
DECLARE
  v_actor uuid := NULLIF(current_setting('app.actor_user_id', true), '')::uuid;
  v_user uuid;
  v_membership uuid;
  v_capability text;
  v_expires timestamptz := now() + interval '24 hours';
BEGIN
  IF NOT f01.can_manage_local_worker(p_pharmacy, NULL) THEN
    RAISE EXCEPTION 'Permiso insuficiente' USING ERRCODE = '42501';
  END IF;
  IF p_unusable_hash NOT LIKE '$argon2id$%' OR p_temp_hash NOT LIKE '$argon2id$%' THEN
    RAISE EXCEPTION 'Hash inválido' USING ERRCODE = '22023';
  END IF;
  IF p_display_name IS NULL OR char_length(btrim(p_display_name)) NOT BETWEEN 1 AND 120 THEN
    RAISE EXCEPTION 'Nombre inválido' USING ERRCODE = '22023';
  END IF;
  FOREACH v_capability IN ARRAY COALESCE(p_capabilities, ARRAY[]::text[]) LOOP
    IF v_capability NOT IN ('reservation.read', 'reservation.accept', 'reservation.deliver', 'reservation.settings',
        'inventory.read', 'inventory.write', 'inventory.import.preview', 'inventory.import.confirm', 'inventory.history') THEN
      RAISE EXCEPTION 'Capacidad no delegable' USING ERRCODE = '22023';
    END IF;
  END LOOP;

  INSERT INTO f01.usuario(alias_canonico, password_hash) VALUES (p_alias, p_unusable_hash) RETURNING id INTO v_user;
  INSERT INTO f01.usuario_farmacia(usuario_id, farmacia_id, rol, estado, changed_by_usuario_id)
    VALUES (v_user, p_pharmacy, 'TRABAJADOR', 'ACTIVA', v_actor) RETURNING id INTO v_membership;
  FOREACH v_capability IN ARRAY COALESCE(p_capabilities, ARRAY[]::text[]) LOOP
    INSERT INTO f01.delegacion(membresia_id, farmacia_id, capacidad, granted_by_usuario_id)
      VALUES (v_membership, p_pharmacy, v_capability, v_actor);
  END LOOP;
  INSERT INTO f01.credencial_temporal(usuario_id, clave_hash, farmacia_id, emitida_por_usuario_id, motivo, emitida_at, expira_at)
    VALUES (v_user, p_temp_hash, p_pharmacy, v_actor, 'ALTA', now(), v_expires);
  INSERT INTO f01.perfil_usuario(usuario_id, nombre) VALUES (v_user, btrim(p_display_name));
  INSERT INTO f01.auditoria_identidad(actor_usuario_id, objetivo_usuario_id, farmacia_id, accion, resultado, correlation_id)
    VALUES (v_actor, v_user, p_pharmacy, 'STAFF_CREATE', 'PERMITIDO', gen_random_uuid());
  IF COALESCE(array_length(p_capabilities, 1), 0) > 0 THEN
    INSERT INTO f01.auditoria_identidad(actor_usuario_id, objetivo_usuario_id, farmacia_id, accion, resultado, correlation_id)
      VALUES (v_actor, v_user, p_pharmacy, 'CAPABILITY_GRANT', 'PERMITIDO', gen_random_uuid());
  END IF;
  RETURN QUERY SELECT v_user, v_expires;
END;
$fn$;
REVOKE ALL ON FUNCTION f01.create_staff_account(uuid, text, text, text, text, text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION f01.create_staff_account(uuid, text, text, text, text, text[]) TO f01_runtime;

-- ---------------------------------------------------------------------------
-- Listado de personal de la farmacia activa (sin hashes ni claves).
-- ---------------------------------------------------------------------------
CREATE FUNCTION f01.list_staff(p_pharmacy uuid)
RETURNS TABLE (membership_id uuid, user_id uuid, alias text, display_name text, state text,
               pending_temporary_key boolean, capabilities text[])
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = pg_catalog, f01
AS $fn$
BEGIN
  IF NOT f01.can_manage_local_worker(p_pharmacy, NULL) THEN
    RAISE EXCEPTION 'Permiso insuficiente' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT m.id, m.usuario_id, u.alias_canonico, p.nombre, m.estado,
           EXISTS (SELECT 1 FROM f01.credencial_temporal c
                   WHERE c.usuario_id = m.usuario_id AND c.consumida_at IS NULL AND c.expira_at > now()),
           COALESCE(ARRAY(SELECT d.capacidad FROM f01.delegacion d
                          WHERE d.membresia_id = m.id AND d.farmacia_id = m.farmacia_id AND d.estado = 'ACTIVA'
                          ORDER BY d.capacidad), ARRAY[]::text[])
    FROM f01.usuario_farmacia m
    JOIN f01.usuario u ON u.id = m.usuario_id
    LEFT JOIN f01.perfil_usuario p ON p.usuario_id = m.usuario_id
    WHERE m.farmacia_id = p_pharmacy AND m.rol = 'TRABAJADOR'
    ORDER BY m.created_at, m.id;
END;
$fn$;
REVOKE ALL ON FUNCTION f01.list_staff(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION f01.list_staff(uuid) TO f01_runtime;

-- ---------------------------------------------------------------------------
-- Cambio de clave tras ingresar con clave temporal (sesión restringida CAMBIO_CLAVE, rol de autenticación).
-- Solo actúa sobre la sesión del contexto; cierra las demás sesiones de la cuenta y libera la restricción.
-- ---------------------------------------------------------------------------
CREATE FUNCTION f01.complete_password_change(p_new_hash text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, f01
AS $fn$
DECLARE
  v_session_id uuid;
  v_user uuid;
BEGIN
  IF p_new_hash IS NULL OR p_new_hash NOT LIKE '$argon2id$%' THEN
    RAISE EXCEPTION 'Hash inválido' USING ERRCODE = '22023';
  END IF;
  SELECT s.id, s.usuario_id INTO v_session_id, v_user
    FROM f01.sesion s JOIN f01.usuario u ON u.id = s.usuario_id
   WHERE s.token_fingerprint = decode(NULLIF(current_setting('app.auth_fingerprint', true), ''), 'hex')
     AND s.estado = 'VIGENTE' AND s.idle_expires_at > now() AND s.absolute_expires_at > now()
     AND s.restringida_motivo = 'CAMBIO_CLAVE' AND u.estado = 'ACTIVO'
   FOR UPDATE OF s;
  IF v_session_id IS NULL THEN
    RAISE EXCEPTION 'No autorizado' USING ERRCODE = '42501';
  END IF;
  UPDATE f01.usuario SET password_hash = p_new_hash, updated_at = now() WHERE id = v_user;
  UPDATE f01.sesion SET restringida_motivo = NULL WHERE id = v_session_id;
  UPDATE f01.sesion SET estado = 'REVOCADA', revoked_at = now()
   WHERE usuario_id = v_user AND id <> v_session_id AND estado = 'VIGENTE';
  INSERT INTO f01.auditoria_identidad(actor_usuario_id, objetivo_usuario_id, accion, resultado, correlation_id)
    VALUES (v_user, v_user, 'PASSWORD_CHANGE', 'PERMITIDO', gen_random_uuid());
END;
$fn$;
REVOKE ALL ON FUNCTION f01.complete_password_change(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION f01.complete_password_change(text) TO f01_auth;
