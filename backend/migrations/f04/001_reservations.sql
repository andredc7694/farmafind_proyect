CREATE SCHEMA IF NOT EXISTS f04;

CREATE TABLE f04.configuracion_farmacia (
  farmacia_id uuid PRIMARY KEY REFERENCES f01.farmacia_referencia(id) ON DELETE RESTRICT,
  plazo_recogida_horas integer NOT NULL DEFAULT 4 CHECK (plazo_recogida_horas BETWEEN 1 AND 8),
  actualizado_por uuid NOT NULL REFERENCES f01.usuario(id) ON DELETE RESTRICT,
  actualizado_en timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE f04.reserva (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES f01.usuario(id) ON DELETE RESTRICT,
  farmacia_id uuid NOT NULL REFERENCES f01.farmacia_referencia(id) ON DELETE RESTRICT,
  inventario_id uuid NOT NULL,
  medicamento_id uuid NOT NULL,
  cantidad integer NOT NULL CHECK (cantidad > 0),
  estado text NOT NULL DEFAULT 'PENDIENTE' CHECK (estado IN ('PENDIENTE','CONFIRMADA','ENTREGADA','CANCELADA','EXPIRADA')),
  respuesta_expira_en timestamptz NOT NULL,
  confirmado_en timestamptz,
  recogida_expira_en timestamptz,
  motivo_cierre text,
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  creado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT reserva_inventario_tenant FOREIGN KEY (inventario_id,farmacia_id,medicamento_id)
    REFERENCES f02.inventario(id,farmacia_id,medicamento_id) ON DELETE RESTRICT,
  CONSTRAINT reserva_confirmacion_coherente CHECK (
    (estado='PENDIENTE' AND confirmado_en IS NULL AND recogida_expira_en IS NULL) OR
    (estado IN ('CONFIRMADA','ENTREGADA') AND confirmado_en IS NOT NULL AND recogida_expira_en IS NOT NULL) OR
    (estado IN ('CANCELADA','EXPIRADA'))
  )
);
CREATE UNIQUE INDEX reserva_id_farmacia_unique ON f04.reserva(id,farmacia_id);

CREATE TABLE f04.transicion_reserva (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), reserva_id uuid NOT NULL, farmacia_id uuid NOT NULL,
  estado_origen text, estado_destino text NOT NULL, actor_usuario_id uuid REFERENCES f01.usuario(id),
  origen text NOT NULL CHECK (origen IN ('USUARIO','FARMACIA','WORKER')),
  motivo text, correlacion_id uuid NOT NULL, ocurrido_en timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (reserva_id,farmacia_id) REFERENCES f04.reserva(id,farmacia_id) ON DELETE RESTRICT
);

CREATE TABLE f04.idempotencia (
  actor_usuario_id uuid NOT NULL REFERENCES f01.usuario(id), operacion text NOT NULL,
  clave_hash text NOT NULL, huella text NOT NULL, reserva_id uuid,
  resultado jsonb, creado_en timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(actor_usuario_id,operacion,clave_hash)
);

CREATE TABLE f04.incidencia_stock (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), reserva_id uuid NOT NULL, farmacia_id uuid NOT NULL,
  inventario_id uuid NOT NULL, cantidad integer NOT NULL CHECK(cantidad>0), motivo text NOT NULL,
  actor_usuario_id uuid NOT NULL REFERENCES f01.usuario(id), correlacion_id uuid NOT NULL,
  creado_en timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (reserva_id,farmacia_id) REFERENCES f04.reserva(id,farmacia_id)
);

CREATE TABLE f04.outbox_evento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), farmacia_id uuid NOT NULL, reserva_id uuid NOT NULL,
  tipo text NOT NULL, payload jsonb NOT NULL, correlacion_id uuid NOT NULL,
  creado_en timestamptz NOT NULL DEFAULT now(), publicado_en timestamptz, intentos integer NOT NULL DEFAULT 0,
  FOREIGN KEY (reserva_id,farmacia_id) REFERENCES f04.reserva(id,farmacia_id)
);

-- Replaced by the hardened authorization function in migration 002.
CREATE FUNCTION f04.can_reservation_action(uuid,text) RETURNS boolean LANGUAGE sql STABLE AS 'SELECT false';

CREATE FUNCTION f04.guard_reservation_update() RETURNS trigger LANGUAGE plpgsql AS $body$
BEGIN
  IF NEW.usuario_id<>OLD.usuario_id OR NEW.farmacia_id<>OLD.farmacia_id OR
     NEW.inventario_id<>OLD.inventario_id OR NEW.medicamento_id<>OLD.medicamento_id OR
     NEW.cantidad<>OLD.cantidad OR NEW.respuesta_expira_en<>OLD.respuesta_expira_en OR NEW.creado_en<>OLD.creado_en THEN
    RAISE EXCEPTION 'campos inmutables de reserva';
  END IF;
  IF OLD.estado IN ('ENTREGADA','CANCELADA','EXPIRADA') THEN RAISE EXCEPTION 'estado terminal'; END IF;
  IF NEW.estado=OLD.estado THEN RETURN NEW; END IF;
  IF NOT ((OLD.estado='PENDIENTE' AND NEW.estado IN ('CONFIRMADA','CANCELADA','EXPIRADA')) OR
          (OLD.estado='CONFIRMADA' AND NEW.estado IN ('ENTREGADA','CANCELADA','EXPIRADA'))) THEN
    RAISE EXCEPTION 'transicion no permitida';
  END IF;
  IF NEW.estado='CONFIRMADA' AND NOT f04.can_reservation_action(OLD.farmacia_id,'reservation.accept') THEN RAISE EXCEPTION 'sin permiso accept'; END IF;
  IF NEW.estado='ENTREGADA' AND NOT f04.can_reservation_action(OLD.farmacia_id,'reservation.deliver') THEN RAISE EXCEPTION 'sin permiso deliver'; END IF;
  IF NEW.estado='CANCELADA' AND NOT (OLD.usuario_id=NULLIF(current_setting('app.actor_user_id',true),'')::uuid OR f04.can_reservation_action(OLD.farmacia_id,'reservation.accept')) THEN RAISE EXCEPTION 'sin permiso cancel'; END IF;
  IF NEW.estado='EXPIRADA' AND current_user<>'f04_expiration_worker' THEN RAISE EXCEPTION 'sin permiso worker'; END IF;
  IF OLD.recogida_expira_en IS NOT NULL AND NEW.recogida_expira_en IS DISTINCT FROM OLD.recogida_expira_en THEN
    RAISE EXCEPTION 'vencimiento inmutable';
  END IF;
  NEW.version=OLD.version+1; NEW.actualizado_en=now(); RETURN NEW;
END $body$;
CREATE TRIGGER reserva_guard BEFORE UPDATE ON f04.reserva FOR EACH ROW EXECUTE FUNCTION f04.guard_reservation_update();
