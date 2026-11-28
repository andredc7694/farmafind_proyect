-- F07.1 P2 (F071-FR-008, D-03 A): horario de atención por día, un tramo o «Cerrado», hora de Lima.
-- ADITIVA y propia: tabla nueva; no toca F07 001–006, F02.5 ni search_public_offers (spec 020).
-- Depende de 007 (f07.location_actor). Escritura: propietario (DUENO) con pharmacy.profile.write;
-- lectura privada: pharmacy.profile.read; lectura pública: solo farmacias ACTIVAS, vía función
-- propiedad de f03_projection_owner (sin BYPASSRLS).

CREATE TABLE f07.horario_atencion (
  farmacia_id uuid NOT NULL REFERENCES f01.farmacia_referencia(id) ON DELETE RESTRICT,
  dia smallint NOT NULL CHECK (dia BETWEEN 1 AND 7),            -- ISO: 1 lunes … 7 domingo
  cerrado boolean NOT NULL,
  abre time without time zone,
  cierra time without time zone,
  version bigint NOT NULL CHECK (version > 0),
  actualizado_por uuid NOT NULL REFERENCES f01.usuario(id) ON DELETE RESTRICT,
  actualizado_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (farmacia_id, dia),
  CONSTRAINT horario_tramo_valido CHECK (
    (cerrado AND abre IS NULL AND cierra IS NULL) OR
    (NOT cerrado AND abre IS NOT NULL AND cierra IS NOT NULL AND abre < cierra))
);
ALTER TABLE f07.horario_atencion ENABLE ROW LEVEL SECURITY;
ALTER TABLE f07.horario_atencion FORCE ROW LEVEL SECURITY;
REVOKE ALL ON f07.horario_atencion FROM PUBLIC;
GRANT SELECT, INSERT (farmacia_id, dia, cerrado, abre, cierra, version, actualizado_por),
  UPDATE (cerrado, abre, cierra, version, actualizado_por, actualizado_at)
  ON f07.horario_atencion TO f01_runtime;

-- Condición común: actor autenticado, DUEÑO activo de esa farmacia activa, en el contexto de
-- esa farmacia y con la capacidad pedida vigente. f01_runtime ya ve solo sus propias
-- membresías y delegaciones por las políticas de F01.
CREATE FUNCTION f07.can_opening_hours(scope_id uuid, requested text) RETURNS boolean
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = pg_catalog, f01, f07
AS $function$
  SELECT requested IN ('pharmacy.profile.read','pharmacy.profile.write')
    AND scope_id::text = NULLIF(current_setting('app.farmacia_id',true),'')
    AND EXISTS (
      SELECT 1 FROM f01.usuario_farmacia m
      JOIN f01.farmacia_referencia f ON f.id=m.farmacia_id
      JOIN f01.delegacion d ON d.membresia_id=m.id AND d.farmacia_id=m.farmacia_id
      WHERE m.farmacia_id=scope_id AND m.usuario_id=f07.location_actor()
        AND m.rol='DUENO' AND m.estado='ACTIVA' AND f.estado='ACTIVA'
        AND d.capacidad=requested AND d.estado='ACTIVA');
$function$;
REVOKE ALL ON FUNCTION f07.can_opening_hours(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION f07.can_opening_hours(uuid,text) TO f01_runtime;

CREATE POLICY horario_lectura_propia ON f07.horario_atencion
  FOR SELECT TO f01_runtime
  USING (f07.can_opening_hours(farmacia_id,'pharmacy.profile.read'));
CREATE POLICY horario_alta_propia ON f07.horario_atencion
  FOR INSERT TO f01_runtime
  WITH CHECK (actualizado_por=f07.location_actor()
    AND f07.can_opening_hours(farmacia_id,'pharmacy.profile.write'));
CREATE POLICY horario_cambio_propio ON f07.horario_atencion
  FOR UPDATE TO f01_runtime
  USING (f07.can_opening_hours(farmacia_id,'pharmacy.profile.write'))
  WITH CHECK (actualizado_por=f07.location_actor()
    AND f07.can_opening_hours(farmacia_id,'pharmacy.profile.write'));
-- Sin DELETE: «Cerrado» se marca por día; la fila nunca se borra.

-- Lectura pública (búsqueda y mapa): solo farmacias ACTIVAS, máximo 50 por consulta.
GRANT SELECT (farmacia_id, dia, cerrado, abre, cierra) ON f07.horario_atencion TO f03_projection_owner;
CREATE POLICY horario_proyeccion_publica ON f07.horario_atencion
  FOR SELECT TO f03_projection_owner
  USING (EXISTS (SELECT 1 FROM f01.farmacia_referencia f
    WHERE f.id=horario_atencion.farmacia_id AND f.estado='ACTIVA'));

CREATE FUNCTION f07.public_opening_hours(p_ids uuid[])
RETURNS TABLE (farmacia_id uuid, dia smallint, cerrado boolean, abre time, cierra time)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, f01, f07
AS $function$
  SELECT h.farmacia_id, h.dia, h.cerrado, h.abre, h.cierra
  FROM f07.horario_atencion h
  WHERE cardinality(p_ids) BETWEEN 1 AND 50 AND h.farmacia_id = ANY(p_ids)
  ORDER BY h.farmacia_id, h.dia;
$function$;
ALTER FUNCTION f07.public_opening_hours(uuid[]) OWNER TO f03_projection_owner;
REVOKE ALL ON FUNCTION f07.public_opening_hours(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION f07.public_opening_hours(uuid[]) TO f01_runtime;
