CREATE SCHEMA IF NOT EXISTS f03;

ALTER TABLE f02.medicamento ADD COLUMN IF NOT EXISTS principio_activo text;
ALTER TABLE f02.medicamento DROP CONSTRAINT IF EXISTS medicamento_principio_activo_valido;
ALTER TABLE f02.medicamento ADD CONSTRAINT medicamento_principio_activo_valido CHECK (
  principio_activo IS NULL OR (
    char_length(principio_activo) BETWEEN 1 AND 160 AND
    principio_activo=regexp_replace(lower(btrim(principio_activo)), '\s+', ' ', 'g')
  )
);
CREATE INDEX IF NOT EXISTS medicamento_principio_activo_idx
  ON f02.medicamento(principio_activo,id) WHERE principio_activo IS NOT NULL;

CREATE TABLE IF NOT EXISTS f03.farmacia_publica (
  farmacia_id uuid PRIMARY KEY REFERENCES f01.farmacia_referencia(id) ON DELETE RESTRICT,
  direccion_texto text NOT NULL CHECK (char_length(btrim(direccion_texto)) BETWEEN 1 AND 240),
  latitud numeric(9,6),
  longitud numeric(9,6),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT farmacia_publica_coordenadas_completas CHECK (
    (latitud IS NULL AND longitud IS NULL) OR
    (latitud BETWEEN -90 AND 90 AND longitud BETWEEN -180 AND 180)
  )
);

ALTER TABLE f03.farmacia_publica ENABLE ROW LEVEL SECURITY;
ALTER TABLE f03.farmacia_publica FORCE ROW LEVEL SECURITY;
REVOKE ALL ON SCHEMA f03 FROM PUBLIC;
REVOKE ALL ON f03.farmacia_publica FROM PUBLIC;
