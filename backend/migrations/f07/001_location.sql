-- F07 is additive. Existing F03 rows remain unverified and keep their address.
CREATE SCHEMA IF NOT EXISTS f07;
REVOKE ALL ON SCHEMA f07 FROM PUBLIC;

ALTER TABLE f03.farmacia_publica
  ADD COLUMN ciudad text,
  ADD COLUMN precision_m numeric(12,2),
  ADD COLUMN fuente text,
  ADD COLUMN estado_ubicacion text NOT NULL DEFAULT 'PENDIENTE',
  ADD COLUMN propuesta_por uuid,
  ADD COLUMN revisada_por uuid,
  ADD COLUMN fecha_verificacion timestamptz;

ALTER TABLE f03.farmacia_publica
  ADD CONSTRAINT farmacia_publica_ciudad_valida CHECK (
    ciudad IS NULL OR
    (char_length(ciudad) BETWEEN 2 AND 120 AND ciudad=lower(btrim(ciudad)))
  ),
  ADD CONSTRAINT farmacia_publica_precision_valida CHECK (precision_m IS NULL OR precision_m > 0),
  ADD CONSTRAINT farmacia_publica_estado_ubicacion_valido CHECK (
    estado_ubicacion IN ('PENDIENTE','PUBLICADA_VERIFICADA','RECHAZADA')),
  ADD CONSTRAINT farmacia_publica_publicacion_completa CHECK (
    estado_ubicacion <> 'PUBLICADA_VERIFICADA' OR
    (ciudad IS NOT NULL AND latitud IS NOT NULL AND longitud IS NOT NULL
      AND revisada_por IS NOT NULL AND propuesta_por IS NOT NULL
      AND revisada_por <> propuesta_por AND fecha_verificacion IS NOT NULL));
CREATE INDEX farmacia_publica_ciudad_idx ON f03.farmacia_publica(ciudad,farmacia_id)
  WHERE ciudad IS NOT NULL;

CREATE TABLE f07.ubicacion_propuesta (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farmacia_id uuid NOT NULL REFERENCES f01.farmacia_referencia(id) ON DELETE RESTRICT,
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  direccion_publicable text NOT NULL CHECK (char_length(btrim(direccion_publicable)) BETWEEN 1 AND 240),
  ciudad text NOT NULL CHECK (char_length(ciudad) BETWEEN 2 AND 120 AND ciudad=lower(btrim(ciudad))),
  latitud numeric(9,6) NOT NULL CHECK (latitud BETWEEN -90 AND 90),
  longitud numeric(9,6) NOT NULL CHECK (longitud BETWEEN -180 AND 180),
  precision_m numeric(12,2) CHECK (precision_m > 0),
  fuente text NOT NULL CHECK (char_length(btrim(fuente)) BETWEEN 2 AND 120),
  evidencia_referencia text CHECK (char_length(evidencia_referencia) <= 240),
  estado text NOT NULL DEFAULT 'PENDIENTE' CHECK (estado IN ('PENDIENTE','PUBLICADA_VERIFICADA','RECHAZADA')),
  propuesta_por uuid NOT NULL REFERENCES f01.usuario(id) ON DELETE RESTRICT,
  propuesta_at timestamptz NOT NULL DEFAULT now(),
  revisada_por uuid REFERENCES f01.usuario(id) ON DELETE RESTRICT,
  revisada_at timestamptz,
  CONSTRAINT ubicacion_revision_separada CHECK (revisada_por IS NULL OR revisada_por <> propuesta_por),
  CONSTRAINT ubicacion_revision_completa CHECK (
    (estado='PENDIENTE' AND revisada_por IS NULL AND revisada_at IS NULL) OR
    (estado<>'PENDIENTE' AND revisada_por IS NOT NULL AND revisada_at IS NOT NULL)),
  CONSTRAINT ubicacion_propuesta_farmacia_unica UNIQUE (id,farmacia_id)
);
CREATE INDEX ubicacion_propuesta_farmacia_estado_idx
  ON f07.ubicacion_propuesta(farmacia_id,estado,propuesta_at DESC);

CREATE TABLE f07.ubicacion_auditoria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farmacia_id uuid NOT NULL,
  propuesta_id uuid NOT NULL,
  actor_usuario_id uuid NOT NULL REFERENCES f01.usuario(id) ON DELETE RESTRICT,
  accion text NOT NULL CHECK (accion IN ('PROPUESTA','APROBACION','RECHAZO')),
  ocurrido_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ubicacion_auditoria_misma_farmacia FOREIGN KEY (propuesta_id,farmacia_id)
    REFERENCES f07.ubicacion_propuesta(id,farmacia_id) ON DELETE RESTRICT
);
CREATE INDEX ubicacion_auditoria_farmacia_idx ON f07.ubicacion_auditoria(farmacia_id,ocurrido_at DESC);
