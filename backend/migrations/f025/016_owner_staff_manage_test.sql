-- F02.5 TEST/DEMO (enmienda F025-RF24): el propietario creado por la activación de una
-- solicitud aprobada recibe «membership.manage» (gestionar su personal), en la misma
-- transacción que su membresía. Aditiva: no edita 009/013/014 ni sus políticas.
-- Solo DUENO de la activación; nunca TRABAJADOR ni administrador global (sin membresía).
DO $guard$ BEGIN
  IF current_setting('cluster_name') <> 'farmafind-f025-test'
     OR current_database() !~ '^farmafind_f01_test_[a-f0-9]{12}$'
     OR (SELECT description FROM pg_shdescription WHERE objoid=(SELECT oid FROM pg_database
       WHERE datname=current_database())) IS DISTINCT FROM 'FarmaFind F07 TEST efimera' THEN
    RAISE EXCEPTION 'F02.5: gestion de personal solo en base efimera TEST' USING ERRCODE='42501';
  END IF;
END $guard$;

-- 1) Política de alta, mismo patrón que 009/013/014, limitada a una sola capacidad.
CREATE POLICY f025_owner_staff_manage_insert ON f01.delegacion
  FOR INSERT TO f025_activation_executor
  WITH CHECK (estado='ACTIVA' AND capacidad='membership.manage'
    AND granted_by_usuario_id=f025.authenticated_actor()
    AND EXISTS (SELECT 1 FROM f025.activacion a
      JOIN f025.solicitud s ON s.id=a.solicitud_id
      JOIN f01.usuario_farmacia m ON m.id=a.membresia_dueno_id
      WHERE a.solicitud_id=NULLIF(current_setting('app.f025_application_id',true),'')::uuid
        AND a.membresia_dueno_id=delegacion.membresia_id
        AND a.farmacia_id=delegacion.farmacia_id
        AND a.revisor_id=delegacion.granted_by_usuario_id
        AND s.solicitante_id=m.usuario_id
        AND s.farmacia_activada_id=a.farmacia_id
        AND s.estado='APROBADA'
        AND m.farmacia_id=a.farmacia_id AND m.rol='DUENO' AND m.estado='ACTIVA'));

-- 2) Disparador de activación: concede la capacidad junto con las de inventario y reservas.
CREATE FUNCTION f025.grant_owner_staff_manage_test() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,f01,f025 AS $function$
BEGIN
  IF current_setting('cluster_name') <> 'farmafind-f025-test'
     OR current_database() !~ '^farmafind_f01_test_[a-f0-9]{12}$'
     OR (SELECT description FROM pg_shdescription WHERE objoid=(SELECT oid FROM pg_database
       WHERE datname=current_database())) IS DISTINCT FROM 'FarmaFind F07 TEST efimera'
     OR NEW.solicitud_id IS DISTINCT FROM NULLIF(current_setting('app.f025_application_id',true),'')::uuid
     OR NEW.revisor_id IS DISTINCT FROM f025.authenticated_actor()
     OR NOT f025.has_capability('F025_APPLICATION_DECIDE')
     OR NOT f025.has_capability('F025_PHARMACY_ACTIVATE') THEN
    RAISE EXCEPTION 'F02.5: gestion de personal TEST no autorizada' USING ERRCODE='42501';
  END IF;
  INSERT INTO f01.delegacion(membresia_id,farmacia_id,capacidad,estado,granted_by_usuario_id)
    VALUES(NEW.membresia_dueno_id,NEW.farmacia_id,'membership.manage','ACTIVA',NEW.revisor_id);
  RETURN NEW;
END $function$;
REVOKE ALL ON FUNCTION f025.grant_owner_staff_manage_test() FROM PUBLIC;
CREATE TRIGGER f025_owner_staff_manage_after_activation AFTER INSERT ON f025.activacion
  FOR EACH ROW EXECUTE FUNCTION f025.grant_owner_staff_manage_test();

-- 3) Reparación única de farmacias ya activadas (p. ej. HUAMANFAR), en esta misma transacción.
--    Concede las capacidades que hoy reciben las activaciones nuevas y que pudieron faltar:
--    membership.manage (esta migración) y pharmacy.profile.read/write (014, posterior a
--    activaciones antiguas). Solo propietario vigente de una activación aprobada; si ya tiene la
--    fila (vigente o revocada a propósito) no se toca. La delegación se atribuye al revisor
--    original; la auditoría CAPABILITY_GRANT va sin actor humano (la aplica la migración), una por
--    alta y con correlación común. Repetible: una segunda ejecución no encuentra filas.
DO $repair$
DECLARE correlation uuid := gen_random_uuid(); fila record;
BEGIN
  FOR fila IN
    SELECT a.membresia_dueno_id, a.farmacia_id, a.revisor_id, m.usuario_id, c.capacidad
    FROM f025.activacion a
    JOIN f025.solicitud s ON s.id=a.solicitud_id
    JOIN f01.usuario_farmacia m ON m.id=a.membresia_dueno_id
    JOIN f01.farmacia_referencia f ON f.id=a.farmacia_id
    CROSS JOIN (VALUES ('membership.manage'),('pharmacy.profile.read'),
      ('pharmacy.profile.write')) AS c(capacidad)
    WHERE s.estado='APROBADA' AND s.farmacia_activada_id=a.farmacia_id
      AND s.solicitante_id=m.usuario_id
      AND m.farmacia_id=a.farmacia_id AND m.rol='DUENO' AND m.estado='ACTIVA'
      AND f.estado='ACTIVA'
      AND NOT EXISTS (SELECT 1 FROM f01.delegacion d
        WHERE d.membresia_id=a.membresia_dueno_id AND d.capacidad=c.capacidad)
    ORDER BY a.farmacia_id, c.capacidad
  LOOP
    INSERT INTO f01.delegacion(membresia_id,farmacia_id,capacidad,estado,granted_by_usuario_id)
      VALUES(fila.membresia_dueno_id,fila.farmacia_id,fila.capacidad,'ACTIVA',fila.revisor_id);
    INSERT INTO f01.auditoria_identidad(actor_usuario_id,objetivo_usuario_id,farmacia_id,
      accion,resultado,correlation_id)
      VALUES(NULL,fila.usuario_id,fila.farmacia_id,'CAPABILITY_GRANT','PERMITIDO',correlation);
  END LOOP;
END $repair$;
