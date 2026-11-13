DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='f03_projection_owner') THEN
    CREATE ROLE f03_projection_owner NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
  END IF;
END $$;

GRANT USAGE ON SCHEMA f01,f02,f03 TO f03_projection_owner;
GRANT USAGE ON SCHEMA f03 TO f01_runtime;
GRANT SELECT (id,nombre_publico,estado) ON f01.farmacia_referencia TO f03_projection_owner;
GRANT SELECT (id,nombre,principio_activo,concentracion,presentacion,clasificacion,estado)
  ON f02.medicamento TO f03_projection_owner;
GRANT SELECT (farmacia_id,medicamento_id,precio_centavos,cantidad_fisica,cantidad_comprometida,ultima_revision_at)
  ON f02.inventario TO f03_projection_owner;
GRANT SELECT (farmacia_id,direccion_texto,latitud,longitud) ON f03.farmacia_publica TO f03_projection_owner;

DROP POLICY IF EXISTS inventario_proyeccion_publica ON f02.inventario;
CREATE POLICY inventario_proyeccion_publica ON f02.inventario FOR SELECT TO f03_projection_owner USING (
  cantidad_fisica > cantidad_comprometida AND
  EXISTS (SELECT 1 FROM f01.farmacia_referencia f WHERE f.id=farmacia_id AND f.estado='ACTIVA') AND
  EXISTS (SELECT 1 FROM f02.medicamento m WHERE m.id=medicamento_id AND m.estado='ACTIVO' AND m.principio_activo IS NOT NULL) AND
  EXISTS (SELECT 1 FROM f03.farmacia_publica p WHERE p.farmacia_id=farmacia_id)
);

DROP POLICY IF EXISTS farmacia_publica_proyeccion ON f03.farmacia_publica;
CREATE POLICY farmacia_publica_proyeccion ON f03.farmacia_publica FOR SELECT TO f03_projection_owner USING (
  EXISTS (SELECT 1 FROM f01.farmacia_referencia f WHERE f.id=farmacia_id AND f.estado='ACTIVA')
);

CREATE OR REPLACE FUNCTION f03.search_public_offers(
  p_query text, p_min_price bigint, p_max_price bigint, p_limit integer
) RETURNS TABLE (
  medicamento_id uuid, nombre_comercial text, principio_activo text, concentracion text,
  presentacion text, clasificacion text, farmacia_id uuid, farmacia_nombre text,
  farmacia_direccion text, farmacia_latitud numeric, farmacia_longitud numeric,
  precio_centavos bigint, ultima_revision timestamptz
) LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, f01, f02, f03
AS $$
  SELECT m.id,m.nombre,m.principio_activo,m.concentracion,m.presentacion,m.clasificacion,
    f.id,f.nombre_publico,p.direccion_texto,p.latitud,p.longitud,i.precio_centavos,i.ultima_revision_at
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
$$;
ALTER FUNCTION f03.search_public_offers(text,bigint,bigint,integer) OWNER TO f03_projection_owner;
REVOKE ALL ON FUNCTION f03.search_public_offers(text,bigint,bigint,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION f03.search_public_offers(text,bigint,bigint,integer) TO f01_runtime;

CREATE OR REPLACE FUNCTION f03.get_public_pharmacy(p_id uuid)
RETURNS TABLE (farmacia_id uuid, farmacia_nombre text, farmacia_direccion text)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, f01, f03
AS $$
  SELECT f.id,f.nombre_publico,p.direccion_texto
  FROM f01.farmacia_referencia f JOIN f03.farmacia_publica p ON p.farmacia_id=f.id
  WHERE f.id=p_id AND f.estado='ACTIVA'
$$;
ALTER FUNCTION f03.get_public_pharmacy(uuid) OWNER TO f03_projection_owner;
REVOKE ALL ON FUNCTION f03.get_public_pharmacy(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION f03.get_public_pharmacy(uuid) TO f01_runtime;
