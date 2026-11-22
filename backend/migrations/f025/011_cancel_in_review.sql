-- F02.5 TEST: align cancellation from EN_REVISION with approved FR-005.
CREATE OR REPLACE FUNCTION f025.change_application(p_application uuid,p_version integer,p_action text,
  p_reason text,p_correlation uuid)
RETURNS TABLE(application_id uuid,new_state text,new_version integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,f01,f025 AS $fn$
DECLARE v_request f025.solicitud%ROWTYPE; v_actor uuid; v_next text; v_event text;
BEGIN
  IF current_setting('cluster_name')<>'farmafind-f025-test' OR
    current_database() !~ '^farmafind_f01_test_[a-f0-9]{12}$' OR
    (SELECT description FROM pg_shdescription WHERE objoid=(SELECT oid FROM pg_database
      WHERE datname=current_database())) IS DISTINCT FROM 'FarmaFind F07 TEST efimera' THEN
    RAISE EXCEPTION 'F02.5: solo base efimera TEST' USING ERRCODE='42501';
  END IF;
  v_actor:=f025.authenticated_actor();
  IF v_actor IS NULL OR p_application IS NULL OR p_version IS NULL OR p_version<1
    OR p_correlation IS NULL OR p_action NOT IN
      ('ENVIAR','REENVIAR','CANCELAR','INICIAR_REVISION','OBSERVAR','RECHAZAR') THEN
    RAISE EXCEPTION 'F02.5: operacion no autorizada' USING ERRCODE='42501';
  END IF;
  SELECT * INTO v_request FROM f025.solicitud s WHERE s.id=p_application FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'F02.5: solicitud no visible' USING ERRCODE='42501'; END IF;
  IF v_request.version<>p_version THEN RAISE EXCEPTION 'F02.5: version en conflicto' USING ERRCODE='40001'; END IF;
  CASE p_action
    WHEN 'ENVIAR' THEN
      IF v_request.solicitante_id<>v_actor OR v_request.estado<>'BORRADOR' THEN
        RAISE EXCEPTION 'F02.5: envio no autorizado' USING ERRCODE='42501'; END IF;
      v_next:='PENDIENTE'; v_event:='SOLICITUD_ENVIADA';
    WHEN 'REENVIAR' THEN
      IF v_request.solicitante_id<>v_actor OR v_request.estado<>'OBSERVADA' THEN
        RAISE EXCEPTION 'F02.5: reenvio no autorizado' USING ERRCODE='42501'; END IF;
      v_next:='PENDIENTE'; v_event:='SOLICITUD_ENVIADA';
    WHEN 'CANCELAR' THEN
      IF v_request.solicitante_id<>v_actor OR v_request.estado NOT IN
        ('BORRADOR','PENDIENTE','EN_REVISION','OBSERVADA') THEN
        RAISE EXCEPTION 'F02.5: cancelacion no autorizada' USING ERRCODE='42501'; END IF;
      v_next:='CANCELADA';
    WHEN 'INICIAR_REVISION' THEN
      IF v_request.solicitante_id=v_actor OR v_request.estado<>'PENDIENTE' OR
        NOT f025.has_capability('F025_APPLICATION_REVIEW') THEN
        RAISE EXCEPTION 'F02.5: revision no autorizada' USING ERRCODE='42501'; END IF;
      v_next:='EN_REVISION';
    WHEN 'OBSERVAR' THEN
      IF v_request.solicitante_id=v_actor OR v_request.estado<>'EN_REVISION' OR
        NOT f025.has_capability('F025_APPLICATION_REVIEW') THEN
        RAISE EXCEPTION 'F02.5: observacion no autorizada' USING ERRCODE='42501'; END IF;
      v_next:='OBSERVADA'; v_event:='SOLICITUD_OBSERVADA';
    WHEN 'RECHAZAR' THEN
      IF v_request.solicitante_id=v_actor OR v_request.estado<>'EN_REVISION' OR
        NOT f025.has_capability('F025_APPLICATION_DECIDE') THEN
        RAISE EXCEPTION 'F02.5: rechazo no autorizado' USING ERRCODE='42501'; END IF;
      v_next:='RECHAZADA'; v_event:='SOLICITUD_RECHAZADA';
  END CASE;
  IF p_action IN ('OBSERVAR','RECHAZAR') AND
    (p_reason IS NULL OR char_length(btrim(p_reason)) NOT BETWEEN 8 AND 500) THEN
    RAISE EXCEPTION 'F02.5: motivo obligatorio' USING ERRCODE='22023';
  END IF;
  UPDATE f025.solicitud s SET estado=v_next,version=s.version+1,updated_at=now(),
    submitted_at=CASE WHEN v_next='PENDIENTE' THEN now() ELSE s.submitted_at END,
    decided_at=CASE WHEN v_next='RECHAZADA' THEN now() ELSE s.decided_at END
    WHERE s.id=p_application;
  INSERT INTO f025.revision(solicitud_id,actor_id,accion,estado_anterior,estado_nuevo,
    motivo,version_anterior,version_nueva,correlation_id)
    VALUES(p_application,v_actor,p_action,v_request.estado,v_next,p_reason,
      p_version,p_version+1,p_correlation);
  IF v_event IS NOT NULL THEN
    INSERT INTO f025.outbox_evento(solicitud_id,destinatario_usuario_id,tipo,version_solicitud,correlation_id)
      VALUES(p_application,v_request.solicitante_id,v_event,p_version+1,p_correlation);
  END IF;
  application_id:=p_application;new_state:=v_next;new_version:=p_version+1;
  RETURN NEXT;
END $fn$;
ALTER FUNCTION f025.change_application(uuid,integer,text,text,uuid) OWNER TO f025_policy;
REVOKE ALL ON FUNCTION f025.change_application(uuid,integer,text,text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION f025.change_application(uuid,integer,text,text,uuid) TO f01_runtime;
