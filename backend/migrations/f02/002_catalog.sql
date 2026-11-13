-- Shared reference catalogue. Runtime may read, but only TEST fixture/migrator may write.
CREATE TABLE f02.medicamento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL CHECK (char_length(btrim(nombre)) BETWEEN 1 AND 160),
  concentracion text NOT NULL CHECK (char_length(btrim(concentracion)) BETWEEN 1 AND 80),
  presentacion text NOT NULL CHECK (char_length(btrim(presentacion)) BETWEEN 1 AND 120),
  clasificacion text NOT NULL CHECK (char_length(btrim(clasificacion)) BETWEEN 1 AND 120),
  estado text NOT NULL DEFAULT 'ACTIVO' CHECK (estado IN ('ACTIVO','INACTIVO')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT medicamento_referencia_unica UNIQUE (nombre,concentracion,presentacion,clasificacion),
  CONSTRAINT medicamento_nombre_normalizado CHECK (nombre=regexp_replace(lower(btrim(nombre)), '\s+', ' ', 'g')),
  CONSTRAINT medicamento_concentracion_normalizada CHECK (concentracion=regexp_replace(lower(btrim(concentracion)), '\s+', ' ', 'g')),
  CONSTRAINT medicamento_presentacion_normalizada CHECK (presentacion=regexp_replace(lower(btrim(presentacion)), '\s+', ' ', 'g')),
  CONSTRAINT medicamento_clasificacion_normalizada CHECK (clasificacion=regexp_replace(lower(btrim(clasificacion)), '\s+', ' ', 'g'))
);
CREATE INDEX medicamento_nombre_idx ON f02.medicamento(nombre,id);
GRANT SELECT (id,nombre,concentracion,presentacion,clasificacion,estado)
  ON f02.medicamento TO f01_runtime;
