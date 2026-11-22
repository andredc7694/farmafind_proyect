-- A narrow, transaction-local TEST-only activation. Never run on farmafind_f01_test.
-- The executor is NOLOGIN/NOBYPASSRLS and is not granted to f01_runtime.
GRANT USAGE ON SCHEMA f01 TO f025_activation_executor;
GRANT SELECT (id, estado) ON f01.usuario TO f025_activation_executor;
GRANT SELECT (id, estado) ON f01.farmacia_referencia TO f025_activation_executor;
GRANT INSERT (nombre_publico) ON f01.farmacia_referencia TO f025_activation_executor;
GRANT SELECT (id, usuario_id, farmacia_id, rol, estado)
  ON f01.usuario_farmacia TO f025_activation_executor;
GRANT INSERT (usuario_id, farmacia_id, rol, estado, changed_by_usuario_id)
  ON f01.usuario_farmacia TO f025_activation_executor;

CREATE POLICY f025_first_owner_read ON f01.usuario_farmacia
  FOR SELECT TO f025_activation_executor
  USING (rol='DUENO' AND EXISTS (SELECT 1 FROM f025.solicitud s
    WHERE s.id=NULLIF(current_setting('app.f025_application_id',true),'')::uuid
      AND s.estado='APROBADA' AND s.solicitante_id=usuario_farmacia.usuario_id
      AND s.farmacia_activada_id=usuario_farmacia.farmacia_id));
CREATE POLICY f025_first_owner_insert ON f01.usuario_farmacia
  FOR INSERT TO f025_activation_executor
  WITH CHECK (rol='DUENO' AND estado='ACTIVA' AND EXISTS (SELECT 1 FROM f025.solicitud s
    WHERE s.id=NULLIF(current_setting('app.f025_application_id',true),'')::uuid
      AND s.estado='APROBADA' AND s.solicitante_id=usuario_farmacia.usuario_id
      AND s.farmacia_activada_id=usuario_farmacia.farmacia_id));

CREATE FUNCTION f025.activate_application(application_id uuid, expected_version integer,
  idempotency_key text, decision_reason text, correlation uuid)
RETURNS TABLE(activated_farmacia_id uuid, owner_membership_id uuid)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, f01, f025
AS $function$
DECLARE
  actor uuid;
  request_row f025.solicitud%ROWTYPE;
  previous f025.activacion%ROWTYPE;
  pharmacy uuid;
  membership uuid;
  test_marker text;
BEGIN
  IF current_setting('cluster_name') <> 'farmafind-f025-test' OR
     current_database() !~ '^farmafind_f01_test_[a-f0-9]{12}$' THEN
    RAISE EXCEPTION 'F02.5: solo base efimera TEST' USING ERRCODE='42501';
  END IF;
  SELECT description INTO test_marker FROM pg_shdescription
    WHERE objoid=(SELECT oid FROM pg_database WHERE datname=current_database());
  IF test_marker IS DISTINCT FROM 'FarmaFind F07 TEST efimera' THEN
    RAISE EXCEPTION 'F02.5: marca TEST ausente' USING ERRCODE='42501';
  END IF;
  actor := f025.authenticated_actor();
  IF actor IS NULL OR NOT f025.has_capability('F025_APPLICATION_DECIDE') OR
     NOT f025.has_capability('F025_PHARMACY_ACTIVATE') OR
     application_id IS NULL OR expected_version IS NULL OR expected_version < 1 OR
     idempotency_key IS NULL OR char_length(idempotency_key) NOT BETWEEN 16 AND 200 OR
     decision_reason IS NULL OR char_length(btrim(decision_reason)) NOT BETWEEN 8 AND 500 OR
     correlation IS NULL THEN
    RAISE EXCEPTION 'F02.5: aprobación no autorizada' USING ERRCODE='42501';
  END IF;
  PERFORM set_config('app.f025_application_id',application_id::text,true);
  SELECT * INTO request_row FROM f025.solicitud s WHERE s.id=application_id FOR UPDATE;
  IF NOT FOUND OR request_row.solicitante_id=actor THEN
    RAISE EXCEPTION 'F02.5: solicitud no visible' USING ERRCODE='42501';
  END IF;
  SELECT * INTO previous FROM f025.activacion a WHERE a.solicitud_id=application_id;
  IF FOUND THEN
    IF previous.idempotency_key<>idempotency_key OR request_row.estado<>'APROBADA' THEN
      RAISE EXCEPTION 'F02.5: aprobación duplicada incompatible' USING ERRCODE='23505';
    END IF;
    activated_farmacia_id:=previous.farmacia_id;
    owner_membership_id:=previous.membresia_dueno_id;
    RETURN NEXT;
    RETURN;
  END IF;
  IF request_row.estado<>'EN_REVISION' OR request_row.version<>expected_version THEN
    RAISE EXCEPTION 'F02.5: estado o versión en conflicto' USING ERRCODE='40001';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM f01.usuario u
                 WHERE u.id=request_row.solicitante_id AND u.estado='ACTIVO') THEN
    RAISE EXCEPTION 'F02.5: solicitante inactivo' USING ERRCODE='42501';
  END IF;
  INSERT INTO f01.farmacia_referencia(nombre_publico)
    VALUES(request_row.nombre_comercial) RETURNING id INTO pharmacy;
  UPDATE f025.solicitud SET estado='APROBADA', farmacia_activada_id=pharmacy,
    decided_at=now(), updated_at=now(), version=version+1 WHERE id=application_id;
  INSERT INTO f01.usuario_farmacia(usuario_id,farmacia_id,rol,estado,changed_by_usuario_id)
    VALUES(request_row.solicitante_id,pharmacy,'DUENO','ACTIVA',actor)
    RETURNING id INTO membership;
  INSERT INTO f025.farmacia_perfil(farmacia_id,contacto,direccion,departamento,provincia,distrito)
    VALUES(pharmacy,request_row.contacto,request_row.direccion,request_row.departamento,
      request_row.provincia,request_row.distrito);
  INSERT INTO f025.revision(solicitud_id,actor_id,accion,estado_anterior,estado_nuevo,
    motivo,version_anterior,version_nueva,correlation_id)
    VALUES(application_id,actor,'APROBAR','EN_REVISION','APROBADA',decision_reason,
      request_row.version,request_row.version+1,correlation);
  INSERT INTO f025.activacion(solicitud_id,farmacia_id,membresia_dueno_id,revisor_id,
    idempotency_key,correlation_id)
    VALUES(application_id,pharmacy,membership,actor,idempotency_key,correlation);
  activated_farmacia_id:=pharmacy;
  owner_membership_id:=membership;
  RETURN NEXT;
END;
$function$;
ALTER FUNCTION f025.activate_application(uuid,integer,text,text,uuid)
  OWNER TO f025_activation_executor;
REVOKE ALL ON FUNCTION f025.activate_application(uuid,integer,text,text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION f025.activate_application(uuid,integer,text,text,uuid) TO f01_runtime;
REVOKE CREATE ON SCHEMA f025 FROM f025_activation_executor;
