-- F02.5 TEST/DEMO only. Review this migration before execution on a new ephemeral database.
-- Requests have no tenant until approved; their owner is a user, not a farmacia_id.
CREATE SCHEMA IF NOT EXISTS f025;
REVOKE ALL ON SCHEMA f025 FROM PUBLIC;

CREATE TABLE f025.solicitud (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitante_id uuid NOT NULL REFERENCES f01.usuario(id) ON DELETE RESTRICT,
  estado text NOT NULL DEFAULT 'BORRADOR' CHECK (estado IN (
    'BORRADOR','PENDIENTE','EN_REVISION','OBSERVADA','APROBADA','RECHAZADA','CANCELADA'
  )),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  nombre_comercial text NOT NULL CHECK (char_length(btrim(nombre_comercial)) BETWEEN 1 AND 160),
  contacto text NOT NULL CHECK (char_length(btrim(contacto)) BETWEEN 1 AND 160),
  direccion text NOT NULL CHECK (char_length(btrim(direccion)) BETWEEN 1 AND 240),
  departamento text NOT NULL CHECK (char_length(btrim(departamento)) BETWEEN 1 AND 100),
  provincia text NOT NULL CHECK (char_length(btrim(provincia)) BETWEEN 1 AND 100),
  distrito text NOT NULL CHECK (char_length(btrim(distrito)) BETWEEN 1 AND 100),
  representante text NOT NULL CHECK (char_length(btrim(representante)) BETWEEN 1 AND 160),
  ruc text CHECK (ruc IS NULL OR char_length(btrim(ruc)) BETWEEN 1 AND 20),
  farmacia_activada_id uuid UNIQUE REFERENCES f01.farmacia_referencia(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  submitted_at timestamptz,
  decided_at timestamptz,
  CONSTRAINT solicitud_aprobada_tiene_farmacia CHECK (
    (estado='APROBADA') = (farmacia_activada_id IS NOT NULL)
  ),
  CONSTRAINT solicitud_decision_fecha CHECK (
    (estado IN ('APROBADA','RECHAZADA') AND decided_at IS NOT NULL) OR
    (estado NOT IN ('APROBADA','RECHAZADA') AND decided_at IS NULL)
  )
);
CREATE INDEX solicitud_solicitante_fecha_idx ON f025.solicitud(solicitante_id, created_at DESC);
CREATE INDEX solicitud_estado_fecha_idx ON f025.solicitud(estado, submitted_at DESC)
  WHERE estado IN ('PENDIENTE','EN_REVISION','OBSERVADA');
CREATE INDEX solicitud_posible_duplicado_idx ON f025.solicitud(
  lower(btrim(nombre_comercial)), lower(btrim(direccion))
) WHERE estado IN ('PENDIENTE','EN_REVISION','APROBADA');

CREATE TABLE f025.revision (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitud_id uuid NOT NULL REFERENCES f025.solicitud(id) ON DELETE RESTRICT,
  actor_id uuid NOT NULL REFERENCES f01.usuario(id) ON DELETE RESTRICT,
  accion text NOT NULL CHECK (accion IN (
    'ENVIAR','INICIAR_REVISION','OBSERVAR','REENVIAR','RECHAZAR','APROBAR','CANCELAR'
  )),
  estado_anterior text NOT NULL CHECK (estado_anterior IN (
    'BORRADOR','PENDIENTE','EN_REVISION','OBSERVADA'
  )),
  estado_nuevo text NOT NULL CHECK (estado_nuevo IN (
    'PENDIENTE','EN_REVISION','OBSERVADA','APROBADA','RECHAZADA','CANCELADA'
  )),
  motivo text CHECK (motivo IS NULL OR char_length(btrim(motivo)) BETWEEN 8 AND 500),
  version_anterior integer NOT NULL CHECK (version_anterior > 0),
  version_nueva integer NOT NULL CHECK (version_nueva = version_anterior + 1),
  correlation_id uuid NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT revision_decision_con_motivo CHECK (
    accion NOT IN ('OBSERVAR','RECHAZAR','APROBAR') OR motivo IS NOT NULL
  ),
  CONSTRAINT revision_version_unica UNIQUE (solicitud_id, version_nueva)
);
CREATE INDEX revision_solicitud_fecha_idx ON f025.revision(solicitud_id, occurred_at DESC);

CREATE TABLE f025.documento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitud_id uuid NOT NULL REFERENCES f025.solicitud(id) ON DELETE RESTRICT,
  tipo text NOT NULL CHECK (tipo IN ('application/pdf','image/png','image/jpeg')),
  storage_key text NOT NULL UNIQUE CHECK (storage_key ~ '^[a-f0-9]{32,128}$'),
  tamano_bytes integer NOT NULL CHECK (tamano_bytes BETWEEN 1 AND 5242880),
  sha256_hex text NOT NULL CHECK (sha256_hex ~ '^[a-f0-9]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL CHECK (expires_at > created_at)
);
CREATE INDEX documento_solicitud_idx ON f025.documento(solicitud_id);

CREATE TABLE f025.activacion (
  solicitud_id uuid PRIMARY KEY REFERENCES f025.solicitud(id) ON DELETE RESTRICT,
  farmacia_id uuid NOT NULL UNIQUE REFERENCES f01.farmacia_referencia(id) ON DELETE RESTRICT,
  membresia_dueno_id uuid NOT NULL UNIQUE REFERENCES f01.usuario_farmacia(id) ON DELETE RESTRICT,
  revisor_id uuid NOT NULL REFERENCES f01.usuario(id) ON DELETE RESTRICT,
  idempotency_key text NOT NULL UNIQUE CHECK (char_length(idempotency_key) BETWEEN 16 AND 200),
  correlation_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE f025.farmacia_perfil (
  farmacia_id uuid PRIMARY KEY REFERENCES f01.farmacia_referencia(id) ON DELETE RESTRICT,
  contacto text NOT NULL CHECK (char_length(btrim(contacto)) BETWEEN 1 AND 160),
  direccion text NOT NULL CHECK (char_length(btrim(direccion)) BETWEEN 1 AND 240),
  departamento text NOT NULL CHECK (char_length(btrim(departamento)) BETWEEN 1 AND 100),
  provincia text NOT NULL CHECK (char_length(btrim(provincia)) BETWEEN 1 AND 100),
  distrito text NOT NULL CHECK (char_length(btrim(distrito)) BETWEEN 1 AND 100),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);
