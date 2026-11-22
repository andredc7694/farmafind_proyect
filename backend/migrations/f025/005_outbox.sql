-- F02.5 has no reservation_id or pharmacy_id before approval: do not reuse F04 Outbox.
CREATE TABLE f025.outbox_evento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitud_id uuid NOT NULL REFERENCES f025.solicitud(id) ON DELETE RESTRICT,
  destinatario_usuario_id uuid NOT NULL REFERENCES f01.usuario(id) ON DELETE RESTRICT,
  tipo text NOT NULL CHECK (tipo IN (
    'SOLICITUD_ENVIADA','SOLICITUD_OBSERVADA','SOLICITUD_APROBADA','SOLICITUD_RECHAZADA'
  )),
  version_solicitud integer NOT NULL CHECK (version_solicitud > 0),
  correlation_id uuid NOT NULL,
  estado text NOT NULL DEFAULT 'PENDIENTE' CHECK (estado IN (
    'PENDIENTE','RECLAMADO','PUBLICADO','FALLIDO'
  )),
  intentos integer NOT NULL DEFAULT 0 CHECK (intentos >= 0),
  creado_en timestamptz NOT NULL DEFAULT now(),
  proximo_intento_en timestamptz NOT NULL DEFAULT now(),
  reclamado_hasta timestamptz,
  ultimo_error_codigo text,
  publicado_en timestamptz,
  CONSTRAINT f025_outbox_efecto_unico UNIQUE (solicitud_id, tipo, version_solicitud),
  CONSTRAINT f025_outbox_estado_fecha CHECK (
    (estado='PUBLICADO' AND publicado_en IS NOT NULL) OR
    (estado<>'PUBLICADO' AND publicado_en IS NULL)
  )
);
CREATE INDEX f025_outbox_pendiente_idx
  ON f025.outbox_evento(proximo_intento_en, creado_en, id)
  WHERE estado IN ('PENDIENTE','RECLAMADO','FALLIDO');

REVOKE ALL ON f025.outbox_evento FROM PUBLIC;
ALTER TABLE f025.outbox_evento ENABLE ROW LEVEL SECURITY;
ALTER TABLE f025.outbox_evento FORCE ROW LEVEL SECURITY;

CREATE POLICY f025_outbox_policy_read ON f025.outbox_evento
  FOR SELECT TO f025_policy
  USING (EXISTS (SELECT 1 FROM f025.solicitud s
    WHERE s.id=outbox_evento.solicitud_id
      AND (s.solicitante_id=f025.authenticated_actor() OR
           f025.has_capability('F025_APPLICATION_REVIEW'))));
CREATE POLICY f025_outbox_policy_write ON f025.outbox_evento
  FOR INSERT TO f025_policy
  WITH CHECK (estado='PENDIENTE' AND intentos=0 AND EXISTS (
    SELECT 1 FROM f025.solicitud s WHERE s.id=outbox_evento.solicitud_id
      AND s.solicitante_id=outbox_evento.destinatario_usuario_id
      AND (s.solicitante_id=f025.authenticated_actor() OR
           f025.has_capability('F025_APPLICATION_DECIDE'))));
CREATE POLICY f025_outbox_activation ON f025.outbox_evento
  FOR INSERT TO f025_activation_executor
  WITH CHECK (solicitud_id=NULLIF(current_setting('app.f025_application_id',true),'')::uuid
    AND estado='PENDIENTE' AND intentos=0 AND EXISTS (
      SELECT 1 FROM f025.solicitud s WHERE s.id=outbox_evento.solicitud_id
        AND s.solicitante_id=outbox_evento.destinatario_usuario_id));

GRANT SELECT, INSERT ON f025.outbox_evento TO f025_policy;
GRANT INSERT ON f025.outbox_evento TO f025_activation_executor;
GRANT USAGE ON SCHEMA f025 TO f05_outbox_publisher;
GRANT SELECT ON f025.outbox_evento TO f05_outbox_publisher;
GRANT UPDATE (estado, intentos, proximo_intento_en, reclamado_hasta,
  ultimo_error_codigo, publicado_en) ON f025.outbox_evento TO f05_outbox_publisher;
CREATE POLICY f025_outbox_publisher_read ON f025.outbox_evento
  FOR SELECT TO f05_outbox_publisher USING (true);
CREATE POLICY f025_outbox_publisher_update ON f025.outbox_evento
  FOR UPDATE TO f05_outbox_publisher USING (true) WITH CHECK (true);

-- Every successful activation creates exactly one local event in the same transaction.
-- The trigger is INVOKER, so the NOLOGIN/NOBYPASSRLS activation role still faces RLS.
CREATE FUNCTION f025.enqueue_activation_event() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER
SET search_path = pg_catalog, f025
AS $function$
BEGIN
  INSERT INTO f025.outbox_evento(solicitud_id,destinatario_usuario_id,tipo,
    version_solicitud,correlation_id)
    SELECT NEW.solicitud_id,s.solicitante_id,'SOLICITUD_APROBADA',s.version,
      NEW.correlation_id FROM f025.solicitud s
      WHERE s.id=NEW.solicitud_id AND s.estado='APROBADA';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'F02.5: activación sin solicitud aprobada' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION f025.enqueue_activation_event() FROM PUBLIC;
CREATE TRIGGER f025_activation_outbox
  AFTER INSERT ON f025.activacion
  FOR EACH ROW EXECUTE FUNCTION f025.enqueue_activation_event();
