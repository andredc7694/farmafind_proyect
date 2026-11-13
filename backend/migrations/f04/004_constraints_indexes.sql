CREATE INDEX reserva_propietario_fecha_idx ON f04.reserva(usuario_id,creado_en DESC,id);
CREATE INDEX reserva_cola_idx ON f04.reserva(farmacia_id,estado,respuesta_expira_en,recogida_expira_en);
CREATE INDEX reserva_expiracion_idx ON f04.reserva(COALESCE(recogida_expira_en,respuesta_expira_en))
  WHERE estado IN ('PENDIENTE','CONFIRMADA');
CREATE INDEX transicion_reserva_fecha_idx ON f04.transicion_reserva(reserva_id,ocurrido_en,id);
CREATE INDEX outbox_pendiente_idx ON f04.outbox_evento(creado_en,id) WHERE publicado_en IS NULL;
CREATE UNIQUE INDEX incidencia_reserva_unique ON f04.incidencia_stock(reserva_id);
CREATE UNIQUE INDEX outbox_reserva_tipo_unique ON f04.outbox_evento(reserva_id,tipo);
