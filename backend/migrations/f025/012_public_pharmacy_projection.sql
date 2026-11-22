-- F02.5 TEST only: create the minimal F03 public row with each approved pharmacy.
-- No inventory, representative, contact or private profile fields are projected.
GRANT USAGE ON SCHEMA f03 TO f025_activation_executor;
GRANT INSERT (farmacia_id,direccion_texto) ON f03.farmacia_publica
  TO f025_activation_executor;

CREATE POLICY f025_public_pharmacy_activation ON f03.farmacia_publica
  FOR INSERT TO f025_activation_executor WITH CHECK (
    farmacia_id IS NOT NULL AND
    EXISTS (SELECT 1 FROM f025.solicitud s
      WHERE s.id=NULLIF(current_setting('app.f025_application_id',true),'')::uuid
        AND s.estado='APROBADA' AND s.farmacia_activada_id=farmacia_id)
  );

CREATE FUNCTION f025.project_approved_pharmacy() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,f025,f03 AS $fn$
DECLARE v_address text;
BEGIN
  IF current_setting('cluster_name')<>'farmafind-f025-test' OR
    current_database() !~ '^farmafind_f01_test_[a-f0-9]{12}$' OR
    (SELECT description FROM pg_shdescription WHERE objoid=(SELECT oid FROM pg_database
      WHERE datname=current_database())) IS DISTINCT FROM 'FarmaFind F07 TEST efimera' OR
    NEW.solicitud_id IS DISTINCT FROM
      NULLIF(current_setting('app.f025_application_id',true),'')::uuid OR
    NOT f025.has_capability('F025_APPLICATION_DECIDE') OR
    NOT f025.has_capability('F025_PHARMACY_ACTIVATE') THEN
    RAISE EXCEPTION 'F02.5: proyeccion no autorizada' USING ERRCODE='42501';
  END IF;
  SELECT s.direccion INTO v_address FROM f025.solicitud s
    WHERE s.id=NEW.solicitud_id AND s.estado='APROBADA'
      AND s.farmacia_activada_id=NEW.farmacia_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'F02.5: farmacia no aprobada' USING ERRCODE='42501';
  END IF;
  INSERT INTO f03.farmacia_publica(farmacia_id,direccion_texto)
    VALUES(NEW.farmacia_id,v_address);
  RETURN NEW;
END $fn$;
REVOKE ALL ON FUNCTION f025.project_approved_pharmacy() FROM PUBLIC;
CREATE TRIGGER f025_activation_public_projection
  AFTER INSERT ON f025.activacion
  FOR EACH ROW EXECUTE FUNCTION f025.project_approved_pharmacy();
