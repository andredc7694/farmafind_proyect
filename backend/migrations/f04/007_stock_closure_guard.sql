-- Reject forged timestamps and invalid closure reasons in direct EXECUTE calls.
CREATE OR REPLACE FUNCTION f04.close_reservation_stock(p_actor uuid,p_reservation uuid,p_pharmacy uuid,
  p_target text,p_reason text,p_at timestamptz,p_correlation uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,f01,f02,f04 AS $fn$
DECLARE v_reservation f04.reserva%ROWTYPE; v_stock f02.inventario%ROWTYPE; v_affected integer;
BEGIN
  IF p_actor IS NULL OR p_actor IS DISTINCT FROM NULLIF(current_setting('app.actor_user_id',true),'')::uuid
    OR NOT f04.has_live_actor() OR p_reservation IS NULL OR p_pharmacy IS NULL
    OR p_pharmacy::text IS DISTINCT FROM NULLIF(current_setting('app.farmacia_id',true),'')
    OR p_target NOT IN ('CANCELADA','ENTREGADA') OR p_target IS NULL
    OR p_at IS NULL OR p_correlation IS NULL
    OR (p_target='ENTREGADA' AND p_reason IS NOT NULL)
    OR (p_target='CANCELADA' AND p_reason NOT IN ('CANCELADA_POR_USUARIO','FALTA_FISICA'))
    OR (p_target='CANCELADA' AND p_reason IS NULL) THEN
    RAISE EXCEPTION 'transicion no autorizada' USING ERRCODE='42501';
  END IF;
  SELECT * INTO v_reservation FROM f04.reserva
    WHERE id=p_reservation AND farmacia_id=p_pharmacy FOR UPDATE;
  IF NOT FOUND OR v_reservation.estado NOT IN ('PENDIENTE','CONFIRMADA') THEN
    RAISE EXCEPTION 'Transicion no permitida' USING ERRCODE='23514';
  END IF;
  IF p_target='ENTREGADA' THEN
    IF v_reservation.estado<>'CONFIRMADA' OR v_reservation.recogida_expira_en IS NULL
      OR v_reservation.recogida_expira_en<=clock_timestamp()
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
