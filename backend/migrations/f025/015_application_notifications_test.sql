-- F02.5 TEST only: separate application-event pipeline. F04/F05 reservation tables stay unchanged.
DO $guard$ BEGIN
  IF current_setting('cluster_name') <> 'farmafind-f025-test'
     OR current_database() !~ '^farmafind_f01_test_[a-f0-9]{12}$'
     OR (SELECT description FROM pg_shdescription WHERE objoid=(SELECT oid FROM pg_database
       WHERE datname=current_database())) IS DISTINCT FROM 'FarmaFind F07 TEST efimera' THEN
    RAISE EXCEPTION 'F02.5: notificaciones solo en base efimera TEST' USING ERRCODE='42501';
  END IF;
END $guard$;

ALTER TABLE f025.outbox_evento ADD COLUMN reclamo_id uuid;
ALTER TABLE f025.outbox_evento DROP CONSTRAINT outbox_evento_estado_check;
ALTER TABLE f025.outbox_evento ADD CONSTRAINT outbox_evento_estado_check
  CHECK (estado IN ('PENDIENTE','RECLAMADO','PUBLICADO','FALLIDO','BLOQUEADO'));
ALTER TABLE f025.outbox_evento ALTER COLUMN proximo_intento_en DROP NOT NULL;
UPDATE f025.outbox_evento SET proximo_intento_en=NULL WHERE estado='PUBLICADO';
ALTER TABLE f025.outbox_evento ADD CONSTRAINT f025_reclamo_coherente
  CHECK ((reclamo_id IS NULL)=(reclamado_hasta IS NULL));
ALTER TABLE f025.outbox_evento ADD CONSTRAINT f025_terminal_sin_proximo
  CHECK ((estado IN ('PUBLICADO','BLOQUEADO'))=(proximo_intento_en IS NULL));
GRANT UPDATE (reclamo_id) ON f025.outbox_evento TO f05_outbox_publisher;
DROP INDEX f025.f025_outbox_pendiente_idx;
CREATE INDEX f025_outbox_pendiente_idx ON f025.outbox_evento(proximo_intento_en,creado_en,id)
  WHERE estado IN ('PENDIENTE','RECLAMADO','FALLIDO');

CREATE TABLE f05.recepcion_solicitud_evento (
  evento_id uuid PRIMARY KEY,
  solicitud_id uuid NOT NULL,
  destinatario_usuario_id uuid NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('SOLICITUD_ENVIADA','SOLICITUD_OBSERVADA',
    'SOLICITUD_APROBADA','SOLICITUD_RECHAZADA')),
  version_solicitud integer NOT NULL CHECK (version_solicitud>0),
  huella text NOT NULL CHECK (huella ~ '^[a-f0-9]{64}$'),
  correlation_id uuid NOT NULL,
  estado text NOT NULL CHECK (estado IN ('RECIBIDO','ENTREGADO')),
  recibido_en timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT f025_notification_logical_once UNIQUE(solicitud_id,tipo,version_solicitud,destinatario_usuario_id)
);
CREATE TABLE f05.entrega_solicitud_local (
  evento_id uuid PRIMARY KEY REFERENCES f05.recepcion_solicitud_evento(evento_id) ON DELETE RESTRICT,
  destinatario_usuario_id uuid NOT NULL,
  tipo text NOT NULL,
  correlation_id uuid NOT NULL,
  entregado_en timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE f05.intento_solicitud (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evento_id uuid NOT NULL REFERENCES f05.recepcion_solicitud_evento(evento_id) ON DELETE RESTRICT,
  destinatario_usuario_id uuid NOT NULL,
  numero integer NOT NULL CHECK (numero>0),
  resultado text NOT NULL CHECK (resultado IN ('EXITO','REPETICION','CONFLICTO')),
  ocurrido_en timestamptz NOT NULL DEFAULT now(),
  UNIQUE(evento_id,numero)
);
CREATE INDEX f025_notification_recipient_idx ON f05.recepcion_solicitud_evento
  (destinatario_usuario_id,recibido_en DESC);
CREATE INDEX f025_delivery_recipient_idx ON f05.entrega_solicitud_local
  (destinatario_usuario_id,entregado_en DESC);
CREATE INDEX f025_attempt_recipient_idx ON f05.intento_solicitud
  (destinatario_usuario_id,ocurrido_en DESC);

REVOKE ALL ON f05.recepcion_solicitud_evento,f05.entrega_solicitud_local,f05.intento_solicitud FROM PUBLIC;
ALTER TABLE f05.recepcion_solicitud_evento ENABLE ROW LEVEL SECURITY;
ALTER TABLE f05.recepcion_solicitud_evento FORCE ROW LEVEL SECURITY;
ALTER TABLE f05.entrega_solicitud_local ENABLE ROW LEVEL SECURITY;
ALTER TABLE f05.entrega_solicitud_local FORCE ROW LEVEL SECURITY;
ALTER TABLE f05.intento_solicitud ENABLE ROW LEVEL SECURITY;
ALTER TABLE f05.intento_solicitud FORCE ROW LEVEL SECURITY;
CREATE POLICY f025_notification_recipient ON f05.recepcion_solicitud_evento
  FOR ALL TO f05_notifications_runtime
  USING (destinatario_usuario_id::text=NULLIF(current_setting('app.f05_recipient_id',true),''))
  WITH CHECK (destinatario_usuario_id::text=NULLIF(current_setting('app.f05_recipient_id',true),''));
CREATE POLICY f025_delivery_recipient ON f05.entrega_solicitud_local
  FOR ALL TO f05_notifications_runtime
  USING (destinatario_usuario_id::text=NULLIF(current_setting('app.f05_recipient_id',true),''))
  WITH CHECK (destinatario_usuario_id::text=NULLIF(current_setting('app.f05_recipient_id',true),''));
CREATE POLICY f025_attempt_recipient ON f05.intento_solicitud
  FOR ALL TO f05_notifications_runtime
  USING (destinatario_usuario_id::text=NULLIF(current_setting('app.f05_recipient_id',true),''))
  WITH CHECK (destinatario_usuario_id::text=NULLIF(current_setting('app.f05_recipient_id',true),''));
GRANT SELECT,INSERT,UPDATE,DELETE ON f05.recepcion_solicitud_evento TO f05_notifications_runtime;
GRANT SELECT,INSERT,DELETE ON f05.entrega_solicitud_local,f05.intento_solicitud TO f05_notifications_runtime;
