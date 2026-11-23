-- F02.1: additive private metadata. No uploaded bytes or cell values are retained.
ALTER TABLE f02.importacion_fila DROP CONSTRAINT importacion_fila_numero_fila_check;
ALTER TABLE f02.importacion_fila ADD CONSTRAINT importacion_fila_numero_fila_check
  CHECK (numero_fila BETWEEN 2 AND 5242880);

ALTER TABLE f02.importacion
  ADD COLUMN hoja_seleccionada text CHECK (length(hoja_seleccionada) BETWEEN 1 AND 100),
  ADD COLUMN fila_encabezado integer CHECK (fila_encabezado BETWEEN 1 AND 5242880),
  ADD COLUMN huella_encabezados bytea CHECK (octet_length(huella_encabezados)=32),
  ADD COLUMN mapeo jsonb CHECK (mapeo IS NULL OR jsonb_typeof(mapeo)='object');

GRANT INSERT (hoja_seleccionada,fila_encabezado,huella_encabezados,mapeo)
  ON f02.importacion TO f01_runtime;

CREATE TABLE f02.importacion_incidencia (
  importacion_id uuid NOT NULL,
  farmacia_id uuid NOT NULL,
  actor_usuario_id uuid NOT NULL,
  numero_fila integer NOT NULL CHECK (numero_fila BETWEEN 2 AND 5242880),
  ordinal smallint NOT NULL CHECK (ordinal BETWEEN 1 AND 20),
  columna_origen text NOT NULL CHECK (length(columna_origen) BETWEEN 1 AND 100),
  campo_destino text NOT NULL CHECK (campo_destino IN
    ('nombre','concentracion','presentacion','clasificacion','precioReferencial','cantidadFisica','farmaciaId')),
  codigo text NOT NULL CHECK (codigo IN
    ('PRECIO_REQUERIDO','PRECIO_INVALIDO','CANTIDAD_REQUERIDA','CANTIDAD_INVALIDA',
     'REFERENCIA_NO_CONCILIADA','REFERENCIA_AMBIGUA','REFERENCIA_INVALIDA',
     'FILA_DUPLICADA','FARMACIA_AJENA')),
  PRIMARY KEY (importacion_id,numero_fila,ordinal),
  FOREIGN KEY (importacion_id,numero_fila)
    REFERENCES f02.importacion_fila(importacion_id,numero_fila) ON DELETE RESTRICT,
  FOREIGN KEY (importacion_id,farmacia_id,actor_usuario_id)
    REFERENCES f02.importacion(id,farmacia_id,actor_usuario_id) ON DELETE RESTRICT
);
CREATE INDEX importacion_incidencia_farmacia_idx
  ON f02.importacion_incidencia(farmacia_id,importacion_id);

CREATE TABLE f02.perfil_importacion (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farmacia_id uuid NOT NULL REFERENCES f01.farmacia_referencia(id) ON DELETE RESTRICT,
  actor_usuario_id uuid NOT NULL REFERENCES f01.usuario(id) ON DELETE RESTRICT,
  nombre text NOT NULL CHECK (length(nombre) BETWEEN 1 AND 80),
  version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  huella_encabezados bytea NOT NULL CHECK (octet_length(huella_encabezados)=32),
  hoja text NOT NULL CHECK (length(hoja) BETWEEN 1 AND 100),
  fila_encabezado integer NOT NULL CHECK (fila_encabezado BETWEEN 1 AND 5242880),
  mapeo jsonb NOT NULL CHECK (jsonb_typeof(mapeo)='object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (farmacia_id,nombre)
);

ALTER TABLE f02.importacion_incidencia ENABLE ROW LEVEL SECURITY;
ALTER TABLE f02.importacion_incidencia FORCE ROW LEVEL SECURITY;
ALTER TABLE f02.perfil_importacion ENABLE ROW LEVEL SECURITY;
ALTER TABLE f02.perfil_importacion FORCE ROW LEVEL SECURITY;

GRANT SELECT ON f02.importacion_incidencia,f02.perfil_importacion TO f01_runtime;
GRANT INSERT (importacion_id,farmacia_id,actor_usuario_id,numero_fila,ordinal,
  columna_origen,campo_destino,codigo) ON f02.importacion_incidencia TO f01_runtime;
GRANT INSERT (farmacia_id,actor_usuario_id,nombre,huella_encabezados,hoja,
  fila_encabezado,mapeo) ON f02.perfil_importacion TO f01_runtime;
GRANT UPDATE (nombre,version,huella_encabezados,hoja,fila_encabezado,mapeo,updated_at)
  ON f02.perfil_importacion TO f01_runtime;

CREATE POLICY importacion_incidencia_lectura ON f02.importacion_incidencia
  FOR SELECT TO f01_runtime USING (
    f02.can_inventory_action(farmacia_id,'inventory.history') OR
    (actor_usuario_id=NULLIF(current_setting('app.actor_user_id',true),'')::uuid AND
     (f02.can_inventory_action(farmacia_id,'inventory.import.preview') OR
      f02.can_inventory_action(farmacia_id,'inventory.import.confirm')))
  );
CREATE POLICY importacion_incidencia_alta ON f02.importacion_incidencia
  FOR INSERT TO f01_runtime WITH CHECK (
    actor_usuario_id=NULLIF(current_setting('app.actor_user_id',true),'')::uuid AND
    f02.can_inventory_action(farmacia_id,'inventory.import.preview')
  );
CREATE POLICY perfil_importacion_lectura ON f02.perfil_importacion
  FOR SELECT TO f01_runtime USING (f02.can_inventory_action(farmacia_id,'inventory.import.preview'));
CREATE POLICY perfil_importacion_alta ON f02.perfil_importacion
  FOR INSERT TO f01_runtime WITH CHECK (
    actor_usuario_id=NULLIF(current_setting('app.actor_user_id',true),'')::uuid AND
    f02.can_inventory_action(farmacia_id,'inventory.import.confirm')
  );
CREATE POLICY perfil_importacion_cambio ON f02.perfil_importacion
  FOR UPDATE TO f01_runtime
  USING (f02.can_inventory_action(farmacia_id,'inventory.import.confirm'))
  WITH CHECK (f02.can_inventory_action(farmacia_id,'inventory.import.confirm'));
