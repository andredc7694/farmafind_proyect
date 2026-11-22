-- F02.5 TEST/DEMO: four approved F04 capabilities for the newly activated owner.
-- Existing inventory grants and F04 policies remain unchanged.
CREATE POLICY f025_owner_reservations_insert ON f01.delegacion
  FOR INSERT TO f025_activation_executor
  WITH CHECK (
    estado='ACTIVA'
    AND capacidad IN ('reservation.read','reservation.accept',
      'reservation.deliver','reservation.settings')
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

CREATE FUNCTION f025.grant_owner_reservations_test() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER
SET search_path = pg_catalog, f01, f025
AS $function$
DECLARE capability text;
BEGIN
  IF current_setting('cluster_name') <> 'farmafind-f025-test'
     OR current_database() !~ '^farmafind_f01_test_[a-f0-9]{12}$'
     OR (SELECT description FROM pg_shdescription WHERE objoid=(SELECT oid FROM pg_database
       WHERE datname=current_database())) IS DISTINCT FROM 'FarmaFind F07 TEST efimera'
     OR NEW.solicitud_id IS DISTINCT FROM
        NULLIF(current_setting('app.f025_application_id',true),'')::uuid
     OR NEW.revisor_id IS DISTINCT FROM f025.authenticated_actor()
     OR NOT f025.has_capability('F025_APPLICATION_DECIDE')
     OR NOT f025.has_capability('F025_PHARMACY_ACTIVATE') THEN
    RAISE EXCEPTION 'F02.5: delegacion de reservas TEST no autorizada' USING ERRCODE='42501';
  END IF;
  FOREACH capability IN ARRAY ARRAY['reservation.read','reservation.accept',
    'reservation.deliver','reservation.settings'] LOOP
    INSERT INTO f01.delegacion(membresia_id,farmacia_id,capacidad,estado,granted_by_usuario_id)
      VALUES(NEW.membresia_dueno_id,NEW.farmacia_id,capability,'ACTIVA',NEW.revisor_id);
  END LOOP;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION f025.grant_owner_reservations_test() FROM PUBLIC;
CREATE TRIGGER f025_owner_reservations_after_activation
  AFTER INSERT ON f025.activacion
  FOR EACH ROW EXECUTE FUNCTION f025.grant_owner_reservations_test();
