-- TEST-only owner inventory permissions approved for F02.5. The activation
-- executor is NOLOGIN/NOBYPASSRLS and cannot be assumed by the runtime role.
GRANT INSERT (membresia_id, farmacia_id, capacidad, estado, granted_by_usuario_id)
  ON f01.delegacion TO f025_activation_executor;

CREATE POLICY f025_owner_inventory_insert ON f01.delegacion
  FOR INSERT TO f025_activation_executor
  WITH CHECK (
    estado='ACTIVA'
    AND capacidad IN ('inventory.read','inventory.write','inventory.import.preview',
      'inventory.import.confirm','inventory.history')
    AND granted_by_usuario_id=f025.authenticated_actor()
    AND EXISTS (
      SELECT 1 FROM f025.activacion a
      JOIN f025.solicitud s ON s.id=a.solicitud_id
      JOIN f01.usuario_farmacia m ON m.id=a.membresia_dueno_id
      WHERE a.solicitud_id=NULLIF(current_setting('app.f025_application_id',true),'')::uuid
        AND a.membresia_dueno_id=delegacion.membresia_id
        AND a.farmacia_id=delegacion.farmacia_id
        AND a.revisor_id=delegacion.granted_by_usuario_id
        AND s.solicitante_id=m.usuario_id
        AND s.farmacia_activada_id=a.farmacia_id
        AND s.estado='APROBADA'
        AND m.farmacia_id=a.farmacia_id AND m.rol='DUENO' AND m.estado='ACTIVA'
    )
  );

CREATE FUNCTION f025.grant_owner_inventory_test() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER
SET search_path = pg_catalog, f01, f025
AS $function$
DECLARE capability text;
BEGIN
  IF current_setting('cluster_name') <> 'farmafind-f025-test'
     OR current_database() !~ '^farmafind_f01_test_[a-f0-9]{12}$'
     OR NEW.solicitud_id IS DISTINCT FROM
        NULLIF(current_setting('app.f025_application_id',true),'')::uuid
     OR NEW.revisor_id IS DISTINCT FROM f025.authenticated_actor() THEN
    RAISE EXCEPTION 'F02.5: delegacion TEST no autorizada' USING ERRCODE='42501';
  END IF;
  FOREACH capability IN ARRAY ARRAY['inventory.read','inventory.write',
    'inventory.import.preview','inventory.import.confirm','inventory.history'] LOOP
    INSERT INTO f01.delegacion(membresia_id,farmacia_id,capacidad,estado,granted_by_usuario_id)
      VALUES(NEW.membresia_dueno_id,NEW.farmacia_id,capability,'ACTIVA',NEW.revisor_id);
  END LOOP;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION f025.grant_owner_inventory_test() FROM PUBLIC;
CREATE TRIGGER f025_owner_inventory_after_activation
  AFTER INSERT ON f025.activacion
  FOR EACH ROW EXECUTE FUNCTION f025.grant_owner_inventory_test();
