CREATE SCHEMA IF NOT EXISTS f05;

ALTER TABLE f04.outbox_evento
  ADD COLUMN estado_publicacion text NOT NULL DEFAULT 'PENDIENTE',
  ADD COLUMN reclamo_id uuid,
  ADD COLUMN reclamado_hasta timestamptz,
  ADD COLUMN proximo_intento_en timestamptz DEFAULT now(),
  ADD COLUMN ultimo_error_codigo text;

ALTER TABLE f04.outbox_evento ADD CONSTRAINT outbox_estado_publicacion_check
  CHECK (estado_publicacion IN ('PENDIENTE','REINTENTO','PUBLICADO','BLOQUEADO'));
ALTER TABLE f04.outbox_evento ADD CONSTRAINT outbox_reclamo_coherente_check
  CHECK ((reclamo_id IS NULL) = (reclamado_hasta IS NULL));

CREATE TABLE f05.recepcion_evento (
  evento_id uuid PRIMARY KEY,
  farmacia_id uuid NOT NULL,
  tipo text NOT NULL,
  version integer NOT NULL CHECK(version=1),
  huella text NOT NULL CHECK(huella ~ '^[0-9a-f]{64}$'),
  correlacion_id uuid NOT NULL,
  estado text NOT NULL CHECK(estado IN ('RECIBIDO','ENTREGADO','FALLIDO')),
  recibido_en timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE f05.intento_entrega (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evento_id uuid NOT NULL REFERENCES f05.recepcion_evento(evento_id) ON DELETE RESTRICT,
  farmacia_id uuid NOT NULL,
  numero integer NOT NULL CHECK(numero>0),
  resultado text NOT NULL CHECK(resultado IN ('EXITO','FALLO')),
  error_codigo text,
  latencia_ms integer NOT NULL CHECK(latencia_ms>=0),
  iniciado_en timestamptz NOT NULL,
  finalizado_en timestamptz NOT NULL,
  UNIQUE(evento_id,numero)
);

CREATE TABLE f05.entrega_local (
  evento_id uuid PRIMARY KEY REFERENCES f05.recepcion_evento(evento_id) ON DELETE RESTRICT,
  farmacia_id uuid NOT NULL,
  tipo text NOT NULL,
  estado_reserva text NOT NULL CHECK(estado_reserva IN ('PENDIENTE','CONFIRMADA','ENTREGADA','CANCELADA','EXPIRADA')),
  correlacion_id uuid NOT NULL,
  entregado_en timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE f05.conflicto_evento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evento_id uuid NOT NULL REFERENCES f05.recepcion_evento(evento_id) ON DELETE RESTRICT,
  farmacia_id uuid NOT NULL,
  huella_recibida text NOT NULL CHECK(huella_recibida ~ '^[0-9a-f]{64}$'),
  ocurrido_en timestamptz NOT NULL DEFAULT now()
);
