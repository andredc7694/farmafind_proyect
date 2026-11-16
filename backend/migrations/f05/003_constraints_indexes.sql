CREATE INDEX outbox_f05_claim_idx ON f04.outbox_evento(proximo_intento_en,creado_en,id)
  WHERE estado_publicacion IN ('PENDIENTE','REINTENTO');
CREATE INDEX outbox_f05_lease_idx ON f04.outbox_evento(reclamado_hasta)
  WHERE reclamo_id IS NOT NULL;
CREATE INDEX f05_receipt_tenant_idx ON f05.recepcion_evento(farmacia_id,recibido_en DESC);
CREATE INDEX f05_attempt_event_idx ON f05.intento_entrega(evento_id,numero);
CREATE INDEX f05_delivery_tenant_idx ON f05.entrega_local(farmacia_id,entregado_en DESC);
CREATE INDEX f05_conflict_tenant_idx ON f05.conflicto_evento(farmacia_id,ocurrido_en DESC);
