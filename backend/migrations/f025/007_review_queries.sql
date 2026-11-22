-- Narrow TEST-only platform reads; the runtime cannot SELECT all applications.
CREATE FUNCTION f025.list_applications(p_state text,p_limit integer)
RETURNS TABLE(id uuid,estado text,version integer,nombre_comercial text,solicitante_id uuid)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,f025 AS $fn$
BEGIN
  IF current_setting('cluster_name')<>'farmafind-f025-test' OR
    current_database() !~ '^farmafind_f01_test_[a-f0-9]{12}$' OR
    (SELECT description FROM pg_shdescription WHERE objoid=(SELECT oid FROM pg_database
      WHERE datname=current_database())) IS DISTINCT FROM 'FarmaFind F07 TEST efimera' OR
    NOT f025.has_capability('F025_APPLICATION_READ') OR
    p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 100 OR
    (p_state IS NOT NULL AND p_state NOT IN
      ('BORRADOR','PENDIENTE','EN_REVISION','OBSERVADA','APROBADA','RECHAZADA','CANCELADA')) THEN
    RAISE EXCEPTION 'F02.5: lectura no autorizada' USING ERRCODE='42501';
  END IF;
  RETURN QUERY SELECT s.id,s.estado,s.version,s.nombre_comercial,s.solicitante_id
    FROM f025.solicitud s WHERE p_state IS NULL OR s.estado=p_state
    ORDER BY s.created_at DESC,s.id LIMIT p_limit;
END $fn$;
ALTER FUNCTION f025.list_applications(text,integer) OWNER TO f025_policy;
REVOKE ALL ON FUNCTION f025.list_applications(text,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION f025.list_applications(text,integer) TO f01_runtime;

CREATE FUNCTION f025.read_application(p_application uuid)
RETURNS TABLE(id uuid,estado text,version integer,nombre_comercial text,solicitante_id uuid,
  contacto text,direccion text,departamento text,provincia text,distrito text,
  representante text,ruc text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,f025 AS $fn$
BEGIN
  IF current_setting('cluster_name')<>'farmafind-f025-test' OR
    current_database() !~ '^farmafind_f01_test_[a-f0-9]{12}$' OR
    (SELECT description FROM pg_shdescription WHERE objoid=(SELECT oid FROM pg_database
      WHERE datname=current_database())) IS DISTINCT FROM 'FarmaFind F07 TEST efimera' OR
    p_application IS NULL OR NOT f025.has_capability('F025_APPLICATION_REVIEW') THEN
    RAISE EXCEPTION 'F02.5: detalle no autorizado' USING ERRCODE='42501';
  END IF;
  RETURN QUERY SELECT s.id,s.estado,s.version,s.nombre_comercial,s.solicitante_id,
    s.contacto,s.direccion,s.departamento,s.provincia,s.distrito,s.representante,s.ruc
    FROM f025.solicitud s WHERE s.id=p_application;
END $fn$;
ALTER FUNCTION f025.read_application(uuid) OWNER TO f025_policy;
REVOKE ALL ON FUNCTION f025.read_application(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION f025.read_application(uuid) TO f01_runtime;
