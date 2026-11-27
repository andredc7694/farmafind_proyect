-- F07.1 (propuesta de enmienda F071-FR-017): historial de decisiones para el revisor de plataforma.
-- ADITIVA: no modifica ni elimina políticas, funciones, restricciones ni permisos de F07 001–008 ni de F02.5.
-- Las políticas aprobadas de la 007 solo muestran al revisor las propuestas PENDIENTES y las que decidió él
-- mismo. Estas dos políticas nuevas (permisivas, de solo lectura) añaden las ya DECIDIDAS por cualquier
-- revisor, siempre que el actor tenga rol de plataforma activo, la concesión F07.1 activa y NO sea miembro,
-- en ningún estado, de esa farmacia (f07.can_platform_location_review). Sin INSERT, UPDATE ni DELETE nuevos,
-- sin funciones nuevas y sin permisos nuevos sobre otras tablas.

CREATE POLICY f071_propuesta_plataforma_historial ON f07.ubicacion_propuesta
  FOR SELECT TO f01_runtime
  USING (estado IN ('PUBLICADA_VERIFICADA','RECHAZADA')
    AND f07.can_platform_location_review(farmacia_id));

CREATE POLICY f071_auditoria_plataforma_historial ON f07.ubicacion_auditoria
  FOR SELECT TO f01_runtime
  USING (accion IN ('APROBACION','RECHAZO')
    AND f07.can_platform_location_review(farmacia_id));
