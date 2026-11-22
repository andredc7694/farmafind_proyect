-- Editable owner draft/observation, without granting runtime direct status/version writes.
CREATE FUNCTION f025.edit_application(p_id uuid,p_version integer,p_name text,p_contact text,
  p_address text,p_department text,p_province text,p_district text,p_representative text,p_ruc text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,f025 AS $fn$
DECLARE v_request f025.solicitud%ROWTYPE; v_actor uuid;
BEGIN
  IF current_setting('cluster_name')<>'farmafind-f025-test' OR
    current_database() !~ '^farmafind_f01_test_[a-f0-9]{12}$' OR
    (SELECT description FROM pg_shdescription WHERE objoid=(SELECT oid FROM pg_database
      WHERE datname=current_database())) IS DISTINCT FROM 'FarmaFind F07 TEST efimera' THEN
    RAISE EXCEPTION 'F02.5: solo base efimera TEST' USING ERRCODE='42501';
  END IF;
  v_actor:=f025.authenticated_actor();
  IF v_actor IS NULL OR p_id IS NULL OR p_version IS NULL OR p_version<1 OR
    p_name IS NULL OR char_length(btrim(p_name)) NOT BETWEEN 1 AND 160 OR
    p_contact IS NULL OR char_length(btrim(p_contact)) NOT BETWEEN 1 AND 160 OR
    p_address IS NULL OR char_length(btrim(p_address)) NOT BETWEEN 1 AND 240 OR
    p_department IS NULL OR char_length(btrim(p_department)) NOT BETWEEN 1 AND 100 OR
    p_province IS NULL OR char_length(btrim(p_province)) NOT BETWEEN 1 AND 100 OR
    p_district IS NULL OR char_length(btrim(p_district)) NOT BETWEEN 1 AND 100 OR
    p_representative IS NULL OR char_length(btrim(p_representative)) NOT BETWEEN 1 AND 160 OR
    (p_ruc IS NOT NULL AND char_length(btrim(p_ruc)) NOT BETWEEN 1 AND 20) THEN
    RAISE EXCEPTION 'F02.5: entrada no valida' USING ERRCODE='22023';
  END IF;
  SELECT * INTO v_request FROM f025.solicitud s WHERE s.id=p_id FOR UPDATE;
  IF NOT FOUND OR v_request.solicitante_id<>v_actor OR
    v_request.estado NOT IN ('BORRADOR','OBSERVADA') THEN
    RAISE EXCEPTION 'F02.5: solicitud no visible' USING ERRCODE='42501';
  END IF;
  IF v_request.version<>p_version THEN
    RAISE EXCEPTION 'F02.5: version en conflicto' USING ERRCODE='40001';
  END IF;
  UPDATE f025.solicitud s SET nombre_comercial=btrim(p_name),contacto=btrim(p_contact),
    direccion=btrim(p_address),departamento=btrim(p_department),provincia=btrim(p_province),
    distrito=btrim(p_district),representante=btrim(p_representative),
    ruc=CASE WHEN p_ruc IS NULL THEN NULL ELSE btrim(p_ruc) END,
    version=s.version+1,updated_at=now() WHERE s.id=p_id;
  RETURN p_version+1;
END $fn$;
ALTER FUNCTION f025.edit_application(uuid,integer,text,text,text,text,text,text,text,text)
  OWNER TO f025_policy;
REVOKE ALL ON FUNCTION f025.edit_application(uuid,integer,text,text,text,text,text,text,text,text)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION f025.edit_application(uuid,integer,text,text,text,text,text,text,text,text)
  TO f01_runtime;
