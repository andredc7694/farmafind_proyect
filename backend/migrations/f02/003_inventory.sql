-- Tenant inventory. Runtime cannot mutate pharmacy_id or committed_quantity.
CREATE TABLE f02.inventario (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farmacia_id uuid NOT NULL REFERENCES f01.farmacia_referencia(id) ON DELETE RESTRICT,
  medicamento_id uuid NOT NULL REFERENCES f02.medicamento(id) ON DELETE RESTRICT,
  precio_centavos bigint NOT NULL CHECK (precio_centavos >= 0),
  cantidad_fisica integer NOT NULL CHECK (cantidad_fisica >= 0),
  cantidad_comprometida integer NOT NULL DEFAULT 0 CHECK (cantidad_comprometida >= 0),
  ultima_revision_at timestamptz NOT NULL,
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  CONSTRAINT inventario_fisico_suficiente CHECK (cantidad_fisica >= cantidad_comprometida),
  CONSTRAINT inventario_farmacia_medicamento_unico UNIQUE (farmacia_id,medicamento_id),
  CONSTRAINT inventario_referencia_compuesta UNIQUE (id,farmacia_id,medicamento_id)
);
CREATE INDEX inventario_farmacia_id_idx ON f02.inventario(farmacia_id,id);

CREATE TABLE f02.movimiento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farmacia_id uuid NOT NULL,
  inventario_id uuid NOT NULL,
  medicamento_id uuid NOT NULL,
  cantidad_antes integer,
  cantidad_despues integer NOT NULL CHECK (cantidad_despues >= 0),
  precio_antes_centavos bigint,
  precio_despues_centavos bigint NOT NULL CHECK (precio_despues_centavos >= 0),
  motivo text NOT NULL CHECK (char_length(btrim(motivo)) BETWEEN 1 AND 500),
  actor_usuario_id uuid NOT NULL REFERENCES f01.usuario(id) ON DELETE RESTRICT,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  correlacion_id uuid NOT NULL,
  CONSTRAINT movimiento_inventario_misma_farmacia FOREIGN KEY (inventario_id,farmacia_id,medicamento_id)
    REFERENCES f02.inventario(id,farmacia_id,medicamento_id) ON DELETE RESTRICT
);
CREATE INDEX movimiento_farmacia_fecha_idx ON f02.movimiento(farmacia_id,occurred_at DESC,id);
CREATE INDEX movimiento_inventario_fecha_idx ON f02.movimiento(farmacia_id,inventario_id,occurred_at DESC);

ALTER TABLE f02.inventario ENABLE ROW LEVEL SECURITY;
ALTER TABLE f02.inventario FORCE ROW LEVEL SECURITY;
ALTER TABLE f02.movimiento ENABLE ROW LEVEL SECURITY;
ALTER TABLE f02.movimiento FORCE ROW LEVEL SECURITY;

GRANT SELECT ON f02.inventario,f02.movimiento TO f01_runtime;
GRANT INSERT (farmacia_id,medicamento_id,precio_centavos,cantidad_fisica,ultima_revision_at)
  ON f02.inventario TO f01_runtime;
GRANT UPDATE (precio_centavos,cantidad_fisica,ultima_revision_at,version)
  ON f02.inventario TO f01_runtime;
GRANT INSERT (farmacia_id,inventario_id,medicamento_id,cantidad_antes,cantidad_despues,
  precio_antes_centavos,precio_despues_centavos,motivo,actor_usuario_id,correlacion_id)
  ON f02.movimiento TO f01_runtime;

CREATE POLICY inventario_lectura ON f02.inventario FOR SELECT TO f01_runtime USING (
  f02.can_inventory_action(farmacia_id,'inventory.read') OR
  f02.can_inventory_action(farmacia_id,'inventory.write') OR
  f02.can_inventory_action(farmacia_id,'inventory.import.confirm') OR
  f02.can_inventory_action(farmacia_id,'inventory.history')
);
CREATE POLICY inventario_alta ON f02.inventario FOR INSERT TO f01_runtime WITH CHECK (
  f02.can_inventory_action(farmacia_id,'inventory.write') OR
  f02.can_inventory_action(farmacia_id,'inventory.import.confirm')
);
CREATE POLICY inventario_cambio ON f02.inventario FOR UPDATE TO f01_runtime
  USING (f02.can_inventory_action(farmacia_id,'inventory.write') OR
    f02.can_inventory_action(farmacia_id,'inventory.import.confirm'))
  WITH CHECK (f02.can_inventory_action(farmacia_id,'inventory.write') OR
    f02.can_inventory_action(farmacia_id,'inventory.import.confirm'));

CREATE POLICY movimiento_lectura ON f02.movimiento FOR SELECT TO f01_runtime USING (
  f02.can_inventory_action(farmacia_id,'inventory.history') OR
  f02.can_inventory_action(farmacia_id,'inventory.read')
);
CREATE POLICY movimiento_alta ON f02.movimiento FOR INSERT TO f01_runtime WITH CHECK (
  actor_usuario_id=NULLIF(current_setting('app.actor_user_id',true),'')::uuid AND
  (f02.can_inventory_action(farmacia_id,'inventory.write') OR
   f02.can_inventory_action(farmacia_id,'inventory.import.confirm'))
);
