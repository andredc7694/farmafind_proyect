-- F02.5 RLS applies to requests before tenant creation and to tenant data afterwards.
-- All functions are owned by non-login, non-BYPASSRLS roles; no runtime table-wide grants.
REVOKE ALL ON ALL TABLES IN SCHEMA f025 FROM PUBLIC;

ALTER TABLE f025.platform_capability_grant ENABLE ROW LEVEL SECURITY;
ALTER TABLE f025.platform_capability_grant FORCE ROW LEVEL SECURITY;
CREATE POLICY f025_capability_self ON f025.platform_capability_grant
  FOR SELECT TO f025_policy
  USING (actor_id = NULLIF(current_setting('app.actor_user_id',true),'')::uuid);

-- The policy role sees only the session fingerprint supplied to this transaction.
CREATE POLICY f025_policy_session ON f01.sesion
  FOR SELECT TO f025_policy
  USING (token_fingerprint = decode(NULLIF(current_setting('app.session_fingerprint',true),''),'hex'));

CREATE FUNCTION f025.authenticated_actor() RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, f01, f025
AS $function$
  SELECT u.id FROM f01.sesion s JOIN f01.usuario u ON u.id=s.usuario_id
  WHERE s.token_fingerprint=decode(NULLIF(current_setting('app.session_fingerprint',true),''),'hex')
    AND s.usuario_id=NULLIF(current_setting('app.actor_user_id',true),'')::uuid
    AND s.estado='VIGENTE' AND s.idle_expires_at>now() AND s.absolute_expires_at>now()
    AND u.estado='ACTIVO'
  LIMIT 1;
$function$;
ALTER FUNCTION f025.authenticated_actor() OWNER TO f025_policy;
REVOKE ALL ON FUNCTION f025.authenticated_actor() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION f025.authenticated_actor() TO f01_runtime, f025_activation_executor;

CREATE FUNCTION f025.has_capability(required_code text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, f01, f025
AS $function$
  SELECT required_code IN (
    'F025_APPLICATION_READ','F025_APPLICATION_REVIEW','F025_DOCUMENT_READ',
    'F025_APPLICATION_DECIDE','F025_PHARMACY_ACTIVATE'
  ) AND EXISTS (
    SELECT 1 FROM f01.platform_role_assignment a
    JOIN f025.platform_capability_grant g ON g.actor_id=a.usuario_id
    WHERE a.usuario_id=f025.authenticated_actor()
      AND a.role_code='ADMINISTRADOR_PLATAFORMA' AND a.estado='ACTIVA'
      AND g.capability_code=required_code AND g.estado='ACTIVA'
  );
$function$;
ALTER FUNCTION f025.has_capability(text) OWNER TO f025_policy;
REVOKE ALL ON FUNCTION f025.has_capability(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION f025.has_capability(text) TO f01_runtime, f025_activation_executor;

ALTER TABLE f025.solicitud ENABLE ROW LEVEL SECURITY;
ALTER TABLE f025.solicitud FORCE ROW LEVEL SECURITY;
CREATE POLICY f025_solicitud_propia_lectura ON f025.solicitud
  FOR SELECT TO f01_runtime
  USING (solicitante_id=f025.authenticated_actor());
CREATE POLICY f025_solicitud_propia_creacion ON f025.solicitud
  FOR INSERT TO f01_runtime
  WITH CHECK (solicitante_id=f025.authenticated_actor() AND estado='BORRADOR'
    AND farmacia_activada_id IS NULL);
CREATE POLICY f025_solicitud_propia_edicion ON f025.solicitud
  FOR UPDATE TO f01_runtime
  USING (solicitante_id=f025.authenticated_actor() AND estado IN ('BORRADOR','OBSERVADA'))
  WITH CHECK (solicitante_id=f025.authenticated_actor() AND estado IN ('BORRADOR','OBSERVADA')
    AND farmacia_activada_id IS NULL);
CREATE POLICY f025_solicitud_policy_role ON f025.solicitud
  FOR SELECT TO f025_policy
  USING (solicitante_id=f025.authenticated_actor() OR
    f025.has_capability('F025_APPLICATION_READ') OR
    f025.has_capability('F025_APPLICATION_REVIEW') OR
    f025.has_capability('F025_APPLICATION_DECIDE'));
CREATE POLICY f025_solicitud_policy_mutation ON f025.solicitud
  FOR UPDATE TO f025_policy
  USING (solicitante_id=f025.authenticated_actor() OR
    f025.has_capability('F025_APPLICATION_REVIEW') OR
    f025.has_capability('F025_APPLICATION_DECIDE'))
  WITH CHECK (solicitante_id=f025.authenticated_actor() OR
    f025.has_capability('F025_APPLICATION_REVIEW') OR
    f025.has_capability('F025_APPLICATION_DECIDE'));
CREATE POLICY f025_solicitud_activation ON f025.solicitud
  FOR ALL TO f025_activation_executor
  USING (id=NULLIF(current_setting('app.f025_application_id',true),'')::uuid)
  WITH CHECK (id=NULLIF(current_setting('app.f025_application_id',true),'')::uuid);

GRANT SELECT ON f025.solicitud TO f01_runtime;
GRANT INSERT (solicitante_id, nombre_comercial, contacto, direccion, departamento,
  provincia, distrito, representante, ruc) ON f025.solicitud TO f01_runtime;
-- The application may edit draft fields, never status or activated pharmacy directly.
GRANT UPDATE (nombre_comercial, contacto, direccion, departamento, provincia, distrito,
  representante, ruc) ON f025.solicitud TO f01_runtime;
GRANT SELECT, UPDATE ON f025.solicitud TO f025_policy, f025_activation_executor;

ALTER TABLE f025.revision ENABLE ROW LEVEL SECURITY;
ALTER TABLE f025.revision FORCE ROW LEVEL SECURITY;
CREATE POLICY f025_revision_policy_read ON f025.revision
  FOR SELECT TO f025_policy
  USING (EXISTS (SELECT 1 FROM f025.solicitud s WHERE s.id=revision.solicitud_id
    AND (s.solicitante_id=f025.authenticated_actor() OR
      f025.has_capability('F025_APPLICATION_REVIEW'))));
CREATE POLICY f025_revision_policy_write ON f025.revision
  FOR INSERT TO f025_policy
  WITH CHECK (actor_id=f025.authenticated_actor() AND EXISTS (
    SELECT 1 FROM f025.solicitud s WHERE s.id=revision.solicitud_id
      AND (s.solicitante_id=actor_id OR f025.has_capability('F025_APPLICATION_DECIDE') OR
        f025.has_capability('F025_APPLICATION_REVIEW'))));
CREATE POLICY f025_revision_activation ON f025.revision
  FOR INSERT TO f025_activation_executor
  WITH CHECK (solicitud_id=NULLIF(current_setting('app.f025_application_id',true),'')::uuid
    AND actor_id=f025.authenticated_actor());
GRANT SELECT, INSERT ON f025.revision TO f025_policy;
GRANT INSERT ON f025.revision TO f025_activation_executor;

ALTER TABLE f025.documento ENABLE ROW LEVEL SECURITY;
ALTER TABLE f025.documento FORCE ROW LEVEL SECURITY;
CREATE POLICY f025_documento_policy_read ON f025.documento
  FOR SELECT TO f025_policy
  USING (EXISTS (SELECT 1 FROM f025.solicitud s WHERE s.id=documento.solicitud_id
    AND (s.solicitante_id=f025.authenticated_actor() OR
      f025.has_capability('F025_DOCUMENT_READ'))));
CREATE POLICY f025_documento_policy_insert ON f025.documento
  FOR INSERT TO f025_policy
  WITH CHECK (EXISTS (SELECT 1 FROM f025.solicitud s WHERE s.id=documento.solicitud_id
    AND s.solicitante_id=f025.authenticated_actor() AND s.estado IN ('BORRADOR','OBSERVADA')));
GRANT SELECT, INSERT ON f025.documento TO f025_policy;

ALTER TABLE f025.activacion ENABLE ROW LEVEL SECURITY;
ALTER TABLE f025.activacion FORCE ROW LEVEL SECURITY;
CREATE POLICY f025_activacion_executor ON f025.activacion
  FOR ALL TO f025_activation_executor
  USING (solicitud_id=NULLIF(current_setting('app.f025_application_id',true),'')::uuid)
  WITH CHECK (solicitud_id=NULLIF(current_setting('app.f025_application_id',true),'')::uuid
    AND revisor_id=f025.authenticated_actor());
GRANT SELECT, INSERT ON f025.activacion TO f025_activation_executor;

ALTER TABLE f025.farmacia_perfil ENABLE ROW LEVEL SECURITY;
ALTER TABLE f025.farmacia_perfil FORCE ROW LEVEL SECURITY;
CREATE POLICY f025_perfil_tenant_read ON f025.farmacia_perfil
  FOR SELECT TO f01_runtime
  USING (farmacia_id=NULLIF(current_setting('app.farmacia_id',true),'')::uuid
    AND EXISTS (SELECT 1 FROM f01.usuario_farmacia m
      JOIN f01.farmacia_referencia f ON f.id=m.farmacia_id
      WHERE m.farmacia_id=farmacia_perfil.farmacia_id
        AND m.usuario_id=f025.authenticated_actor()
        AND m.estado='ACTIVA' AND f.estado='ACTIVA'));
CREATE POLICY f025_perfil_activation ON f025.farmacia_perfil
  FOR INSERT TO f025_activation_executor
  WITH CHECK (EXISTS (SELECT 1 FROM f025.solicitud s
    WHERE s.id=NULLIF(current_setting('app.f025_application_id',true),'')::uuid
      AND s.farmacia_activada_id=farmacia_perfil.farmacia_id));
GRANT SELECT ON f025.farmacia_perfil TO f01_runtime;
GRANT INSERT ON f025.farmacia_perfil TO f025_activation_executor;

REVOKE CREATE ON SCHEMA f025 FROM f025_policy;
