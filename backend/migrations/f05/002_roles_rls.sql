DO $roles$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='f05_outbox_publisher') THEN
    CREATE ROLE f05_outbox_publisher NOLOGIN NOSUPERUSER NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='f05_notifications_runtime') THEN
    CREATE ROLE f05_notifications_runtime NOLOGIN NOSUPERUSER NOBYPASSRLS;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname IN ('f05_outbox_publisher','f05_notifications_runtime')
    AND (rolsuper OR rolbypassrls OR rolcanlogin)) THEN
    RAISE EXCEPTION 'roles F05 deben ser NOLOGIN NOSUPERUSER NOBYPASSRLS';
  END IF;
END $roles$;

ALTER TABLE f05.recepcion_evento ENABLE ROW LEVEL SECURITY;
ALTER TABLE f05.recepcion_evento FORCE ROW LEVEL SECURITY;
ALTER TABLE f05.intento_entrega ENABLE ROW LEVEL SECURITY;
ALTER TABLE f05.intento_entrega FORCE ROW LEVEL SECURITY;
ALTER TABLE f05.entrega_local ENABLE ROW LEVEL SECURITY;
ALTER TABLE f05.entrega_local FORCE ROW LEVEL SECURITY;
ALTER TABLE f05.conflicto_evento ENABLE ROW LEVEL SECURITY;
ALTER TABLE f05.conflicto_evento FORCE ROW LEVEL SECURITY;

GRANT USAGE ON SCHEMA f04 TO f05_outbox_publisher;
GRANT SELECT ON f04.outbox_evento TO f05_outbox_publisher;
GRANT UPDATE(estado_publicacion,reclamo_id,reclamado_hasta,proximo_intento_en,
  ultimo_error_codigo,publicado_en,intentos) ON f04.outbox_evento TO f05_outbox_publisher;
CREATE POLICY outbox_publisher_select ON f04.outbox_evento FOR SELECT TO f05_outbox_publisher USING (true);
CREATE POLICY outbox_publisher_update ON f04.outbox_evento FOR UPDATE TO f05_outbox_publisher
  USING (true) WITH CHECK (true);

GRANT USAGE ON SCHEMA f05 TO f05_notifications_runtime;
GRANT SELECT,INSERT,UPDATE ON f05.recepcion_evento TO f05_notifications_runtime;
GRANT SELECT,INSERT ON f05.intento_entrega,f05.entrega_local TO f05_notifications_runtime;
GRANT SELECT,INSERT ON f05.conflicto_evento TO f05_notifications_runtime;
CREATE POLICY f05_receipt_runtime ON f05.recepcion_evento FOR ALL TO f05_notifications_runtime
  USING (farmacia_id::text=NULLIF(current_setting('app.farmacia_id',true),''))
  WITH CHECK (farmacia_id::text=NULLIF(current_setting('app.farmacia_id',true),''));
CREATE POLICY f05_attempt_runtime ON f05.intento_entrega FOR ALL TO f05_notifications_runtime
  USING (farmacia_id::text=NULLIF(current_setting('app.farmacia_id',true),''))
  WITH CHECK (farmacia_id::text=NULLIF(current_setting('app.farmacia_id',true),''));
CREATE POLICY f05_delivery_runtime ON f05.entrega_local FOR ALL TO f05_notifications_runtime
  USING (farmacia_id::text=NULLIF(current_setting('app.farmacia_id',true),''))
  WITH CHECK (farmacia_id::text=NULLIF(current_setting('app.farmacia_id',true),''));
CREATE POLICY f05_conflict_runtime ON f05.conflicto_evento FOR ALL TO f05_notifications_runtime
  USING (farmacia_id::text=NULLIF(current_setting('app.farmacia_id',true),''))
  WITH CHECK (farmacia_id::text=NULLIF(current_setting('app.farmacia_id',true),''));
