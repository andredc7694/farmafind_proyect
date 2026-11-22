-- Preview metadata only; raw uploaded files are never stored.
CREATE TABLE f02.importacion (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farmacia_id uuid NOT NULL REFERENCES f01.farmacia_referencia(id) ON DELETE RESTRICT,
  actor_usuario_id uuid NOT NULL REFERENCES f01.usuario(id) ON DELETE RESTRICT,
  digest bytea NOT NULL CHECK (octet_length(digest)=32),
  estado text NOT NULL DEFAULT 'VISTA_PREVIA' CHECK (estado IN ('VISTA_PREVIA','CONFIRMADA','RECHAZADA','EXPIRADA')),
  error_count integer NOT NULL DEFAULT 0 CHECK (error_count >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  confirmed_at timestamptz,
  CONSTRAINT importacion_vencimiento CHECK (expires_at > created_at AND expires_at <= created_at + interval '30 minutes'),
  CONSTRAINT importacion_confirmacion CHECK ((estado='CONFIRMADA')=(confirmed_at IS NOT NULL)),
  CONSTRAINT importacion_scope_unico UNIQUE (id,farmacia_id,actor_usuario_id)
);
CREATE INDEX importacion_farmacia_fecha_idx ON f02.importacion(farmacia_id,created_at DESC,id);
CREATE UNIQUE INDEX importacion_archivo_unico_idx ON f02.importacion(farmacia_id,actor_usuario_id,digest);

CREATE TABLE f02.importacion_fila (
  importacion_id uuid NOT NULL,
  farmacia_id uuid NOT NULL,
  actor_usuario_id uuid NOT NULL,
  numero_fila integer NOT NULL CHECK (numero_fila >= 2 AND numero_fila <= 5001),
  medicamento_id uuid REFERENCES f02.medicamento(id) ON DELETE RESTRICT,
  precio_centavos bigint CHECK (precio_centavos >= 0),
  cantidad_fisica integer CHECK (cantidad_fisica >= 0),
  error_code text CHECK (error_code IN (
    'REFERENCIA_NO_CONCILIADA','REFERENCIA_AMBIGUA','REFERENCIA_INVALIDA',
    'FILA_DUPLICADA','VALOR_INVALIDO','FARMACIA_AJENA')),
  CONSTRAINT importacion_fila_pk PRIMARY KEY (importacion_id,numero_fila),
  CONSTRAINT importacion_fila_scope_fk FOREIGN KEY (importacion_id,farmacia_id,actor_usuario_id)
    REFERENCES f02.importacion(id,farmacia_id,actor_usuario_id) ON DELETE RESTRICT
);
CREATE INDEX importacion_fila_farmacia_idx ON f02.importacion_fila(farmacia_id,importacion_id);

ALTER TABLE f02.importacion ENABLE ROW LEVEL SECURITY;
ALTER TABLE f02.importacion FORCE ROW LEVEL SECURITY;
ALTER TABLE f02.importacion_fila ENABLE ROW LEVEL SECURITY;
ALTER TABLE f02.importacion_fila FORCE ROW LEVEL SECURITY;

GRANT SELECT ON f02.importacion,f02.importacion_fila TO f01_runtime;
GRANT INSERT (farmacia_id,actor_usuario_id,digest,expires_at,error_count)
  ON f02.importacion TO f01_runtime;
GRANT UPDATE (estado,confirmed_at,error_count) ON f02.importacion TO f01_runtime;
GRANT INSERT (importacion_id,farmacia_id,actor_usuario_id,numero_fila,medicamento_id,
  precio_centavos,cantidad_fisica,error_code) ON f02.importacion_fila TO f01_runtime;

CREATE POLICY importacion_lectura ON f02.importacion FOR SELECT TO f01_runtime USING (
  f02.can_inventory_action(farmacia_id,'inventory.history') OR
  (actor_usuario_id=NULLIF(current_setting('app.actor_user_id',true),'')::uuid AND
   (f02.can_inventory_action(farmacia_id,'inventory.import.preview') OR
    f02.can_inventory_action(farmacia_id,'inventory.import.confirm')))
);
CREATE POLICY importacion_alta ON f02.importacion FOR INSERT TO f01_runtime WITH CHECK (
  actor_usuario_id=NULLIF(current_setting('app.actor_user_id',true),'')::uuid AND
  f02.can_inventory_action(farmacia_id,'inventory.import.preview')
);
CREATE POLICY importacion_cambio ON f02.importacion FOR UPDATE TO f01_runtime
  USING (estado='VISTA_PREVIA' AND
    actor_usuario_id=NULLIF(current_setting('app.actor_user_id',true),'')::uuid AND
    f02.can_inventory_action(farmacia_id,'inventory.import.confirm'))
  WITH CHECK (estado IN ('CONFIRMADA','RECHAZADA','EXPIRADA') AND
    actor_usuario_id=NULLIF(current_setting('app.actor_user_id',true),'')::uuid AND
    f02.can_inventory_action(farmacia_id,'inventory.import.confirm'));

CREATE POLICY importacion_fila_lectura ON f02.importacion_fila FOR SELECT TO f01_runtime USING (
  f02.can_inventory_action(farmacia_id,'inventory.history') OR
  (actor_usuario_id=NULLIF(current_setting('app.actor_user_id',true),'')::uuid AND
   (f02.can_inventory_action(farmacia_id,'inventory.import.preview') OR
    f02.can_inventory_action(farmacia_id,'inventory.import.confirm')))
);
CREATE POLICY importacion_fila_alta ON f02.importacion_fila FOR INSERT TO f01_runtime WITH CHECK (
  actor_usuario_id=NULLIF(current_setting('app.actor_user_id',true),'')::uuid AND
  f02.can_inventory_action(farmacia_id,'inventory.import.preview')
);
