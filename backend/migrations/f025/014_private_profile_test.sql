-- F02.5 TEST only: explicit owner grants and an audited, versioned contact update.
-- The previous permissive SELECT policy must be replaced, not supplemented (RLS OR semantics).
DO $guard$ BEGIN
  IF current_setting('cluster_name') <> 'farmafind-f025-test'
     OR current_database() !~ '^farmafind_f01_test_[a-f0-9]{12}$'
     OR (SELECT description FROM pg_shdescription WHERE objoid=(SELECT oid FROM pg_database
       WHERE datname=current_database())) IS DISTINCT FROM 'FarmaFind F07 TEST efimera' THEN
    RAISE EXCEPTION 'F02.5: perfil solo en base efimera TEST' USING ERRCODE='42501';
  END IF;
END $guard$;

CREATE POLICY f025_owner_profile_grant ON f01.delegacion
  FOR INSERT TO f025_activation_executor
  WITH CHECK (estado='ACTIVA' AND capacidad IN ('pharmacy.profile.read','pharmacy.profile.write')
    AND granted_by_usuario_id=f025.authenticated_actor()
    AND EXISTS (SELECT 1 FROM f025.activacion a
      JOIN f025.solicitud s ON s.id=a.solicitud_id
      JOIN f01.usuario_farmacia m ON m.id=a.membresia_dueno_id
      WHERE a.solicitud_id=NULLIF(current_setting('app.f025_application_id',true),'')::uuid
        AND a.membresia_dueno_id=delegacion.membresia_id
        AND a.farmacia_id=delegacion.farmacia_id
        AND a.revisor_id=delegacion.granted_by_usuario_id
        AND s.solicitante_id=m.usuario_id AND s.estado='APROBADA'
        AND m.farmacia_id=a.farmacia_id AND m.rol='DUENO' AND m.estado='ACTIVA'));

CREATE FUNCTION f025.grant_owner_profile_test() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,f01,f025 AS $function$
DECLARE capability text;
BEGIN
  IF current_setting('cluster_name') <> 'farmafind-f025-test'
     OR current_database() !~ '^farmafind_f01_test_[a-f0-9]{12}$'
     OR (SELECT description FROM pg_shdescription WHERE objoid=(SELECT oid FROM pg_database
       WHERE datname=current_database())) IS DISTINCT FROM 'FarmaFind F07 TEST efimera'
     OR NEW.solicitud_id IS DISTINCT FROM NULLIF(current_setting('app.f025_application_id',true),'')::uuid
     OR NEW.revisor_id IS DISTINCT FROM f025.authenticated_actor()
     OR NOT f025.has_capability('F025_APPLICATION_DECIDE')
     OR NOT f025.has_capability('F025_PHARMACY_ACTIVATE') THEN
    RAISE EXCEPTION 'F02.5: perfil TEST no autorizado' USING ERRCODE='42501';
  END IF;
  FOREACH capability IN ARRAY ARRAY['pharmacy.profile.read','pharmacy.profile.write'] LOOP
    INSERT INTO f01.delegacion(membresia_id,farmacia_id,capacidad,estado,granted_by_usuario_id)
      VALUES(NEW.membresia_dueno_id,NEW.farmacia_id,capability,'ACTIVA',NEW.revisor_id);
  END LOOP;
  RETURN NEW;
END $function$;
REVOKE ALL ON FUNCTION f025.grant_owner_profile_test() FROM PUBLIC;
CREATE TRIGGER f025_owner_profile_after_activation AFTER INSERT ON f025.activacion
  FOR EACH ROW EXECUTE FUNCTION f025.grant_owner_profile_test();

DROP POLICY f025_perfil_tenant_read ON f025.farmacia_perfil;
CREATE POLICY f025_perfil_tenant_read ON f025.farmacia_perfil
  FOR SELECT TO f01_runtime
  USING (farmacia_id=NULLIF(current_setting('app.farmacia_id',true),'')::uuid
    AND f025.authenticated_actor() IS NOT NULL
    AND EXISTS (SELECT 1 FROM f01.usuario_farmacia m
      JOIN f01.farmacia_referencia f ON f.id=m.farmacia_id
      JOIN f01.delegacion d ON d.membresia_id=m.id AND d.farmacia_id=m.farmacia_id
      WHERE m.farmacia_id=farmacia_perfil.farmacia_id
        AND m.usuario_id=f025.authenticated_actor() AND m.rol='DUENO'
        AND m.estado='ACTIVA' AND f.estado='ACTIVA'
        AND d.capacidad='pharmacy.profile.read' AND d.estado='ACTIVA'));
CREATE POLICY f025_perfil_tenant_contact_update ON f025.farmacia_perfil
  FOR UPDATE TO f01_runtime
  USING (farmacia_id=NULLIF(current_setting('app.farmacia_id',true),'')::uuid
    AND f025.authenticated_actor() IS NOT NULL
    AND EXISTS (SELECT 1 FROM f01.usuario_farmacia m
      JOIN f01.delegacion r ON r.membresia_id=m.id AND r.farmacia_id=m.farmacia_id
      JOIN f01.delegacion w ON w.membresia_id=m.id AND w.farmacia_id=m.farmacia_id
      WHERE m.farmacia_id=farmacia_perfil.farmacia_id
        AND m.usuario_id=f025.authenticated_actor() AND m.rol='DUENO' AND m.estado='ACTIVA'
        AND r.capacidad='pharmacy.profile.read' AND r.estado='ACTIVA'
        AND w.capacidad='pharmacy.profile.write' AND w.estado='ACTIVA'))
  WITH CHECK (farmacia_id=NULLIF(current_setting('app.farmacia_id',true),'')::uuid
    AND f025.authenticated_actor() IS NOT NULL
    AND EXISTS (SELECT 1 FROM f01.usuario_farmacia m
      JOIN f01.delegacion r ON r.membresia_id=m.id AND r.farmacia_id=m.farmacia_id
      JOIN f01.delegacion w ON w.membresia_id=m.id AND w.farmacia_id=m.farmacia_id
      WHERE m.farmacia_id=farmacia_perfil.farmacia_id
        AND m.usuario_id=f025.authenticated_actor() AND m.rol='DUENO' AND m.estado='ACTIVA'
        AND r.capacidad='pharmacy.profile.read' AND r.estado='ACTIVA'
        AND w.capacidad='pharmacy.profile.write' AND w.estado='ACTIVA'));
GRANT UPDATE (contacto,version,updated_at) ON f025.farmacia_perfil TO f01_runtime;

CREATE TABLE f025.perfil_cambio (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farmacia_id uuid NOT NULL REFERENCES f025.farmacia_perfil(farmacia_id) ON DELETE RESTRICT,
  actor_id uuid NOT NULL REFERENCES f01.usuario(id) ON DELETE RESTRICT,
  version_anterior integer NOT NULL,
  version_nueva integer NOT NULL CHECK (version_nueva=version_anterior+1),
  correlation_id uuid NOT NULL,
  cambiado_en timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON f025.perfil_cambio FROM PUBLIC;
ALTER TABLE f025.perfil_cambio ENABLE ROW LEVEL SECURITY;
ALTER TABLE f025.perfil_cambio FORCE ROW LEVEL SECURITY;
GRANT INSERT ON f025.perfil_cambio TO f025_policy;
CREATE POLICY f025_perfil_cambio_write ON f025.perfil_cambio FOR INSERT TO f025_policy
  WITH CHECK (actor_id=f025.authenticated_actor()
    AND farmacia_id=NULLIF(current_setting('app.farmacia_id',true),'')::uuid);

CREATE FUNCTION f025.audit_profile_contact() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,f01,f025 AS $function$
BEGIN
  IF NEW.farmacia_id IS DISTINCT FROM OLD.farmacia_id OR
     NEW.direccion IS DISTINCT FROM OLD.direccion OR
     NEW.departamento IS DISTINCT FROM OLD.departamento OR
     NEW.provincia IS DISTINCT FROM OLD.provincia OR
     NEW.distrito IS DISTINCT FROM OLD.distrito OR
     NEW.version IS DISTINCT FROM OLD.version+1 OR
     NEW.contacto IS NOT DISTINCT FROM OLD.contacto OR
     current_setting('app.f025_profile_correlation',true) IS NULL OR
     f025.authenticated_actor() IS NULL THEN
    RAISE EXCEPTION 'F02.5: edición de perfil no autorizada' USING ERRCODE='42501';
  END IF;
  NEW.updated_at:=now();
  INSERT INTO f025.perfil_cambio(farmacia_id,actor_id,version_anterior,version_nueva,correlation_id)
    VALUES(OLD.farmacia_id,f025.authenticated_actor(),OLD.version,NEW.version,
      current_setting('app.f025_profile_correlation',true)::uuid);
  RETURN NEW;
END $function$;
ALTER FUNCTION f025.audit_profile_contact() OWNER TO f025_policy;
REVOKE ALL ON FUNCTION f025.audit_profile_contact() FROM PUBLIC;
CREATE TRIGGER f025_profile_contact_audit BEFORE UPDATE ON f025.farmacia_perfil
  FOR EACH ROW EXECUTE FUNCTION f025.audit_profile_contact();
