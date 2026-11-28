-- F07.1 (F071-FR-005, FR-010, D-01 A, D-02 A, D-04 A): revisión de ubicaciones por el
-- administrador de plataforma. ADITIVA: no modifica ni elimina políticas, funciones ni
-- restricciones de F07 (001–006) ni de F02.5. Las migraciones F07 corren antes que F02.5 y
-- también en clústeres sin F02.5, por eso aquí no se usa nada del esquema f025.
-- Sin BYPASSRLS: las funciones SECURITY DEFINER pertenecen a f071_policy (NOLOGIN, NOBYPASSRLS),
-- que solo ve, por políticas propias, la sesión actual y las filas del propio actor.

DO $roles$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='f071_policy') THEN
    CREATE ROLE f071_policy NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='f071_policy'
             AND (rolsuper OR rolbypassrls OR rolcanlogin OR rolcreatedb OR rolcreaterole OR rolreplication)) THEN
    RAISE EXCEPTION 'F07.1: rol interno con privilegios indebidos';
  END IF;
END;
$roles$;

GRANT USAGE ON SCHEMA f01, f07 TO f071_policy;

-- 1) Concesión explícita de revisión de plataforma (tabla propia, D-01 A).
CREATE TABLE f07.platform_location_grant (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL REFERENCES f01.usuario(id) ON DELETE RESTRICT,
  estado text NOT NULL DEFAULT 'ACTIVA' CHECK (estado IN ('ACTIVA','REVOCADA')),
  approval_id uuid NOT NULL,
  approval_sha256 text NOT NULL CHECK (approval_sha256 ~ '^[a-f0-9]{64}$'),
  reason text NOT NULL CHECK (char_length(btrim(reason)) BETWEEN 10 AND 300),
  granted_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  CONSTRAINT platform_location_grant_revocacion CHECK ((estado='ACTIVA') = (revoked_at IS NULL))
);
CREATE UNIQUE INDEX platform_location_grant_activa_unica
  ON f07.platform_location_grant(actor_id) WHERE estado='ACTIVA';
ALTER TABLE f07.platform_location_grant ENABLE ROW LEVEL SECURITY;
ALTER TABLE f07.platform_location_grant FORCE ROW LEVEL SECURITY;
REVOKE ALL ON f07.platform_location_grant FROM PUBLIC;
-- Ningún rol de aplicación puede dar de alta, cambiar ni ver concesiones ajenas.
GRANT SELECT (actor_id, estado) ON f07.platform_location_grant TO f071_policy;
CREATE POLICY f071_grant_propia ON f07.platform_location_grant
  FOR SELECT TO f071_policy
  USING (actor_id = NULLIF(current_setting('app.actor_user_id',true),'')::uuid);

-- 2) Lo mínimo que f071_policy necesita leer de F01, solo de la sesión y el actor actuales.
GRANT SELECT (usuario_id, token_fingerprint, estado, idle_expires_at, absolute_expires_at)
  ON f01.sesion TO f071_policy;
CREATE POLICY f071_policy_sesion ON f01.sesion
  FOR SELECT TO f071_policy
  USING (token_fingerprint = decode(NULLIF(current_setting('app.session_fingerprint',true),''),'hex'));
GRANT SELECT (id, estado) ON f01.usuario TO f071_policy;                               -- sin RLS
GRANT SELECT (usuario_id, role_code, estado) ON f01.platform_role_assignment TO f071_policy; -- sin RLS
GRANT SELECT (usuario_id, farmacia_id) ON f01.usuario_farmacia TO f071_policy;
CREATE POLICY f071_policy_membresias_propias ON f01.usuario_farmacia
  FOR SELECT TO f071_policy
  USING (usuario_id = NULLIF(current_setting('app.actor_user_id',true),'')::uuid);

-- 3) Actor autenticado (sesión vigente de la huella actual y usuario activo).
CREATE FUNCTION f07.location_actor() RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, f01, f07
AS $function$
  SELECT u.id FROM f01.sesion s JOIN f01.usuario u ON u.id=s.usuario_id
  WHERE s.token_fingerprint=decode(NULLIF(current_setting('app.session_fingerprint',true),''),'hex')
    AND s.usuario_id=NULLIF(current_setting('app.actor_user_id',true),'')::uuid
    AND s.estado='VIGENTE' AND s.idle_expires_at>now() AND s.absolute_expires_at>now()
    AND u.estado='ACTIVO'
  LIMIT 1;
$function$;
ALTER FUNCTION f07.location_actor() OWNER TO f071_policy;
REVOKE ALL ON FUNCTION f07.location_actor() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION f07.location_actor() TO f01_runtime;

-- 4) ¿Puede el actor revisar ubicaciones de la farmacia scope_id?
--    Rol ADMINISTRADOR_PLATAFORMA activo + concesión activa + NO es miembro (en ningún estado)
--    de esa farmacia. No depende de app.farmacia_id (no hay contexto de farmacia en la revisión).
CREATE FUNCTION f07.can_platform_location_review(scope_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, f01, f07
AS $function$
  WITH actor AS (SELECT f07.location_actor() AS id)
  SELECT scope_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM actor
    JOIN f01.platform_role_assignment r ON r.usuario_id=actor.id
      AND r.role_code='ADMINISTRADOR_PLATAFORMA' AND r.estado='ACTIVA'
    JOIN f07.platform_location_grant g ON g.actor_id=actor.id AND g.estado='ACTIVA'
    WHERE actor.id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM f01.usuario_farmacia m
        WHERE m.usuario_id=actor.id AND m.farmacia_id=scope_id));
$function$;
ALTER FUNCTION f07.can_platform_location_review(uuid) OWNER TO f071_policy;
REVOKE ALL ON FUNCTION f07.can_platform_location_review(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION f07.can_platform_location_review(uuid) TO f01_runtime;

-- 5) Políticas nuevas para f01_runtime (permisivas: se suman a las de F07, que no cambian).
--    Lectura: solo propuestas pendientes o decididas por este revisor.
CREATE POLICY f071_propuesta_plataforma_lectura ON f07.ubicacion_propuesta
  FOR SELECT TO f01_runtime
  USING (f07.can_platform_location_review(farmacia_id)
    AND (estado='PENDIENTE' OR revisada_por=f07.location_actor()));

--    Decisión: solo la ÚLTIMA pendiente de la farmacia (D-04 A), nunca la propia.
CREATE POLICY f071_propuesta_plataforma_decision ON f07.ubicacion_propuesta
  FOR UPDATE TO f01_runtime
  USING (estado='PENDIENTE'
    AND propuesta_por IS DISTINCT FROM f07.location_actor()
    AND f07.can_platform_location_review(farmacia_id)
    AND NOT EXISTS (SELECT 1 FROM f07.ubicacion_propuesta n
      WHERE n.farmacia_id=ubicacion_propuesta.farmacia_id AND n.estado='PENDIENTE'
        AND (n.propuesta_at, n.id) > (ubicacion_propuesta.propuesta_at, ubicacion_propuesta.id)))
  WITH CHECK (estado IN ('PUBLICADA_VERIFICADA','RECHAZADA')
    AND revisada_por=f07.location_actor()
    AND propuesta_por<>revisada_por
    AND f07.can_platform_location_review(farmacia_id));

--    Auditoría de la decisión (APROBACION/RECHAZO) por el propio revisor.
CREATE POLICY f071_auditoria_plataforma_lectura ON f07.ubicacion_auditoria
  FOR SELECT TO f01_runtime
  USING (f07.can_platform_location_review(farmacia_id) AND actor_usuario_id=f07.location_actor());
CREATE POLICY f071_auditoria_plataforma_alta ON f07.ubicacion_auditoria
  FOR INSERT TO f01_runtime
  WITH CHECK (actor_usuario_id=f07.location_actor()
    AND accion IN ('APROBACION','RECHAZO')
    AND f07.can_platform_location_review(farmacia_id));

--    Proyección pública: leer la fila pública y publicar exactamente la propuesta aprobada,
--    con las mismas comprobaciones de igualdad y versión que la 005.
CREATE POLICY f071_publica_plataforma_lectura ON f03.farmacia_publica
  FOR SELECT TO f01_runtime
  USING (f07.can_platform_location_review(farmacia_id));
CREATE POLICY f071_publica_plataforma_publicacion ON f03.farmacia_publica
  FOR UPDATE TO f01_runtime
  USING (f07.can_platform_location_review(farmacia_id))
  WITH CHECK (
    f07.can_platform_location_review(farmacia_id)
    AND estado_ubicacion='PUBLICADA_VERIFICADA'
    AND revisada_por=f07.location_actor()
    AND EXISTS (
      SELECT 1 FROM f07.ubicacion_propuesta p
      WHERE p.farmacia_id=f03.farmacia_publica.farmacia_id
        AND p.estado='PUBLICADA_VERIFICADA'
        AND p.revisada_por=f03.farmacia_publica.revisada_por
        AND p.propuesta_por=f03.farmacia_publica.propuesta_por
        AND p.direccion_publicable=f03.farmacia_publica.direccion_texto
        AND p.ciudad=f03.farmacia_publica.ciudad
        AND p.latitud=f03.farmacia_publica.latitud
        AND p.longitud=f03.farmacia_publica.longitud
        AND p.precision_m IS NOT DISTINCT FROM f03.farmacia_publica.precision_m
        AND p.fuente=f03.farmacia_publica.fuente
        AND p.base_public_version=f03.farmacia_publica.public_version-1));

-- 6) Límites aproximados del Perú para propuestas NUEVAS (F071-FR-004). NOT VALID: no revisa
--    filas antiguas; es una restricción nueva y aditiva, no cambia las de F07.
ALTER TABLE f07.ubicacion_propuesta
  ADD CONSTRAINT f071_ubicacion_en_peru
  CHECK (latitud BETWEEN -18.4 AND 0.1 AND longitud BETWEEN -81.4 AND -68.6) NOT VALID;
