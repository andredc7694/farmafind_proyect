-- ADR-F04-SEC-001: reservation stock changes are narrow, atomic operations.
-- Preserve the historical migration; remove its permissive runtime policies.
DROP POLICY inventory_reservation_select ON f02.inventario;
DROP POLICY inventory_reservation_update ON f02.inventario;
REVOKE UPDATE (cantidad_comprometida) ON f02.inventario FROM f01_runtime;

DO $role$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='f04_stock_executor') THEN
    CREATE ROLE f04_stock_executor NOLOGIN NOSUPERUSER NOBYPASSRLS;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='f04_stock_executor'
    AND (rolcanlogin OR rolsuper OR rolbypassrls)) THEN
    RAISE EXCEPTION 'f04_stock_executor must be NOLOGIN NOSUPERUSER NOBYPASSRLS';
  END IF;
END $role$;

GRANT USAGE ON SCHEMA f01,f02,f04 TO f04_stock_executor;
GRANT SELECT (id,estado) ON f01.farmacia_referencia TO f04_stock_executor;
GRANT SELECT ON f02.inventario TO f04_stock_executor;
GRANT UPDATE (cantidad_comprometida,cantidad_fisica,version) ON f02.inventario TO f04_stock_executor;
GRANT SELECT,INSERT,UPDATE (estado,confirmado_en,recogida_expira_en,motivo_cierre)
  ON f04.reserva TO f04_stock_executor;
GRANT INSERT ON f04.transicion_reserva,f04.outbox_evento,f04.incidencia_stock,f02.movimiento
  TO f04_stock_executor;
GRANT EXECUTE ON FUNCTION f04.has_live_actor(),f04.can_reservation_action(uuid,text)
  TO f04_stock_executor;

CREATE POLICY f04_stock_inventory_select ON f02.inventario FOR SELECT TO f04_stock_executor USING (true);
CREATE POLICY f04_stock_inventory_update ON f02.inventario FOR UPDATE TO f04_stock_executor
  USING (true) WITH CHECK (true);
CREATE POLICY f04_stock_reservation_select ON f04.reserva FOR SELECT TO f04_stock_executor USING (true);
CREATE POLICY f04_stock_reservation_insert ON f04.reserva FOR INSERT TO f04_stock_executor WITH CHECK (true);
CREATE POLICY f04_stock_reservation_update ON f04.reserva FOR UPDATE TO f04_stock_executor
  USING (true) WITH CHECK (true);
CREATE POLICY f04_stock_transition_insert ON f04.transicion_reserva FOR INSERT TO f04_stock_executor WITH CHECK (true);
CREATE POLICY f04_stock_outbox_insert ON f04.outbox_evento FOR INSERT TO f04_stock_executor WITH CHECK (true);
CREATE POLICY f04_stock_incidence_insert ON f04.incidencia_stock FOR INSERT TO f04_stock_executor WITH CHECK (true);
CREATE POLICY f04_stock_movement_insert ON f02.movimiento FOR INSERT TO f04_stock_executor WITH CHECK (true);

CREATE FUNCTION f04.reserve_stock(p_actor uuid,p_pharmacy uuid,p_medication uuid,p_quantity integer,
  p_response_expires timestamptz,p_correlation uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,f01,f02,f04 AS $fn$
DECLARE v_stock f02.inventario%ROWTYPE; v_reservation uuid;
BEGIN
  IF p_actor IS NULL OR p_actor IS DISTINCT FROM NULLIF(current_setting('app.actor_user_id',true),'')::uuid
    OR NOT f04.has_live_actor() OR p_pharmacy IS NULL
    OR p_pharmacy::text IS DISTINCT FROM NULLIF(current_setting('app.farmacia_id',true),'')
    OR p_medication IS NULL OR p_quantity IS NULL OR p_quantity < 1
    OR p_response_expires IS NULL OR p_correlation IS NULL
    OR NOT EXISTS (SELECT 1 FROM f01.farmacia_referencia WHERE id=p_pharmacy AND estado='ACTIVA') THEN
    RAISE EXCEPTION 'reserva no autorizada' USING ERRCODE='42501';
  END IF;
  SELECT * INTO v_stock FROM f02.inventario
    WHERE farmacia_id=p_pharmacy AND medicamento_id=p_medication FOR UPDATE;
  IF NOT FOUND OR v_stock.cantidad_fisica-v_stock.cantidad_comprometida < p_quantity THEN
    RAISE EXCEPTION 'Sin disponibilidad' USING ERRCODE='23514';
  END IF;
  INSERT INTO f04.reserva(usuario_id,farmacia_id,inventario_id,medicamento_id,cantidad,respuesta_expira_en)
    VALUES(p_actor,p_pharmacy,v_stock.id,p_medication,p_quantity,p_response_expires)
    RETURNING id INTO v_reservation;
  UPDATE f02.inventario SET cantidad_comprometida=cantidad_comprometida+p_quantity,version=version+1
    WHERE id=v_stock.id AND farmacia_id=p_pharmacy;
  INSERT INTO f04.transicion_reserva(reserva_id,farmacia_id,estado_destino,actor_usuario_id,origen,correlacion_id)
    VALUES(v_reservation,p_pharmacy,'PENDIENTE',p_actor,'USUARIO',p_correlation);
  INSERT INTO f04.outbox_evento(farmacia_id,reserva_id,tipo,payload,correlacion_id)
    VALUES(p_pharmacy,v_reservation,'RESERVA_CREADA',
      jsonb_build_object('reservationId',v_reservation,'state','PENDIENTE'),p_correlation);
  RETURN v_reservation;
END $fn$;
ALTER FUNCTION f04.reserve_stock(uuid,uuid,uuid,integer,timestamptz,uuid) OWNER TO f04_stock_executor;
REVOKE ALL ON FUNCTION f04.reserve_stock(uuid,uuid,uuid,integer,timestamptz,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION f04.reserve_stock(uuid,uuid,uuid,integer,timestamptz,uuid) TO f01_runtime;

CREATE FUNCTION f04.close_reservation_stock(p_actor uuid,p_reservation uuid,p_pharmacy uuid,
  p_target text,p_reason text,p_at timestamptz,p_correlation uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,f01,f02,f04 AS $fn$
DECLARE v_reservation f04.reserva%ROWTYPE; v_stock f02.inventario%ROWTYPE; v_affected integer;
BEGIN
  IF p_actor IS NULL OR p_actor IS DISTINCT FROM NULLIF(current_setting('app.actor_user_id',true),'')::uuid
    OR NOT f04.has_live_actor() OR p_reservation IS NULL OR p_pharmacy IS NULL
    OR p_pharmacy::text IS DISTINCT FROM NULLIF(current_setting('app.farmacia_id',true),'')
    OR p_target NOT IN ('CANCELADA','ENTREGADA') OR p_target IS NULL
    OR p_at IS NULL OR p_correlation IS NULL THEN
    RAISE EXCEPTION 'transicion no autorizada' USING ERRCODE='42501';
  END IF;
  SELECT * INTO v_reservation FROM f04.reserva
    WHERE id=p_reservation AND farmacia_id=p_pharmacy FOR UPDATE;
  IF NOT FOUND OR v_reservation.estado NOT IN ('PENDIENTE','CONFIRMADA') THEN
    RAISE EXCEPTION 'Transicion no permitida' USING ERRCODE='23514';
  END IF;
  IF p_target='ENTREGADA' THEN
    IF v_reservation.estado<>'CONFIRMADA' OR v_reservation.recogida_expira_en IS NULL
      OR v_reservation.recogida_expira_en<=p_at
      OR NOT f04.can_reservation_action(p_pharmacy,'reservation.deliver') THEN
      RAISE EXCEPTION 'entrega no autorizada o vencida' USING ERRCODE='42501';
    END IF;
  ELSIF p_reason='FALTA_FISICA' THEN
    IF NOT f04.can_reservation_action(p_pharmacy,'reservation.accept') THEN
      RAISE EXCEPTION 'incidencia no autorizada' USING ERRCODE='42501';
    END IF;
  ELSIF v_reservation.usuario_id<>p_actor THEN
    RAISE EXCEPTION 'cancelacion no autorizada' USING ERRCODE='42501';
  END IF;
  SELECT * INTO v_stock FROM f02.inventario
    WHERE id=v_reservation.inventario_id AND farmacia_id=p_pharmacy FOR UPDATE;
  IF NOT FOUND OR v_stock.cantidad_comprometida<v_reservation.cantidad
    OR (p_target='ENTREGADA' AND v_stock.cantidad_fisica<v_reservation.cantidad) THEN
    RAISE EXCEPTION 'stock inconsistente' USING ERRCODE='23514';
  END IF;
  UPDATE f02.inventario SET cantidad_comprometida=cantidad_comprometida-v_reservation.cantidad,
    cantidad_fisica=cantidad_fisica-CASE WHEN p_target='ENTREGADA' THEN v_reservation.cantidad ELSE 0 END,
    version=version+1 WHERE id=v_stock.id AND farmacia_id=p_pharmacy;
  GET DIAGNOSTICS v_affected=ROW_COUNT;
  IF v_affected<>1 THEN RAISE EXCEPTION 'stock inconsistente' USING ERRCODE='23514'; END IF;
  UPDATE f04.reserva SET estado=p_target,motivo_cierre=p_reason
    WHERE id=p_reservation AND farmacia_id=p_pharmacy;
  GET DIAGNOSTICS v_affected=ROW_COUNT;
  IF v_affected<>1 THEN RAISE EXCEPTION 'Conflicto de reserva' USING ERRCODE='23514'; END IF;
  INSERT INTO f04.transicion_reserva(reserva_id,farmacia_id,estado_origen,estado_destino,
    actor_usuario_id,origen,motivo,correlacion_id)
    VALUES(p_reservation,p_pharmacy,v_reservation.estado,p_target,p_actor,
      CASE WHEN p_target='CANCELADA' AND p_reason IS DISTINCT FROM 'FALTA_FISICA' THEN 'USUARIO' ELSE 'FARMACIA' END,
      p_reason,p_correlation);
  IF p_reason='FALTA_FISICA' THEN
    INSERT INTO f04.incidencia_stock(reserva_id,farmacia_id,inventario_id,cantidad,motivo,actor_usuario_id,correlacion_id)
      VALUES(p_reservation,p_pharmacy,v_stock.id,v_reservation.cantidad,'FALTA_FISICA',p_actor,p_correlation);
  END IF;
  IF p_reason='FALTA_FISICA' OR p_target='ENTREGADA' THEN
    INSERT INTO f02.movimiento(farmacia_id,inventario_id,medicamento_id,cantidad_antes,cantidad_despues,
      precio_antes_centavos,precio_despues_centavos,motivo,actor_usuario_id,correlacion_id)
      VALUES(p_pharmacy,v_stock.id,v_reservation.medicamento_id,v_stock.cantidad_fisica,
        v_stock.cantidad_fisica-CASE WHEN p_target='ENTREGADA' THEN v_reservation.cantidad ELSE 0 END,
        v_stock.precio_centavos,v_stock.precio_centavos,
        CASE WHEN p_reason='FALTA_FISICA' THEN 'FALTA_FISICA_RESERVA' ELSE 'ENTREGA_RESERVA' END,
        p_actor,p_correlation);
  END IF;
  INSERT INTO f04.outbox_evento(farmacia_id,reserva_id,tipo,payload,correlacion_id)
    VALUES(p_pharmacy,p_reservation,'RESERVA_'||p_target,
      jsonb_build_object('reservationId',p_reservation,'state',p_target),p_correlation)
    ON CONFLICT(reserva_id,tipo) DO NOTHING;
  RETURN p_reservation;
END $fn$;
ALTER FUNCTION f04.close_reservation_stock(uuid,uuid,uuid,text,text,timestamptz,uuid)
  OWNER TO f04_stock_executor;
REVOKE ALL ON FUNCTION f04.close_reservation_stock(uuid,uuid,uuid,text,text,timestamptz,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION f04.close_reservation_stock(uuid,uuid,uuid,text,text,timestamptz,uuid)
  TO f01_runtime;
REVOKE CREATE ON SCHEMA f04 FROM f04_stock_executor;
