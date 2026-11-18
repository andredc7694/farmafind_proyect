-- Add a bounded public source for proximity; NULL city means verified positions only.
CREATE OR REPLACE FUNCTION f07.list_public_pharmacies(p_city text)
RETURNS TABLE (farmacia_id uuid, farmacia_nombre text, farmacia_direccion text,
  ciudad text, farmacia_latitud numeric, farmacia_longitud numeric,
  ubicacion_verificada boolean, actualizado_en timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, f01, f03, f07
AS $body$
  SELECT f.id,f.nombre_publico,p.direccion_texto,p.ciudad,
    CASE WHEN p.estado_ubicacion='PUBLICADA_VERIFICADA' THEN p.latitud ELSE NULL END,
    CASE WHEN p.estado_ubicacion='PUBLICADA_VERIFICADA' THEN p.longitud ELSE NULL END,
    p.estado_ubicacion='PUBLICADA_VERIFICADA',p.updated_at
  FROM f01.farmacia_referencia f
  JOIN f03.farmacia_publica p ON p.farmacia_id=f.id
  WHERE f.estado='ACTIVA' AND
    ((p_city IS NOT NULL AND p.ciudad=p_city) OR
     (p_city IS NULL AND p.estado_ubicacion='PUBLICADA_VERIFICADA'))
  ORDER BY f.nombre_publico,f.id
  LIMIT 200
$body$;
ALTER FUNCTION f07.list_public_pharmacies(text) OWNER TO f03_projection_owner;
REVOKE ALL ON FUNCTION f07.list_public_pharmacies(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION f07.list_public_pharmacies(text) TO f01_runtime;
