-- F02.2 (spec 020) · PROPUESTA para revisión de Andre (NO aplicada). Destino tras la aprobación:
--   backend/migrations/f07/011_search_identity_location.sql (copia literal; su SHA-256 se agrega a la
--   lista cerrada F07_APPROVED de migrate.ts).
-- Igual que F07 010 hizo con f03.search_public_offers_terms: reemplaza SOLO la función nueva
-- f03.search_public_offers_identity (F03 004) para devolver coordenadas únicamente si la ubicación está
-- PUBLICADA_VERIFICADA (si no, NULL). No toca F07 001–010. Mismas columnas y misma regla de publicación.
CREATE OR REPLACE FUNCTION f03.search_public_offers_identity(
  p_words text[], p_tokens text[], p_min_price bigint, p_max_price bigint, p_limit integer
) RETURNS TABLE (
  medicamento_id uuid, nombre_comercial text, principio_activo text, concentracion text,
  presentacion text, clasificacion text, forma_farmaceutica text, laboratorio text, marca text,
  farmacia_id uuid, farmacia_nombre text,
  farmacia_direccion text, farmacia_latitud numeric, farmacia_longitud numeric,
  precio_centavos bigint, ultima_revision timestamptz, coincidencias integer
) LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, f01, f02, f03
AS $body$
  WITH entrada AS (
    SELECT coalesce(p_words, '{}'::text[]) AS words, coalesce(p_tokens, '{}'::text[]) AS tokens
  ), candidato AS MATERIALIZED (
    SELECT m.id, m.nombre, m.principio_activo, m.concentracion, m.presentacion, m.clasificacion,
      m.forma_farmaceutica, m.laboratorio, m.marca
    FROM f02.medicamento m
    WHERE m.estado='ACTIVO' AND m.principio_activo IS NOT NULL
      AND EXISTS (SELECT 1 FROM unnest(p_words) w WHERE length(w)>=2 AND (w !~ '^[a-z]+$' OR
        position(w IN translate(lower(concat_ws(' ', m.nombre, m.principio_activo, m.marca)),
          'áàäâãéèëêíìïîóòöôõúùüûñçÁÀÄÂÃÉÈËÊÍÌÏÎÓÒÖÔÕÚÙÜÛÑÇ',
          'aaaaaeeeeiiiiooooouuuuncaaaaaeeeeiiiiooooouuuunc'))>0))
  ), puntaje AS MATERIALIZED (
    SELECT c.*,
      ((SELECT count(*) FROM unnest(e.words) w WHERE length(w)>=2 AND position(w IN t.hay_todo)>0) +
       (SELECT count(*) FROM unnest(e.tokens) k WHERE k = ANY (string_to_array(t.hay_todo, ' '))))::integer AS puntos
    FROM candidato c
    CROSS JOIN LATERAL (SELECT f03.normalize_search_text(concat_ws(' ', c.nombre, c.principio_activo, c.marca)) AS hay_nombre,
      f03.normalize_search_text(concat_ws(' ', c.nombre, c.principio_activo, c.marca, c.concentracion, c.presentacion,
        c.forma_farmaceutica, c.laboratorio)) AS hay_todo) t
    CROSS JOIN entrada e
    WHERE cardinality(e.words) BETWEEN 1 AND 8 AND cardinality(e.tokens) <= 8
      AND EXISTS (SELECT 1 FROM unnest(e.words) w WHERE length(w)>=2 AND position(w IN t.hay_nombre)>0)
  )
  SELECT s.id, s.nombre, s.principio_activo, s.concentracion, s.presentacion, s.clasificacion,
    s.forma_farmaceutica, s.laboratorio, s.marca,
    f.id, f.nombre_publico, p.direccion_texto,
    CASE WHEN p.estado_ubicacion='PUBLICADA_VERIFICADA' THEN p.latitud ELSE NULL END,
    CASE WHEN p.estado_ubicacion='PUBLICADA_VERIFICADA' THEN p.longitud ELSE NULL END,
    i.precio_centavos, i.ultima_revision_at, s.puntos
  FROM puntaje s
  JOIN f02.inventario i ON i.medicamento_id=s.id
  JOIN f01.farmacia_referencia f ON f.id=i.farmacia_id
  JOIN f03.farmacia_publica p ON p.farmacia_id=f.id
  WHERE f.estado='ACTIVA' AND i.cantidad_fisica>i.cantidad_comprometida
    AND (p_min_price IS NULL OR i.precio_centavos>=p_min_price)
    AND (p_max_price IS NULL OR i.precio_centavos<=p_max_price)
  ORDER BY s.puntos DESC, s.nombre, s.presentacion, f.id, s.concentracion, s.laboratorio, s.marca, s.id
  LIMIT LEAST(GREATEST(p_limit,1),200)
$body$;
ALTER FUNCTION f03.search_public_offers_identity(text[],text[],bigint,bigint,integer) OWNER TO f03_projection_owner;
REVOKE ALL ON FUNCTION f03.search_public_offers_identity(text[],text[],bigint,bigint,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION f03.search_public_offers_identity(text[],text[],bigint,bigint,integer) TO f01_runtime;
