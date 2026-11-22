-- F03 textual offers survive; only reviewed coordinates may leave the DB.
GRANT USAGE,CREATE ON SCHEMA f07 TO f03_projection_owner;
GRANT SELECT (ciudad,estado_ubicacion,updated_at) ON f03.farmacia_publica TO f03_projection_owner;

CREATE OR REPLACE FUNCTION f03.search_public_offers(
  p_query text, p_min_price bigint, p_max_price bigint, p_limit integer
) RETURNS TABLE (
  medicamento_id uuid, nombre_comercial text, principio_activo text, concentracion text,
  presentacion text, clasificacion text, farmacia_id uuid, farmacia_nombre text,
  farmacia_direccion text, farmacia_latitud numeric, farmacia_longitud numeric,
  precio_centavos bigint, ultima_revision timestamptz
) LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, f01, f02, f03
AS $body$
  SELECT m.id,m.nombre,m.principio_activo,m.concentracion,m.presentacion,m.clasificacion,
    f.id,f.nombre_publico,p.direccion_texto,
    CASE WHEN p.estado_ubicacion='PUBLICADA_VERIFICADA' THEN p.latitud ELSE NULL END,
    CASE WHEN p.estado_ubicacion='PUBLICADA_VERIFICADA' THEN p.longitud ELSE NULL END,
    i.precio_centavos,i.ultima_revision_at
  FROM f02.inventario i
  JOIN f02.medicamento m ON m.id=i.medicamento_id
  JOIN f01.farmacia_referencia f ON f.id=i.farmacia_id
  JOIN f03.farmacia_publica p ON p.farmacia_id=f.id
  WHERE m.estado='ACTIVO' AND f.estado='ACTIVA' AND m.principio_activo IS NOT NULL
    AND i.cantidad_fisica>i.cantidad_comprometida
    AND (position(p_query in m.nombre)>0 OR position(p_query in m.principio_activo)>0)
    AND (p_min_price IS NULL OR i.precio_centavos>=p_min_price)
    AND (p_max_price IS NULL OR i.precio_centavos<=p_max_price)
  ORDER BY m.nombre,m.presentacion,f.id
  LIMIT LEAST(GREATEST(p_limit,1),200)
$body$;
ALTER FUNCTION f03.search_public_offers(text,bigint,bigint,integer) OWNER TO f03_projection_owner;
REVOKE ALL ON FUNCTION f03.search_public_offers(text,bigint,bigint,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION f03.search_public_offers(text,bigint,bigint,integer) TO f01_runtime;

CREATE FUNCTION f07.list_public_pharmacies(p_city text)
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
  WHERE f.estado='ACTIVA' AND p.ciudad=p_city
  ORDER BY f.nombre_publico,f.id
  LIMIT 200
$body$;
ALTER FUNCTION f07.list_public_pharmacies(text) OWNER TO f03_projection_owner;
REVOKE ALL ON FUNCTION f07.list_public_pharmacies(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION f07.list_public_pharmacies(text) TO f01_runtime;
REVOKE CREATE ON SCHEMA f07 FROM f03_projection_owner;
