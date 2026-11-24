-- F01.1 US2: invitaciones, permisos delegados y revocación inmediata.
-- Funciones SECURITY DEFINER con autorización explícita (patrón 009/010/012). Códigos SQLSTATE propios:
--   42501 permiso insuficiente · F0404 no visible · F0409 conflicto · 22023 entrada inválida.

-- ---------------------------------------------------------------------------
-- Invitar por correo a una cuenta existente. Siempre silenciosa: no revela si la cuenta existe.
-- ---------------------------------------------------------------------------
CREATE FUNCTION f01.invite_staff(p_pharmacy uuid, p_email text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, f01
AS $fn$
DECLARE
  v_actor uuid := NULLIF(current_setting('app.actor_user_id', true), '')::uuid;
  v_target uuid;
BEGIN
  IF NOT f01.can_manage_local_worker(p_pharmacy, NULL) THEN
    RAISE EXCEPTION 'Permiso insuficiente' USING ERRCODE = '42501';
  END IF;
  SELECT id INTO v_target FROM f01.usuario WHERE email_canonico = lower(btrim(p_email)) AND estado = 'ACTIVO';
  IF v_target IS NULL OR v_target = v_actor THEN RETURN; END IF;
  IF EXISTS (SELECT 1 FROM f01.usuario_farmacia WHERE usuario_id = v_target AND farmacia_id = p_pharmacy AND estado = 'ACTIVA') THEN
    RETURN;
  END IF;
  UPDATE f01.invitacion_personal SET estado = 'VENCIDA', resuelta_at = now()
   WHERE farmacia_id = p_pharmacy AND usuario_destino_id = v_target AND estado = 'PENDIENTE' AND expira_at <= now();
  IF EXISTS (SELECT 1 FROM f01.invitacion_personal
              WHERE farmacia_id = p_pharmacy AND usuario_destino_id = v_target AND estado = 'PENDIENTE') THEN
    RETURN;
  END IF;
  INSERT INTO f01.invitacion_personal(farmacia_id, usuario_destino_id, invitado_por_usuario_id, expira_at)
    VALUES (p_pharmacy, v_target, v_actor, now() + interval '7 days');
  INSERT INTO f01.auditoria_identidad(actor_usuario_id, objetivo_usuario_id, farmacia_id, accion, resultado, correlation_id)
    VALUES (v_actor, v_target, p_pharmacy, 'INVITE_CREATE', 'PERMITIDO', gen_random_uuid());
END;
$fn$;
REVOKE ALL ON FUNCTION f01.invite_staff(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION f01.invite_staff(uuid, text) TO f01_runtime;

-- Invitaciones de la farmacia (destino enmascarado: alias, nombre o correo parcial).
CREATE FUNCTION f01.list_invitations(p_pharmacy uuid)
RETURNS TABLE (id uuid, destination text, state text, created_at timestamptz, expires_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = pg_catalog, f01
AS $fn$
BEGIN
  IF NOT f01.can_manage_local_worker(p_pharmacy, NULL) THEN
    RAISE EXCEPTION 'Permiso insuficiente' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT i.id,
           COALESCE(u.alias_canonico, p.nombre,
                    left(u.email_canonico, 1) || '***' || substring(u.email_canonico from position('@' in u.email_canonico))),
           CASE WHEN i.estado = 'PENDIENTE' AND i.expira_at <= now() THEN 'VENCIDA' ELSE i.estado END,
           i.creada_at, i.expira_at
      FROM f01.invitacion_personal i
      JOIN f01.usuario u ON u.id = i.usuario_destino_id
      LEFT JOIN f01.perfil_usuario p ON p.usuario_id = u.id
     WHERE i.farmacia_id = p_pharmacy
     ORDER BY i.creada_at DESC, i.id;
END;
$fn$;
REVOKE ALL ON FUNCTION f01.list_invitations(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION f01.list_invitations(uuid) TO f01_runtime;

CREATE FUNCTION f01.revoke_staff_invitation(p_pharmacy uuid, p_invitation uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, f01
AS $fn$
DECLARE
  v_actor uuid := NULLIF(current_setting('app.actor_user_id', true), '')::uuid;
  v_target uuid;
BEGIN
  IF NOT f01.can_manage_local_worker(p_pharmacy, NULL) THEN
    RAISE EXCEPTION 'Permiso insuficiente' USING ERRCODE = '42501';
  END IF;
  UPDATE f01.invitacion_personal SET estado = 'REVOCADA', resuelta_at = now()
   WHERE id = p_invitation AND farmacia_id = p_pharmacy AND estado = 'PENDIENTE'
   RETURNING usuario_destino_id INTO v_target;
  IF v_target IS NULL THEN RAISE EXCEPTION 'No visible' USING ERRCODE = 'F0404'; END IF;
  INSERT INTO f01.auditoria_identidad(actor_usuario_id, objetivo_usuario_id, farmacia_id, accion, resultado, correlation_id)
    VALUES (v_actor, v_target, p_pharmacy, 'INVITE_REVOKE', 'PERMITIDO', gen_random_uuid());
END;
$fn$;
REVOKE ALL ON FUNCTION f01.revoke_staff_invitation(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION f01.revoke_staff_invitation(uuid, uuid) TO f01_runtime;

-- ---------------------------------------------------------------------------
-- Invitaciones propias (destinatario autenticado, sin contexto de farmacia).
-- ---------------------------------------------------------------------------
CREATE FUNCTION f01.list_my_invitations()
RETURNS TABLE (id uuid, pharmacy_name text, state text, expires_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = pg_catalog, f01
AS $fn$
DECLARE v_actor uuid := NULLIF(current_setting('app.actor_user_id', true), '')::uuid;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'Permiso insuficiente' USING ERRCODE = '42501'; END IF;
  RETURN QUERY
    SELECT i.id, f.nombre_publico, i.estado, i.expira_at
      FROM f01.invitacion_personal i JOIN f01.farmacia_referencia f ON f.id = i.farmacia_id
     WHERE i.usuario_destino_id = v_actor AND i.estado = 'PENDIENTE' AND i.expira_at > now() AND f.estado = 'ACTIVA'
     ORDER BY i.creada_at DESC, i.id;
END;
$fn$;
REVOKE ALL ON FUNCTION f01.list_my_invitations() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION f01.list_my_invitations() TO f01_runtime;

CREATE FUNCTION f01.accept_staff_invitation(p_invitation uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, f01
AS $fn$
DECLARE
  v_actor uuid := NULLIF(current_setting('app.actor_user_id', true), '')::uuid;
  v_inv f01.invitacion_personal%ROWTYPE;
  v_membership f01.usuario_farmacia%ROWTYPE;
  v_id uuid;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'Permiso insuficiente' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v_inv FROM f01.invitacion_personal WHERE id = p_invitation AND usuario_destino_id = v_actor FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'No visible' USING ERRCODE = 'F0404'; END IF;
  IF v_inv.estado <> 'PENDIENTE' OR v_inv.expira_at <= now()
     OR NOT EXISTS (SELECT 1 FROM f01.farmacia_referencia WHERE id = v_inv.farmacia_id AND estado = 'ACTIVA') THEN
    RAISE EXCEPTION 'Conflicto' USING ERRCODE = 'F0409';
  END IF;
  SELECT * INTO v_membership FROM f01.usuario_farmacia WHERE usuario_id = v_actor AND farmacia_id = v_inv.farmacia_id FOR UPDATE;
  IF FOUND THEN
    IF v_membership.estado = 'REVOCADA' AND v_membership.rol = 'TRABAJADOR' THEN
      UPDATE f01.usuario_farmacia SET estado = 'ACTIVA', changed_by_usuario_id = v_inv.invitado_por_usuario_id, updated_at = now()
       WHERE id = v_membership.id;
      v_id := v_membership.id;
    ELSE
      RAISE EXCEPTION 'Conflicto' USING ERRCODE = 'F0409';
    END IF;
  ELSE
    INSERT INTO f01.usuario_farmacia(usuario_id, farmacia_id, rol, estado, changed_by_usuario_id)
      VALUES (v_actor, v_inv.farmacia_id, 'TRABAJADOR', 'ACTIVA', v_inv.invitado_por_usuario_id) RETURNING id INTO v_id;
  END IF;
  UPDATE f01.invitacion_personal SET estado = 'ACEPTADA', resuelta_at = now() WHERE id = v_inv.id;
  INSERT INTO f01.auditoria_identidad(actor_usuario_id, objetivo_usuario_id, farmacia_id, accion, resultado, correlation_id)
    VALUES (v_actor, v_actor, v_inv.farmacia_id, 'INVITE_ACCEPT', 'PERMITIDO', gen_random_uuid());
  RETURN v_id;
END;
$fn$;
REVOKE ALL ON FUNCTION f01.accept_staff_invitation(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION f01.accept_staff_invitation(uuid) TO f01_runtime;

CREATE FUNCTION f01.decline_staff_invitation(p_invitation uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, f01
AS $fn$
DECLARE
  v_actor uuid := NULLIF(current_setting('app.actor_user_id', true), '')::uuid;
  v_pharmacy uuid;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'Permiso insuficiente' USING ERRCODE = '42501'; END IF;
  UPDATE f01.invitacion_personal SET estado = 'RECHAZADA', resuelta_at = now()
   WHERE id = p_invitation AND usuario_destino_id = v_actor AND estado = 'PENDIENTE' AND expira_at > now()
   RETURNING farmacia_id INTO v_pharmacy;
  IF v_pharmacy IS NULL THEN RAISE EXCEPTION 'No visible' USING ERRCODE = 'F0404'; END IF;
  INSERT INTO f01.auditoria_identidad(actor_usuario_id, objetivo_usuario_id, farmacia_id, accion, resultado, correlation_id)
    VALUES (v_actor, v_actor, v_pharmacy, 'INVITE_DECLINE', 'PERMITIDO', gen_random_uuid());
END;
$fn$;
REVOKE ALL ON FUNCTION f01.decline_staff_invitation(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION f01.decline_staff_invitation(uuid) TO f01_runtime;

-- ---------------------------------------------------------------------------
-- Permisos delegados: reemplazo atómico del conjunto delegable (solo catálogo F02/F04).
-- ---------------------------------------------------------------------------
CREATE FUNCTION f01.set_staff_capabilities(p_pharmacy uuid, p_membership uuid, p_capabilities text[])
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, f01
AS $fn$
DECLARE
  v_actor uuid := NULLIF(current_setting('app.actor_user_id', true), '')::uuid;
  v_catalog text[] := ARRAY['reservation.read', 'reservation.accept', 'reservation.deliver', 'reservation.settings',
    'inventory.read', 'inventory.write', 'inventory.import.preview', 'inventory.import.confirm', 'inventory.history'];
  v_target uuid;
  v_capability text;
  v_wanted text[] := COALESCE(p_capabilities, ARRAY[]::text[]);
  v_revoked int;
  v_granted int := 0;
  v_count int;
BEGIN
  IF NOT f01.can_manage_local_worker(p_pharmacy, NULL) THEN
    RAISE EXCEPTION 'Permiso insuficiente' USING ERRCODE = '42501';
  END IF;
  SELECT usuario_id INTO v_target FROM f01.usuario_farmacia
   WHERE id = p_membership AND farmacia_id = p_pharmacy AND rol = 'TRABAJADOR' AND estado = 'ACTIVA' FOR UPDATE;
  IF v_target IS NULL THEN RAISE EXCEPTION 'No visible' USING ERRCODE = 'F0404'; END IF;
  IF v_target = v_actor THEN RAISE EXCEPTION 'Permiso insuficiente' USING ERRCODE = '42501'; END IF;
  FOREACH v_capability IN ARRAY v_wanted LOOP
    IF NOT (v_capability = ANY (v_catalog)) THEN RAISE EXCEPTION 'Capacidad no delegable' USING ERRCODE = '22023'; END IF;
  END LOOP;
  UPDATE f01.delegacion SET estado = 'REVOCADA', revoked_at = now()
   WHERE membresia_id = p_membership AND farmacia_id = p_pharmacy AND estado = 'ACTIVA'
     AND capacidad = ANY (v_catalog) AND NOT (capacidad = ANY (v_wanted));
  GET DIAGNOSTICS v_revoked = ROW_COUNT;
  FOREACH v_capability IN ARRAY v_wanted LOOP
    UPDATE f01.delegacion SET estado = 'ACTIVA', revoked_at = NULL, granted_by_usuario_id = v_actor, granted_at = now()
     WHERE membresia_id = p_membership AND capacidad = v_capability AND estado = 'REVOCADA';
    GET DIAGNOSTICS v_count = ROW_COUNT;
    IF v_count = 0 THEN
      INSERT INTO f01.delegacion(membresia_id, farmacia_id, capacidad, granted_by_usuario_id)
        VALUES (p_membership, p_pharmacy, v_capability, v_actor) ON CONFLICT (membresia_id, capacidad) DO NOTHING;
      GET DIAGNOSTICS v_count = ROW_COUNT;
    END IF;
    v_granted := v_granted + v_count;
  END LOOP;
  IF v_granted > 0 THEN
    INSERT INTO f01.auditoria_identidad(actor_usuario_id, objetivo_usuario_id, farmacia_id, accion, resultado, correlation_id)
      VALUES (v_actor, v_target, p_pharmacy, 'CAPABILITY_GRANT', 'PERMITIDO', gen_random_uuid());
  END IF;
  IF v_revoked > 0 THEN
    INSERT INTO f01.auditoria_identidad(actor_usuario_id, objetivo_usuario_id, farmacia_id, accion, resultado, correlation_id)
      VALUES (v_actor, v_target, p_pharmacy, 'CAPABILITY_REVOKE', 'PERMITIDO', gen_random_uuid());
  END IF;
END;
$fn$;
REVOKE ALL ON FUNCTION f01.set_staff_capabilities(uuid, uuid, text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION f01.set_staff_capabilities(uuid, uuid, text[]) TO f01_runtime;

-- ---------------------------------------------------------------------------
-- Revocación de la membresía de un trabajador: efecto inmediato (D-08).
-- Revoca sus delegaciones y, si no le queda ninguna membresía activa, cierra todas sus sesiones.
-- ---------------------------------------------------------------------------
CREATE FUNCTION f01.revoke_staff_membership(p_pharmacy uuid, p_membership uuid)
RETURNS TABLE (id uuid, usuario_id uuid, farmacia_id uuid, estado text)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, f01
AS $fn$
DECLARE
  v_actor uuid := NULLIF(current_setting('app.actor_user_id', true), '')::uuid;
  v_target uuid;
  v_sessions int := 0;
BEGIN
  IF NOT f01.can_manage_local_worker(p_pharmacy, NULL) THEN
    RAISE EXCEPTION 'Permiso insuficiente' USING ERRCODE = '42501';
  END IF;
  UPDATE f01.usuario_farmacia SET estado = 'REVOCADA', changed_by_usuario_id = v_actor, updated_at = now()
   WHERE usuario_farmacia.id = p_membership AND usuario_farmacia.farmacia_id = p_pharmacy
     AND usuario_farmacia.rol = 'TRABAJADOR' AND usuario_farmacia.estado = 'ACTIVA'
     AND usuario_farmacia.usuario_id <> v_actor
  RETURNING usuario_farmacia.usuario_id INTO v_target;
  IF v_target IS NULL THEN RETURN; END IF;
  UPDATE f01.delegacion SET estado = 'REVOCADA', revoked_at = now()
   WHERE delegacion.membresia_id = p_membership AND delegacion.estado = 'ACTIVA';
  IF NOT EXISTS (SELECT 1 FROM f01.usuario_farmacia m WHERE m.usuario_id = v_target AND m.estado = 'ACTIVA') THEN
    UPDATE f01.sesion SET estado = 'REVOCADA', revoked_at = now()
     WHERE sesion.usuario_id = v_target AND sesion.estado = 'VIGENTE';
    GET DIAGNOSTICS v_sessions = ROW_COUNT;
  END IF;
  INSERT INTO f01.auditoria_identidad(actor_usuario_id, objetivo_usuario_id, farmacia_id, accion, resultado, correlation_id)
    VALUES (v_actor, v_target, p_pharmacy, 'MEMBERSHIP_REVOKE', 'PERMITIDO', gen_random_uuid());
  IF v_sessions > 0 THEN
    INSERT INTO f01.auditoria_identidad(actor_usuario_id, objetivo_usuario_id, farmacia_id, accion, resultado, correlation_id)
      VALUES (v_actor, v_target, p_pharmacy, 'SESSION_REVOKE', 'PERMITIDO', gen_random_uuid());
  END IF;
  RETURN QUERY SELECT m.id, m.usuario_id, m.farmacia_id, m.estado FROM f01.usuario_farmacia m WHERE m.id = p_membership;
END;
$fn$;
REVOKE ALL ON FUNCTION f01.revoke_staff_membership(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION f01.revoke_staff_membership(uuid, uuid) TO f01_runtime;
