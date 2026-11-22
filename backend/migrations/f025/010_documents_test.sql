-- Synthetic private attachments only in the dedicated F02.5 TEST cluster.
CREATE FUNCTION f025.add_test_document(p_application uuid,p_type text,p_key text,
  p_size integer,p_sha text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,f025 AS $fn$
DECLARE v_id uuid;
BEGIN
  IF current_setting('cluster_name')<>'farmafind-f025-test' OR
    current_database() !~ '^farmafind_f01_test_[a-f0-9]{12}$' OR
    (SELECT description FROM pg_shdescription WHERE objoid=(SELECT oid FROM pg_database
      WHERE datname=current_database())) IS DISTINCT FROM 'FarmaFind F07 TEST efimera' THEN
    RAISE EXCEPTION 'F02.5: solo TEST' USING ERRCODE='42501';
  END IF;
  IF f025.authenticated_actor() IS NULL OR p_application IS NULL OR
    p_type NOT IN ('application/pdf','image/png','image/jpeg') OR
    p_key !~ '^[a-f0-9]{32,128}$' OR p_size NOT BETWEEN 1 AND 5242880 OR
    p_sha !~ '^[a-f0-9]{64}$' OR NOT EXISTS (
      SELECT 1 FROM f025.solicitud s WHERE s.id=p_application
        AND s.solicitante_id=f025.authenticated_actor()
        AND s.estado IN ('BORRADOR','OBSERVADA')) THEN
    RAISE EXCEPTION 'F02.5: adjunto no autorizado' USING ERRCODE='42501';
  END IF;
  INSERT INTO f025.documento(solicitud_id,tipo,storage_key,tamano_bytes,sha256_hex,expires_at)
    VALUES(p_application,p_type,p_key,p_size,p_sha,now()+interval '7 days') RETURNING id INTO v_id;
  RETURN v_id;
END $fn$;
ALTER FUNCTION f025.add_test_document(uuid,text,text,integer,text) OWNER TO f025_policy;
REVOKE ALL ON FUNCTION f025.add_test_document(uuid,text,text,integer,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION f025.add_test_document(uuid,text,text,integer,text) TO f01_runtime;

CREATE FUNCTION f025.read_test_document(p_application uuid,p_document uuid)
RETURNS TABLE(storage_key text,tipo text,tamano_bytes integer,sha256_hex text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,f025 AS $fn$
BEGIN
  IF current_setting('cluster_name')<>'farmafind-f025-test' OR
    current_database() !~ '^farmafind_f01_test_[a-f0-9]{12}$' OR
    (SELECT description FROM pg_shdescription WHERE objoid=(SELECT oid FROM pg_database
      WHERE datname=current_database())) IS DISTINCT FROM 'FarmaFind F07 TEST efimera' OR
    f025.authenticated_actor() IS NULL OR
    NOT f025.has_capability('F025_DOCUMENT_READ') OR
    NOT f025.has_capability('F025_APPLICATION_REVIEW') THEN
    RAISE EXCEPTION 'F02.5: documento no visible' USING ERRCODE='42501';
  END IF;
  RETURN QUERY SELECT d.storage_key,d.tipo,d.tamano_bytes,d.sha256_hex
    FROM f025.documento d WHERE d.id=p_document AND d.solicitud_id=p_application
      AND d.expires_at>now();
END $fn$;
ALTER FUNCTION f025.read_test_document(uuid,uuid) OWNER TO f025_policy;
REVOKE ALL ON FUNCTION f025.read_test_document(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION f025.read_test_document(uuid,uuid) TO f01_runtime;
