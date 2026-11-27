-- F03.2 · PROPUESTA para revisión de Andre (NO aplicada). Destino tras la aprobación:
--   backend/migrations/f03/003_search_terms.sql (copia literal, verificada por SHA-256 en evidence.md).
-- ADITIVA: crea dos funciones NUEVAS. No edita ni reemplaza f03.search_public_offers (sigue igual
-- para F07 y otros usos). Sin extensiones: solo lower(), translate() y regexp_replace() de PostgreSQL.
-- Misma regla de publicación que F03: farmacia ACTIVA, medicamento ACTIVO con principio activo,
-- stock disponible y fila en f03.farmacia_publica. Sin F07 las coordenadas salen siempre NULL;
-- la migración F07 010 reemplaza esta función con coordenadas solo verificadas.

-- Normaliza texto para comparar: minúsculas, sin tildes, número y unidad separados ("500mg" ->
-- "500 mg", "x10" -> "x 10"), coma decimal como punto y cualquier otro signo como espacio.
-- Incluye las mayúsculas con tilde por si lower() no las convierte con la configuración regional
-- del servidor. El backend aplica la misma regla (prueba de paridad TS/SQL obligatoria).
CREATE FUNCTION f03.normalize_search_text(p_text text) RETURNS text
LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
SET search_path = pg_catalog
AS $body$
  SELECT btrim(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(
    translate(lower(p_text),
      'áàäâãéèëêíìïîóòöôõúùüûñçÁÀÄÂÃÉÈËÊÍÌÏÎÓÒÖÔÕÚÙÜÛÑÇ',
      'aaaaaeeeeiiiiooooouuuuncaaaaaeeeeiiiiooooouuuunc'),
    '([0-9]),([0-9])', '\1.\2', 'g'),
    '(?<![0-9])\.|\.(?![0-9])', ' ', 'g'),
    '([0-9])([a-z%])', '\1 \2', 'g'),
    '([a-z%])([0-9])', '\1 \2', 'g'),
    '[^a-z0-9.%]+', ' ', 'g'))
$body$;
ALTER FUNCTION f03.normalize_search_text(text) OWNER TO f03_projection_owner;
REVOKE ALL ON FUNCTION f03.normalize_search_text(text) FROM PUBLIC;

-- p_words:  palabras (ya normalizadas y en singular por el backend). Coinciden como parte del texto.
--           Las de menos de 2 letras se ignoran también aquí (el backend ya no las envía).
--           Al menos una DEBE estar en el nombre o el principio activo (regla de la Constitution).
-- p_tokens: números y unidades. Coinciden solo como palabra entera ("500" no coincide con "1500").
-- coincidencias: cuántas palabras y tokens coinciden en nombre, principio activo, concentración o
--           presentación. Exacta = coincidencias = cardinality(p_words) + cardinality(p_tokens).
CREATE FUNCTION f03.search_public_offers_terms(
  p_words text[], p_tokens text[], p_min_price bigint, p_max_price bigint, p_limit integer
) RETURNS TABLE (
  medicamento_id uuid, nombre_comercial text, principio_activo text, concentracion text,
  presentacion text, clasificacion text, farmacia_id uuid, farmacia_nombre text,
  farmacia_direccion text, farmacia_latitud numeric, farmacia_longitud numeric,
  precio_centavos bigint, ultima_revision timestamptz, coincidencias integer
) LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, f01, f02, f03
AS $body$
  WITH entrada AS (
    SELECT coalesce(p_words, '{}'::text[]) AS words, coalesce(p_tokens, '{}'::text[]) AS tokens
  ), base AS (
    SELECT m.id AS m_id, m.nombre, m.principio_activo AS principio, m.concentracion, m.presentacion,
      m.clasificacion, f.id AS f_id, f.nombre_publico, p.direccion_texto, i.precio_centavos AS precio,
      i.ultima_revision_at,
      f03.normalize_search_text(concat_ws(' ', m.nombre, m.principio_activo)) AS hay_nombre,
      f03.normalize_search_text(concat_ws(' ', m.nombre, m.principio_activo,
        m.concentracion, m.presentacion)) AS hay_todo
    FROM f02.inventario i
    JOIN f02.medicamento m ON m.id=i.medicamento_id
    JOIN f01.farmacia_referencia f ON f.id=i.farmacia_id
    JOIN f03.farmacia_publica p ON p.farmacia_id=f.id
    WHERE m.estado='ACTIVO' AND f.estado='ACTIVA' AND m.principio_activo IS NOT NULL
      AND i.cantidad_fisica>i.cantidad_comprometida
      AND (p_min_price IS NULL OR i.precio_centavos>=p_min_price)
      AND (p_max_price IS NULL OR i.precio_centavos<=p_max_price)
  ), puntaje AS (
    SELECT b.*,
      ((SELECT count(*) FROM unnest(e.words) w WHERE length(w)>=2 AND position(w IN b.hay_todo)>0) +
       (SELECT count(*) FROM unnest(e.tokens) t WHERE t = ANY (string_to_array(b.hay_todo, ' '))))::integer AS puntos
    FROM base b CROSS JOIN entrada e
    WHERE cardinality(e.words) BETWEEN 1 AND 8 AND cardinality(e.tokens) <= 8
      AND EXISTS (SELECT 1 FROM unnest(e.words) w WHERE length(w)>=2 AND position(w IN b.hay_nombre)>0)
  )
  SELECT m_id,nombre,principio,concentracion,presentacion,clasificacion,f_id,nombre_publico,
    direccion_texto,NULL::numeric,NULL::numeric,precio,ultima_revision_at,puntos
  FROM puntaje
  ORDER BY puntos DESC, nombre, presentacion, f_id
  LIMIT LEAST(GREATEST(p_limit,1),200)
$body$;
ALTER FUNCTION f03.search_public_offers_terms(text[],text[],bigint,bigint,integer) OWNER TO f03_projection_owner;
REVOKE ALL ON FUNCTION f03.search_public_offers_terms(text[],text[],bigint,bigint,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION f03.search_public_offers_terms(text[],text[],bigint,bigint,integer) TO f01_runtime;
