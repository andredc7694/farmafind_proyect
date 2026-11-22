-- Correct the first TEST-only installation and grant ON CONFLICT arbiter reads to the sealed executor.
GRANT SELECT ON f04.outbox_evento TO f04_stock_executor;
CREATE POLICY f04_stock_outbox_select ON f04.outbox_evento FOR SELECT TO f04_stock_executor USING (true);

CREATE OR REPLACE FUNCTION f04.reserve_stock(p_actor uuid,p_pharmacy uuid,p_medication uuid,p_quantity integer,
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
