-- F02.2 (spec 020) · PROPUESTA para revisión de Andre (NO aplicada). Destino tras la aprobación:
--   backend/migrations/f02/008_catalog_proposals.sql (copia literal, verificada por SHA-256).
-- Propuestas de productos nuevos (D-04 A), revisor de catálogo con segundo factor (D-05 A) y
-- vinculación automática de propuestas ya aprobadas (D-09 A). ADITIVA: no cambia políticas,
-- funciones ni restricciones existentes. Sin BYPASSRLS: las funciones SECURITY DEFINER pertenecen a
-- f022_catalog (NOLOGIN, NOBYPASSRLS), que solo ve lo que sus políticas propias permiten.
-- Las propuestas NO guardan precio, stock, reservas ni archivos: solo la ficha del producto.
-- Quién propone (plan P-01 A): quien puede confirmar importaciones en su farmacia
-- (f02.can_inventory_action(farmacia,'inventory.import.confirm')); no hay capacidad nueva.

DO $roles$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='f022_catalog') THEN
    CREATE ROLE f022_catalog NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='f022_catalog'
             AND (rolsuper OR rolbypassrls OR rolcanlogin OR rolcreatedb OR rolcreaterole OR rolreplication)) THEN
    RAISE EXCEPTION 'F02.2: rol interno con privilegios indebidos';
  END IF;
END;
$roles$;
GRANT USAGE ON SCHEMA f01, f02 TO f022_catalog;

-- 1) Concesión explícita de revisor de catálogo (alta y revocación solo offline TEST).
CREATE TABLE f02.catalogo_revisor (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL REFERENCES f01.usuario(id) ON DELETE RESTRICT,
  estado text NOT NULL DEFAULT 'ACTIVA' CHECK (estado IN ('ACTIVA','REVOCADA')),
  approval_id uuid NOT NULL,
  approval_sha256 text NOT NULL CHECK (approval_sha256 ~ '^[a-f0-9]{64}$'),
  reason text NOT NULL CHECK (char_length(btrim(reason)) BETWEEN 10 AND 300),
  granted_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  CONSTRAINT catalogo_revisor_revocacion CHECK ((estado='ACTIVA') = (revoked_at IS NULL))
);
CREATE UNIQUE INDEX catalogo_revisor_activa_unica ON f02.catalogo_revisor(actor_id) WHERE estado='ACTIVA';

-- 2) Lotes y propuestas de la farmacia.
CREATE TABLE f02.propuesta_lote (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farmacia_id uuid NOT NULL REFERENCES f01.farmacia_referencia(id) ON DELETE RESTRICT,
  solicitante_id uuid NOT NULL REFERENCES f01.usuario(id) ON DELETE RESTRICT,
  importacion_id uuid REFERENCES f02.importacion(id) ON DELETE RESTRICT,
  total integer NOT NULL CHECK (total BETWEEN 1 AND 1000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX propuesta_lote_farmacia_idx ON f02.propuesta_lote(farmacia_id, created_at DESC);

CREATE TABLE f02.propuesta_producto (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lote_id uuid NOT NULL REFERENCES f02.propuesta_lote(id) ON DELETE RESTRICT,
  farmacia_id uuid NOT NULL REFERENCES f01.farmacia_referencia(id) ON DELETE RESTRICT,
  solicitante_id uuid NOT NULL REFERENCES f01.usuario(id) ON DELETE RESTRICT,
  numero_fila integer CHECK (numero_fila BETWEEN 2 AND 5242880),
  codigo_archivo text CHECK (char_length(codigo_archivo) BETWEEN 1 AND 60),
  nombre text NOT NULL CHECK (char_length(nombre) BETWEEN 1 AND 160 AND nombre=regexp_replace(lower(btrim(nombre)),'\s+',' ','g')),
  principio_activo text NOT NULL CHECK (char_length(principio_activo) BETWEEN 2 AND 160
    AND principio_activo=regexp_replace(lower(btrim(principio_activo)),'\s+',' ','g')),
  concentracion text NOT NULL CHECK (char_length(concentracion) BETWEEN 1 AND 80 AND concentracion=regexp_replace(lower(btrim(concentracion)),'\s+',' ','g')),
  presentacion text NOT NULL CHECK (char_length(presentacion) BETWEEN 1 AND 120 AND presentacion=regexp_replace(lower(btrim(presentacion)),'\s+',' ','g')),
  forma_farmaceutica text NOT NULL DEFAULT '' CHECK (forma_farmaceutica IN ('', 'tableta', 'capsula', 'jarabe',
      'suspension', 'solucion', 'gotas', 'crema', 'gel', 'unguento', 'inyectable', 'supositorio', 'ovulo',
      'sobre', 'parche', 'spray', 'inhalador')),
  clasificacion text NOT NULL CHECK (char_length(clasificacion) BETWEEN 1 AND 120 AND clasificacion=regexp_replace(lower(btrim(clasificacion)),'\s+',' ','g')),
  laboratorio text NOT NULL DEFAULT '' CHECK (char_length(laboratorio) <= 120 AND laboratorio=regexp_replace(lower(btrim(laboratorio)),'\s+',' ','g')),
  marca text NOT NULL DEFAULT '' CHECK (char_length(marca) <= 120 AND marca=regexp_replace(lower(btrim(marca)),'\s+',' ','g')),
  -- Las filas con aviso no entran en decisiones por lote: se revisan una a una.
  aviso text CHECK (aviso IN ('SIN_LABORATORIO','SIN_FORMA','POSIBLE_DUPLICADO')),
  medicamento_sugerido_id uuid REFERENCES f02.medicamento(id) ON DELETE RESTRICT,
  estado text NOT NULL DEFAULT 'PROPUESTA' CHECK (estado IN ('PROPUESTA','APROBADA','RECHAZADA','YA_EXISTE')),
  automatica boolean NOT NULL DEFAULT false,
  medicamento_id uuid REFERENCES f02.medicamento(id) ON DELETE RESTRICT,
  motivo text CHECK (motivo IS NULL OR char_length(btrim(motivo)) BETWEEN 8 AND 500),
  decidido_por uuid REFERENCES f01.usuario(id) ON DELETE RESTRICT,
  decidido_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  CONSTRAINT propuesta_decision_coherente CHECK (
    (estado='PROPUESTA' AND medicamento_id IS NULL AND decidido_at IS NULL AND decidido_por IS NULL AND NOT automatica) OR
    (estado IN ('APROBADA','YA_EXISTE') AND medicamento_id IS NOT NULL AND decidido_at IS NOT NULL
      AND (automatica = (decidido_por IS NULL))) OR
    (estado='RECHAZADA' AND medicamento_id IS NULL AND motivo IS NOT NULL AND decidido_por IS NOT NULL
      AND decidido_at IS NOT NULL AND NOT automatica)),
  CONSTRAINT propuesta_automatica_solo_vinculo CHECK (NOT automatica OR estado='YA_EXISTE')
);
-- Una sola propuesta abierta por farmacia e identidad.
CREATE UNIQUE INDEX propuesta_abierta_unica ON f02.propuesta_producto
  (farmacia_id, nombre, concentracion, presentacion, forma_farmaceutica, clasificacion, laboratorio, marca)
  WHERE estado='PROPUESTA';
CREATE INDEX propuesta_identidad_idx ON f02.propuesta_producto
  (nombre, concentracion, presentacion, forma_farmaceutica, clasificacion, laboratorio, marca) WHERE estado='PROPUESTA';
CREATE INDEX propuesta_farmacia_estado_idx ON f02.propuesta_producto(farmacia_id, estado, created_at DESC);
CREATE INDEX propuesta_revision_idx ON f02.propuesta_producto(estado, laboratorio, forma_farmaceutica, farmacia_id);

-- 3) Revisión por lote con muestra obligatoria (solo del propio revisor).
CREATE TABLE f02.revision_lote (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  revisor_id uuid NOT NULL REFERENCES f01.usuario(id) ON DELETE RESTRICT,
  propuestas uuid[] NOT NULL CHECK (cardinality(propuestas) BETWEEN 1 AND 1000),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  usada_at timestamptz,
  CONSTRAINT revision_lote_vigencia CHECK (expires_at > created_at AND expires_at <= created_at + interval '30 minutes')
);
CREATE TABLE f02.revision_muestra (
  revision_lote_id uuid NOT NULL REFERENCES f02.revision_lote(id) ON DELETE RESTRICT,
  propuesta_id uuid NOT NULL REFERENCES f02.propuesta_producto(id) ON DELETE RESTRICT,
  resultado text NOT NULL DEFAULT 'PENDIENTE' CHECK (resultado IN ('PENDIENTE','CORRECTA','INCORRECTA')),
  marcada_at timestamptz,
  PRIMARY KEY (revision_lote_id, propuesta_id)
);

-- 4) Auditoría inmutable de cada decisión (también las automáticas, sin actor humano).
CREATE TABLE f02.catalogo_auditoria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  propuesta_id uuid NOT NULL REFERENCES f02.propuesta_producto(id) ON DELETE RESTRICT,
  farmacia_id uuid NOT NULL REFERENCES f01.farmacia_referencia(id) ON DELETE RESTRICT,
  actor_id uuid REFERENCES f01.usuario(id) ON DELETE RESTRICT,
  accion text NOT NULL CHECK (accion IN ('APROBAR','RECHAZAR','VINCULAR','VINCULO_AUTOMATICO')),
  medicamento_id uuid REFERENCES f02.medicamento(id) ON DELETE RESTRICT,
  motivo text,
  revision_lote_id uuid REFERENCES f02.revision_lote(id) ON DELETE RESTRICT,
  correlation_id uuid NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT auditoria_automatica_sin_actor CHECK ((accion='VINCULO_AUTOMATICO') = (actor_id IS NULL))
);
CREATE INDEX catalogo_auditoria_propuesta_idx ON f02.catalogo_auditoria(propuesta_id, occurred_at);

ALTER TABLE f02.catalogo_revisor ENABLE ROW LEVEL SECURITY;   ALTER TABLE f02.catalogo_revisor FORCE ROW LEVEL SECURITY;
ALTER TABLE f02.propuesta_lote ENABLE ROW LEVEL SECURITY;     ALTER TABLE f02.propuesta_lote FORCE ROW LEVEL SECURITY;
ALTER TABLE f02.propuesta_producto ENABLE ROW LEVEL SECURITY; ALTER TABLE f02.propuesta_producto FORCE ROW LEVEL SECURITY;
ALTER TABLE f02.revision_lote ENABLE ROW LEVEL SECURITY;      ALTER TABLE f02.revision_lote FORCE ROW LEVEL SECURITY;
ALTER TABLE f02.revision_muestra ENABLE ROW LEVEL SECURITY;   ALTER TABLE f02.revision_muestra FORCE ROW LEVEL SECURITY;
ALTER TABLE f02.catalogo_auditoria ENABLE ROW LEVEL SECURITY; ALTER TABLE f02.catalogo_auditoria FORCE ROW LEVEL SECURITY;
REVOKE ALL ON f02.catalogo_revisor, f02.propuesta_lote, f02.propuesta_producto, f02.revision_lote,
  f02.revision_muestra, f02.catalogo_auditoria FROM PUBLIC;

-- 5) Lo mínimo que f022_catalog lee de F01: la sesión de la huella actual y las filas del actor.
GRANT SELECT (id, usuario_id, token_fingerprint, estado, idle_expires_at, absolute_expires_at,
  mfa_verificada_at, restringida_motivo) ON f01.sesion TO f022_catalog;
CREATE POLICY f022_sesion_actual ON f01.sesion FOR SELECT TO f022_catalog
  USING (token_fingerprint = decode(NULLIF(current_setting('app.session_fingerprint',true),''),'hex'));
GRANT SELECT (id, estado) ON f01.usuario TO f022_catalog;
GRANT SELECT (usuario_id, role_code, estado) ON f01.platform_role_assignment TO f022_catalog;
GRANT SELECT (usuario_id, farmacia_id) ON f01.usuario_farmacia TO f022_catalog;
CREATE POLICY f022_membresias_propias ON f01.usuario_farmacia FOR SELECT TO f022_catalog
  USING (usuario_id = NULLIF(current_setting('app.actor_user_id',true),'')::uuid);
GRANT EXECUTE ON FUNCTION f02.can_inventory_action(uuid,text) TO f022_catalog;

-- El catálogo (sin RLS, compartido y público) solo lo escribe f022_catalog dentro de decide_catalog_proposals.
GRANT SELECT, INSERT ON f02.medicamento TO f022_catalog;
GRANT SELECT (id, farmacia_id) ON f02.importacion TO f022_catalog;
CREATE POLICY f022_importacion_propia ON f02.importacion FOR SELECT TO f022_catalog
  USING (f02.can_inventory_action(farmacia_id,'inventory.import.confirm'));

GRANT SELECT (actor_id, estado) ON f02.catalogo_revisor TO f022_catalog;
CREATE POLICY f022_revisor_propio ON f02.catalogo_revisor FOR SELECT TO f022_catalog
  USING (actor_id = NULLIF(current_setting('app.actor_user_id',true),'')::uuid);
GRANT SELECT, INSERT ON f02.propuesta_lote, f02.catalogo_auditoria TO f022_catalog;
GRANT SELECT, INSERT, UPDATE ON f02.propuesta_producto, f02.revision_lote, f02.revision_muestra TO f022_catalog;
-- f022_catalog solo actúa dentro de las funciones de abajo, que comprueban la autorización antes de tocar nada.
CREATE POLICY f022_lote_ejecutor ON f02.propuesta_lote TO f022_catalog USING (true) WITH CHECK (true);
CREATE POLICY f022_propuesta_ejecutor ON f02.propuesta_producto TO f022_catalog USING (true) WITH CHECK (true);
CREATE POLICY f022_revision_ejecutor ON f02.revision_lote TO f022_catalog
  USING (revisor_id = NULLIF(current_setting('app.actor_user_id',true),'')::uuid)
  WITH CHECK (revisor_id = NULLIF(current_setting('app.actor_user_id',true),'')::uuid);
CREATE POLICY f022_muestra_ejecutor ON f02.revision_muestra TO f022_catalog
  USING (EXISTS (SELECT 1 FROM f02.revision_lote r WHERE r.id=revision_lote_id))
  WITH CHECK (EXISTS (SELECT 1 FROM f02.revision_lote r WHERE r.id=revision_lote_id));
CREATE POLICY f022_auditoria_ejecutor ON f02.catalogo_auditoria TO f022_catalog USING (true) WITH CHECK (true);

-- 6) Actor autenticado y autorizaciones.
CREATE FUNCTION f02.catalog_actor() RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, f01, f02
AS $function$
  SELECT u.id FROM f01.sesion s JOIN f01.usuario u ON u.id=s.usuario_id
  WHERE s.token_fingerprint=decode(NULLIF(current_setting('app.session_fingerprint',true),''),'hex')
    AND s.usuario_id=NULLIF(current_setting('app.actor_user_id',true),'')::uuid
    AND s.estado='VIGENTE' AND s.idle_expires_at>now() AND s.absolute_expires_at>now()
    AND u.estado='ACTIVO'
  LIMIT 1;
$function$;

-- Revisor: rol de plataforma activo + concesión activa + segundo factor verificado en esta sesión
-- + nunca miembro (en ningún estado) de la farmacia de la propuesta. scope_id NULL = solo la capacidad.
CREATE FUNCTION f02.can_review_catalog(scope_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, f01, f02
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM f01.sesion s
    JOIN f01.usuario u ON u.id=s.usuario_id AND u.estado='ACTIVO'
    JOIN f01.platform_role_assignment r ON r.usuario_id=u.id
      AND r.role_code='ADMINISTRADOR_PLATAFORMA' AND r.estado='ACTIVA'
    JOIN f02.catalogo_revisor g ON g.actor_id=u.id AND g.estado='ACTIVA'
    WHERE s.token_fingerprint=decode(NULLIF(current_setting('app.session_fingerprint',true),''),'hex')
      AND s.usuario_id=NULLIF(current_setting('app.actor_user_id',true),'')::uuid
      AND s.estado='VIGENTE' AND s.idle_expires_at>now() AND s.absolute_expires_at>now()
      AND s.mfa_verificada_at IS NOT NULL AND s.restringida_motivo IS NULL
      AND (scope_id IS NULL OR NOT EXISTS (SELECT 1 FROM f01.usuario_farmacia m
        WHERE m.usuario_id=u.id AND m.farmacia_id=scope_id)));
$function$;

-- 7) La farmacia propone un lote (máx. 1000). Las identidades ya aprobadas se vinculan solas (D-09 A)
--    y no llegan al revisor; las repetidas de una propuesta abierta de la misma farmacia se omiten.
--    p_items: [{fila, codigo, nombre, principio_activo, concentracion, presentacion, forma, clasificacion,
--               laboratorio, marca, aviso, sugerido}]. Los textos se normalizan aquí (minúsculas y espacios).
CREATE FUNCTION f02.submit_catalog_proposals(p_farmacia uuid, p_importacion uuid, p_items jsonb)
RETURNS TABLE (lote_id uuid, propuestas integer, vinculadas integer, omitidas integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, f01, f02
AS $function$
#variable_conflict use_column
DECLARE
  v_actor uuid := f02.catalog_actor();
  v_lote uuid; v_item jsonb; v_id uuid; v_med uuid; v_prop uuid;
  v_nuevas integer := 0; v_vinculadas integer := 0; v_omitidas integer := 0;
  v_correlation uuid := gen_random_uuid();
  n text; pa text; c text; pr text; fo text; cl text; la text; ma text;
BEGIN
  IF v_actor IS NULL OR NOT f02.can_inventory_action(p_farmacia,'inventory.import.confirm') THEN
    RAISE EXCEPTION 'Permiso insuficiente' USING ERRCODE='42501';
  END IF;
  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) NOT BETWEEN 1 AND 1000 THEN
    RAISE EXCEPTION 'Lote inválido' USING ERRCODE='22023';
  END IF;
  IF p_importacion IS NOT NULL AND NOT EXISTS (SELECT 1 FROM f02.importacion i
      WHERE i.id=p_importacion AND i.farmacia_id=p_farmacia) THEN
    RAISE EXCEPTION 'Importación no visible' USING ERRCODE='42501';
  END IF;
  INSERT INTO f02.propuesta_lote(farmacia_id, solicitante_id, importacion_id, total)
    VALUES (p_farmacia, v_actor, p_importacion, jsonb_array_length(p_items)) RETURNING id INTO v_lote;
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    n  := regexp_replace(lower(btrim(v_item->>'nombre')),'\s+',' ','g');
    pa := regexp_replace(lower(btrim(v_item->>'principio_activo')),'\s+',' ','g');
    c  := regexp_replace(lower(btrim(v_item->>'concentracion')),'\s+',' ','g');
    pr := regexp_replace(lower(btrim(v_item->>'presentacion')),'\s+',' ','g');
    fo := coalesce(v_item->>'forma','');
    cl := regexp_replace(lower(btrim(v_item->>'clasificacion')),'\s+',' ','g');
    la := regexp_replace(lower(btrim(coalesce(v_item->>'laboratorio',''))),'\s+',' ','g');
    ma := regexp_replace(lower(btrim(coalesce(v_item->>'marca',''))),'\s+',' ','g');
    SELECT m.id INTO v_med FROM f02.medicamento m
      WHERE m.nombre=n AND m.concentracion=c AND m.presentacion=pr AND m.forma_farmaceutica=fo
        AND m.clasificacion=cl AND m.laboratorio=la AND m.marca=ma AND m.estado='ACTIVO';
    IF v_med IS NOT NULL THEN
      INSERT INTO f02.propuesta_producto(lote_id, farmacia_id, solicitante_id, numero_fila, codigo_archivo,
          nombre, principio_activo, concentracion, presentacion, forma_farmaceutica, clasificacion, laboratorio, marca,
          estado, automatica, medicamento_id, decidido_at)
        VALUES (v_lote, p_farmacia, v_actor, (v_item->>'fila')::integer, NULLIF(v_item->>'codigo',''),
          n, pa, c, pr, fo, cl, la, ma, 'YA_EXISTE', true, v_med, now())
        RETURNING id INTO v_prop;
      INSERT INTO f02.catalogo_auditoria(propuesta_id, farmacia_id, actor_id, accion, medicamento_id, correlation_id)
        VALUES (v_prop, p_farmacia, NULL, 'VINCULO_AUTOMATICO', v_med, v_correlation);
      v_vinculadas := v_vinculadas + 1;
      CONTINUE;
    END IF;
    INSERT INTO f02.propuesta_producto(lote_id, farmacia_id, solicitante_id, numero_fila, codigo_archivo,
        nombre, principio_activo, concentracion, presentacion, forma_farmaceutica, clasificacion, laboratorio, marca,
        aviso, medicamento_sugerido_id)
      VALUES (v_lote, p_farmacia, v_actor, (v_item->>'fila')::integer, NULLIF(v_item->>'codigo',''),
        n, pa, c, pr, fo, cl, la, ma, NULLIF(v_item->>'aviso',''), NULLIF(v_item->>'sugerido','')::uuid)
      ON CONFLICT (farmacia_id, nombre, concentracion, presentacion, forma_farmaceutica, clasificacion, laboratorio, marca)
        WHERE estado='PROPUESTA' DO NOTHING
      RETURNING id INTO v_id;
    IF v_id IS NULL THEN v_omitidas := v_omitidas + 1; ELSE v_nuevas := v_nuevas + 1; END IF;
    v_id := NULL;
  END LOOP;
  RETURN QUERY SELECT v_lote, v_nuevas, v_vinculadas, v_omitidas;
END;
$function$;

-- 8) El revisor abre una revisión de lote: solo propuestas abiertas, sin aviso y de farmacias que puede
--    revisar. El servidor elige al azar la muestra: todas si son menos de 10; si no, 5 % (mín. 10, máx. 30).
CREATE FUNCTION f02.start_catalog_review(p_ids uuid[]) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, f01, f02
AS $function$
DECLARE
  v_actor uuid := f02.catalog_actor();
  v_total integer := cardinality(p_ids);
  v_validas integer; v_tam integer; v_revision uuid;
BEGIN
  IF v_actor IS NULL OR NOT f02.can_review_catalog(NULL) THEN
    RAISE EXCEPTION 'Permiso insuficiente' USING ERRCODE='42501';
  END IF;
  IF v_total IS NULL OR v_total NOT BETWEEN 1 AND 1000 OR v_total <> (SELECT count(DISTINCT x) FROM unnest(p_ids) x) THEN
    RAISE EXCEPTION 'Selección inválida' USING ERRCODE='22023';
  END IF;
  SELECT count(*) INTO v_validas FROM f02.propuesta_producto p
    WHERE p.id = ANY (p_ids) AND p.estado='PROPUESTA' AND p.aviso IS NULL AND f02.can_review_catalog(p.farmacia_id);
  IF v_validas <> v_total THEN
    RAISE EXCEPTION 'La selección tiene propuestas decididas, con aviso o no revisables' USING ERRCODE='22023';
  END IF;
  v_tam := CASE WHEN v_total < 10 THEN v_total ELSE LEAST(30, GREATEST(10, ceil(v_total * 0.05)::integer)) END;
  INSERT INTO f02.revision_lote(revisor_id, propuestas, expires_at)
    VALUES (v_actor, p_ids, now() + interval '30 minutes') RETURNING id INTO v_revision;
  INSERT INTO f02.revision_muestra(revision_lote_id, propuesta_id)
    SELECT v_revision, x FROM unnest(p_ids) x ORDER BY random() LIMIT v_tam;
  RETURN v_revision;
END;
$function$;

CREATE FUNCTION f02.mark_catalog_sample(p_revision uuid, p_propuesta uuid, p_resultado text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, f01, f02
AS $function$
BEGIN
  IF f02.catalog_actor() IS NULL OR NOT f02.can_review_catalog(NULL) OR p_resultado NOT IN ('CORRECTA','INCORRECTA') THEN
    RAISE EXCEPTION 'Permiso insuficiente' USING ERRCODE='42501';
  END IF;
  UPDATE f02.revision_muestra m SET resultado=p_resultado, marcada_at=now()
    WHERE m.revision_lote_id=p_revision AND m.propuesta_id=p_propuesta
      AND EXISTS (SELECT 1 FROM f02.revision_lote r WHERE r.id=p_revision AND r.usada_at IS NULL AND r.expires_at>now());
  IF NOT FOUND THEN RAISE EXCEPTION 'Muestra no visible' USING ERRCODE='22023'; END IF;
END;
$function$;

-- 9) Decisión (única vía de escritura del catálogo). Atómica: o se aplica todo o nada.
--    Una propuesta: APROBAR, RECHAZAR (motivo) o VINCULAR (p_medicamento). Varias: requieren una revisión
--    del propio revisor, vigente y sin usar, que las contenga, sin avisos y con TODA su muestra CORRECTA
--    (RECHAZAR en lote solo exige motivo). VINCULAR en lote usa el producto sugerido de cada propuesta.
--    Al aprobar, las demás propuestas abiertas de la misma identidad (de cualquier farmacia) se vinculan
--    solas (D-09 A): solo reciben el id del producto del catálogo, que es público.
CREATE FUNCTION f02.decide_catalog_proposals(p_ids uuid[], p_accion text, p_motivo text,
  p_medicamento uuid, p_revision uuid)
RETURNS TABLE (aprobadas integer, rechazadas integer, vinculadas integer, automaticas integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, f01, f02
AS $function$
#variable_conflict use_column
DECLARE
  v_actor uuid := f02.catalog_actor();
  v_total integer := cardinality(p_ids);
  v_prop f02.propuesta_producto%ROWTYPE;
  v_med uuid; v_nuevo boolean; v_target uuid; v_count integer;
  v_ap integer := 0; v_re integer := 0; v_vi integer := 0; v_au integer := 0;
  v_correlation uuid := gen_random_uuid();
BEGIN
  IF v_actor IS NULL OR NOT f02.can_review_catalog(NULL) THEN
    RAISE EXCEPTION 'Permiso insuficiente' USING ERRCODE='42501';
  END IF;
  IF p_accion NOT IN ('APROBAR','RECHAZAR','VINCULAR') OR v_total IS NULL OR v_total NOT BETWEEN 1 AND 1000
     OR v_total <> (SELECT count(DISTINCT x) FROM unnest(p_ids) x) THEN
    RAISE EXCEPTION 'Decisión inválida' USING ERRCODE='22023';
  END IF;
  IF p_accion='RECHAZAR' AND (p_motivo IS NULL OR char_length(btrim(p_motivo)) NOT BETWEEN 8 AND 500) THEN
    RAISE EXCEPTION 'Motivo requerido' USING ERRCODE='22023';
  END IF;
  IF v_total > 1 AND p_accion IN ('APROBAR','VINCULAR') THEN
    PERFORM 1 FROM f02.revision_lote r WHERE r.id=p_revision AND r.revisor_id=v_actor
      AND r.usada_at IS NULL AND r.expires_at>now() AND p_ids <@ r.propuestas FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Revisión de lote no válida' USING ERRCODE='22023'; END IF;
    IF EXISTS (SELECT 1 FROM f02.revision_muestra m WHERE m.revision_lote_id=p_revision AND m.resultado<>'CORRECTA') THEN
      RAISE EXCEPTION 'La muestra no está completa y correcta' USING ERRCODE='22023';
    END IF;
    UPDATE f02.revision_lote SET usada_at=now() WHERE id=p_revision;
  END IF;
  FOR v_prop IN SELECT * FROM f02.propuesta_producto p WHERE p.id = ANY (p_ids) ORDER BY p.id FOR UPDATE LOOP
    IF v_prop.estado <> 'PROPUESTA' THEN CONTINUE; END IF;   -- ya decidida: idempotente, no cambia
    IF NOT f02.can_review_catalog(v_prop.farmacia_id) THEN
      RAISE EXCEPTION 'Permiso insuficiente' USING ERRCODE='42501';
    END IF;
    IF v_total > 1 AND v_prop.aviso IS NOT NULL AND p_accion <> 'RECHAZAR' THEN
      RAISE EXCEPTION 'Las propuestas con aviso se deciden una a una' USING ERRCODE='22023';
    END IF;
    IF p_accion='RECHAZAR' THEN
      UPDATE f02.propuesta_producto SET estado='RECHAZADA', motivo=btrim(p_motivo), decidido_por=v_actor,
        decidido_at=now(), version=version+1 WHERE id=v_prop.id;
      INSERT INTO f02.catalogo_auditoria(propuesta_id, farmacia_id, actor_id, accion, motivo, revision_lote_id, correlation_id)
        VALUES (v_prop.id, v_prop.farmacia_id, v_actor, 'RECHAZAR', btrim(p_motivo), p_revision, v_correlation);
      v_re := v_re + 1;
      CONTINUE;
    END IF;
    IF p_accion='VINCULAR' THEN
      v_target := CASE WHEN v_total=1 THEN p_medicamento ELSE v_prop.medicamento_sugerido_id END;
      SELECT m.id INTO v_med FROM f02.medicamento m WHERE m.id=v_target AND m.estado='ACTIVO';
      IF v_med IS NULL THEN RAISE EXCEPTION 'Producto a vincular no válido' USING ERRCODE='22023'; END IF;
      UPDATE f02.propuesta_producto SET estado='YA_EXISTE', medicamento_id=v_med, decidido_por=v_actor,
        decidido_at=now(), version=version+1 WHERE id=v_prop.id;
      INSERT INTO f02.catalogo_auditoria(propuesta_id, farmacia_id, actor_id, accion, medicamento_id, revision_lote_id, correlation_id)
        VALUES (v_prop.id, v_prop.farmacia_id, v_actor, 'VINCULAR', v_med, p_revision, v_correlation);
      v_vi := v_vi + 1;
      CONTINUE;
    END IF;
    -- APROBAR: alta idempotente en el catálogo (concurrencia segura por la identidad única).
    INSERT INTO f02.medicamento(nombre, principio_activo, concentracion, presentacion, forma_farmaceutica,
        clasificacion, laboratorio, marca, estado)
      VALUES (v_prop.nombre, v_prop.principio_activo, v_prop.concentracion, v_prop.presentacion,
        v_prop.forma_farmaceutica, v_prop.clasificacion, v_prop.laboratorio, v_prop.marca, 'ACTIVO')
      ON CONFLICT ON CONSTRAINT medicamento_identidad_unica DO NOTHING
      RETURNING id INTO v_med;
    v_nuevo := v_med IS NOT NULL;
    IF NOT v_nuevo THEN
      SELECT m.id INTO v_med FROM f02.medicamento m WHERE m.nombre=v_prop.nombre AND m.concentracion=v_prop.concentracion
        AND m.presentacion=v_prop.presentacion AND m.forma_farmaceutica=v_prop.forma_farmaceutica
        AND m.clasificacion=v_prop.clasificacion AND m.laboratorio=v_prop.laboratorio AND m.marca=v_prop.marca;
    END IF;
    UPDATE f02.propuesta_producto SET estado=CASE WHEN v_nuevo THEN 'APROBADA' ELSE 'YA_EXISTE' END,
      medicamento_id=v_med, decidido_por=v_actor, decidido_at=now(), version=version+1 WHERE id=v_prop.id;
    INSERT INTO f02.catalogo_auditoria(propuesta_id, farmacia_id, actor_id, accion, medicamento_id, revision_lote_id, correlation_id)
      VALUES (v_prop.id, v_prop.farmacia_id, v_actor, CASE WHEN v_nuevo THEN 'APROBAR' ELSE 'VINCULAR' END, v_med, p_revision, v_correlation);
    IF v_nuevo THEN v_ap := v_ap + 1; ELSE v_vi := v_vi + 1; END IF;
    -- D-09 A: el resto de propuestas abiertas idénticas (otras farmacias) se vinculan solas.
    WITH vinculo AS (
      UPDATE f02.propuesta_producto o SET estado='YA_EXISTE', automatica=true, medicamento_id=v_med,
        decidido_at=now(), version=o.version+1
      WHERE o.estado='PROPUESTA' AND o.id <> v_prop.id AND NOT (o.id = ANY (p_ids))
        AND o.nombre=v_prop.nombre AND o.concentracion=v_prop.concentracion AND o.presentacion=v_prop.presentacion
        AND o.forma_farmaceutica=v_prop.forma_farmaceutica AND o.clasificacion=v_prop.clasificacion
        AND o.laboratorio=v_prop.laboratorio AND o.marca=v_prop.marca
      RETURNING o.id, o.farmacia_id)
    INSERT INTO f02.catalogo_auditoria(propuesta_id, farmacia_id, actor_id, accion, medicamento_id, correlation_id)
      SELECT id, farmacia_id, NULL, 'VINCULO_AUTOMATICO', v_med, v_correlation FROM vinculo;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_au := v_au + v_count;
  END LOOP;
  RETURN QUERY SELECT v_ap, v_re, v_vi, v_au;
END;
$function$;

ALTER FUNCTION f02.catalog_actor() OWNER TO f022_catalog;
ALTER FUNCTION f02.can_review_catalog(uuid) OWNER TO f022_catalog;
ALTER FUNCTION f02.submit_catalog_proposals(uuid,uuid,jsonb) OWNER TO f022_catalog;
ALTER FUNCTION f02.start_catalog_review(uuid[]) OWNER TO f022_catalog;
ALTER FUNCTION f02.mark_catalog_sample(uuid,uuid,text) OWNER TO f022_catalog;
ALTER FUNCTION f02.decide_catalog_proposals(uuid[],text,text,uuid,uuid) OWNER TO f022_catalog;
REVOKE ALL ON FUNCTION f02.catalog_actor(), f02.can_review_catalog(uuid), f02.submit_catalog_proposals(uuid,uuid,jsonb),
  f02.start_catalog_review(uuid[]), f02.mark_catalog_sample(uuid,uuid,text),
  f02.decide_catalog_proposals(uuid[],text,text,uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION f02.catalog_actor(), f02.can_review_catalog(uuid), f02.submit_catalog_proposals(uuid,uuid,jsonb),
  f02.start_catalog_review(uuid[]), f02.mark_catalog_sample(uuid,uuid,text),
  f02.decide_catalog_proposals(uuid[],text,text,uuid,uuid) TO f01_runtime;

-- 10) Lectura para la aplicación (sin escritura directa). Las propuestas no tienen datos privados.
GRANT SELECT ON f02.propuesta_lote, f02.propuesta_producto TO f01_runtime;
GRANT SELECT ON f02.revision_lote, f02.revision_muestra TO f01_runtime;
GRANT SELECT (id, propuesta_id, farmacia_id, accion, medicamento_id, motivo, occurred_at) ON f02.catalogo_auditoria TO f01_runtime;
-- La farmacia ve solo sus lotes y propuestas.
CREATE POLICY f022_lote_farmacia ON f02.propuesta_lote FOR SELECT TO f01_runtime
  USING (f02.can_inventory_action(farmacia_id,'inventory.import.preview')
    OR f02.can_inventory_action(farmacia_id,'inventory.import.confirm'));
CREATE POLICY f022_propuesta_farmacia ON f02.propuesta_producto FOR SELECT TO f01_runtime
  USING (f02.can_inventory_action(farmacia_id,'inventory.import.preview')
    OR f02.can_inventory_action(farmacia_id,'inventory.import.confirm'));
-- El revisor ve propuestas de farmacias que puede revisar (nunca de la suya) y sus propias revisiones.
CREATE POLICY f022_propuesta_revisor ON f02.propuesta_producto FOR SELECT TO f01_runtime
  USING (f02.can_review_catalog(farmacia_id));
CREATE POLICY f022_revision_revisor ON f02.revision_lote FOR SELECT TO f01_runtime
  USING (revisor_id=f02.catalog_actor() AND f02.can_review_catalog(NULL));
CREATE POLICY f022_muestra_revisor ON f02.revision_muestra FOR SELECT TO f01_runtime
  USING (EXISTS (SELECT 1 FROM f02.revision_lote r WHERE r.id=revision_lote_id AND r.revisor_id=f02.catalog_actor())
    AND f02.can_review_catalog(NULL));
CREATE POLICY f022_auditoria_revisor ON f02.catalogo_auditoria FOR SELECT TO f01_runtime
  USING (f02.can_review_catalog(farmacia_id));
