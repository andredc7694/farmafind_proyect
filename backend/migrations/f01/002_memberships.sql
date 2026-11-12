CREATE TABLE f01.farmacia_referencia (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estado text NOT NULL DEFAULT 'ACTIVA' CHECK (estado IN ('ACTIVA', 'INACTIVA')),
  nombre_publico text NOT NULL CHECK (char_length(btrim(nombre_publico)) BETWEEN 1 AND 160)
);

CREATE TABLE f01.usuario_farmacia (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES f01.usuario(id) ON DELETE RESTRICT,
  farmacia_id uuid NOT NULL REFERENCES f01.farmacia_referencia(id) ON DELETE RESTRICT,
  rol text NOT NULL CHECK (char_length(btrim(rol)) BETWEEN 1 AND 80),
  estado text NOT NULL DEFAULT 'ACTIVA' CHECK (estado IN ('ACTIVA', 'SUSPENDIDA', 'REVOCADA')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  changed_by_usuario_id uuid REFERENCES f01.usuario(id) ON DELETE RESTRICT,
  CONSTRAINT usuario_farmacia_par_unico UNIQUE (usuario_id, farmacia_id),
  CONSTRAINT usuario_farmacia_id_farmacia_unico UNIQUE (id, farmacia_id)
);
CREATE INDEX usuario_farmacia_farmacia_estado_idx ON f01.usuario_farmacia(farmacia_id, estado);
CREATE INDEX usuario_farmacia_usuario_estado_idx ON f01.usuario_farmacia(usuario_id, estado);

CREATE TABLE f01.delegacion (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  membresia_id uuid NOT NULL,
  farmacia_id uuid NOT NULL,
  capacidad text NOT NULL CHECK (char_length(btrim(capacidad)) BETWEEN 1 AND 120),
  estado text NOT NULL DEFAULT 'ACTIVA' CHECK (estado IN ('ACTIVA', 'REVOCADA')),
  granted_by_usuario_id uuid NOT NULL REFERENCES f01.usuario(id) ON DELETE RESTRICT,
  granted_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  CONSTRAINT delegacion_membresia_farmacia_fk FOREIGN KEY (membresia_id, farmacia_id)
    REFERENCES f01.usuario_farmacia(id, farmacia_id) ON DELETE RESTRICT,
  CONSTRAINT delegacion_capacidad_unica UNIQUE (membresia_id, capacidad)
);
CREATE INDEX delegacion_farmacia_estado_idx ON f01.delegacion(farmacia_id, estado);

CREATE TABLE f01.auditoria_acceso (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_usuario_id uuid REFERENCES f01.usuario(id) ON DELETE RESTRICT,
  farmacia_id uuid REFERENCES f01.farmacia_referencia(id) ON DELETE RESTRICT,
  accion text NOT NULL CHECK (char_length(btrim(accion)) BETWEEN 1 AND 120),
  recurso_tipo text NOT NULL CHECK (char_length(btrim(recurso_tipo)) BETWEEN 1 AND 80),
  resultado text NOT NULL CHECK (resultado IN ('PERMITIDO', 'DENEGADO')),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  correlation_id uuid NOT NULL
);
CREATE INDEX auditoria_actor_fecha_idx ON f01.auditoria_acceso(actor_usuario_id, occurred_at DESC);
CREATE INDEX auditoria_farmacia_fecha_idx ON f01.auditoria_acceso(farmacia_id, occurred_at DESC);
