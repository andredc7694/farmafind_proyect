-- F07 reviewed publication uses RLS and a pharmacy-local optimistic version.
ALTER TABLE f03.farmacia_publica
  ADD COLUMN public_version bigint NOT NULL DEFAULT 0 CHECK (public_version>=0);
ALTER TABLE f07.ubicacion_propuesta
  ADD COLUMN base_public_version bigint NOT NULL DEFAULT 0 CHECK (base_public_version>=0);

GRANT SELECT ON f03.farmacia_publica TO f01_runtime;
GRANT UPDATE (direccion_texto,ciudad,latitud,longitud,precision_m,fuente,estado_ubicacion,
  propuesta_por,revisada_por,fecha_verificacion,updated_at,public_version)
  ON f03.farmacia_publica TO f01_runtime;

CREATE POLICY farmacia_publica_revision_lectura ON f03.farmacia_publica
  FOR SELECT TO f01_runtime USING (
    f07.can_location_action(farmacia_id,'GEO_LOCATION_PROPOSE') OR
    f07.can_location_action(farmacia_id,'GEO_LOCATION_REVIEW'));

CREATE POLICY farmacia_publica_revision_publicacion ON f03.farmacia_publica
  FOR UPDATE TO f01_runtime
  USING (f07.can_location_action(farmacia_id,'GEO_LOCATION_REVIEW'))
  WITH CHECK (
    f07.can_location_action(farmacia_id,'GEO_LOCATION_REVIEW')
    AND estado_ubicacion='PUBLICADA_VERIFICADA'
    AND revisada_por=NULLIF(current_setting('app.actor_user_id',true),'')::uuid
    AND EXISTS (
      SELECT 1 FROM f07.ubicacion_propuesta p
      WHERE p.farmacia_id=f03.farmacia_publica.farmacia_id
        AND p.estado='PUBLICADA_VERIFICADA'
        AND p.revisada_por=f03.farmacia_publica.revisada_por
        AND p.propuesta_por=f03.farmacia_publica.propuesta_por
        AND p.direccion_publicable=f03.farmacia_publica.direccion_texto
        AND p.ciudad=f03.farmacia_publica.ciudad
        AND p.latitud=f03.farmacia_publica.latitud
        AND p.longitud=f03.farmacia_publica.longitud
        AND p.precision_m IS NOT DISTINCT FROM f03.farmacia_publica.precision_m
        AND p.fuente=f03.farmacia_publica.fuente
        AND p.base_public_version=f03.farmacia_publica.public_version-1
    ));
