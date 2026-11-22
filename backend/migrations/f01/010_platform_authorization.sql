-- GLO-01/BOOT-01: global authorization is separate from pharmacy tenancy.
-- Direct table access is never granted to the application runtime. All mutations
-- are mediated by narrow, audited functions and one-use offline approvals.

CREATE TABLE f01.platform_role_permission (
  role_code text NOT NULL CHECK (role_code = 'ADMINISTRADOR_PLATAFORMA'),
  permission_code text NOT NULL CHECK (permission_code IN (
    'PLATFORM_USER_READ',
    'PLATFORM_USER_STATUS_MANAGE',
    'PLATFORM_GLOBAL_AUTH_READ',
    'PLATFORM_GLOBAL_AUTH_MANAGE',
    'PLATFORM_AUDIT_READ'
  )),
  PRIMARY KEY (role_code, permission_code)
);

INSERT INTO f01.platform_role_permission(role_code, permission_code) VALUES
  ('ADMINISTRADOR_PLATAFORMA', 'PLATFORM_USER_READ'),
  ('ADMINISTRADOR_PLATAFORMA', 'PLATFORM_USER_STATUS_MANAGE'),
  ('ADMINISTRADOR_PLATAFORMA', 'PLATFORM_GLOBAL_AUTH_READ'),
  ('ADMINISTRADOR_PLATAFORMA', 'PLATFORM_GLOBAL_AUTH_MANAGE'),
  ('ADMINISTRADOR_PLATAFORMA', 'PLATFORM_AUDIT_READ');

CREATE TABLE f01.privileged_approval (
  id uuid PRIMARY KEY,
  operation text NOT NULL CHECK (operation IN (
    'GRANT_PLATFORM_ROLE', 'REVOKE_PLATFORM_ROLE',
    'INITIAL_PLATFORM_ADMIN', 'INITIAL_PHARMACY_OWNER'
  )),
  target_usuario_id uuid NOT NULL REFERENCES f01.usuario(id) ON DELETE RESTRICT,
  scope_farmacia_id uuid REFERENCES f01.farmacia_referencia(id) ON DELETE RESTRICT,
  role_code text NOT NULL CHECK (role_code IN ('ADMINISTRADOR_PLATAFORMA', 'DUENO')),
  reason text NOT NULL CHECK (char_length(btrim(reason)) BETWEEN 8 AND 500),
  expires_at timestamptz NOT NULL,
  integrity_hash text NOT NULL CHECK (integrity_hash ~ '^[a-f0-9]{64}$'),
  consumed_at timestamptz,
  consumed_by_usuario_id uuid REFERENCES f01.usuario(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT privileged_approval_scope CHECK (
    (operation = 'INITIAL_PHARMACY_OWNER' AND scope_farmacia_id IS NOT NULL AND role_code = 'DUENO') OR
    (operation <> 'INITIAL_PHARMACY_OWNER' AND scope_farmacia_id IS NULL AND role_code = 'ADMINISTRADOR_PLATAFORMA')
  )
);

CREATE TABLE f01.platform_role_assignment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES f01.usuario(id) ON DELETE RESTRICT,
  role_code text NOT NULL CHECK (role_code = 'ADMINISTRADOR_PLATAFORMA'),
  estado text NOT NULL DEFAULT 'ACTIVA' CHECK (estado IN ('ACTIVA', 'REVOCADA')),
  approval_id uuid NOT NULL REFERENCES f01.privileged_approval(id) ON DELETE RESTRICT,
  granted_by_usuario_id uuid REFERENCES f01.usuario(id) ON DELETE RESTRICT,
  granted_at timestamptz NOT NULL DEFAULT now(),
  revoked_by_usuario_id uuid REFERENCES f01.usuario(id) ON DELETE RESTRICT,
  revoked_at timestamptz
);
CREATE UNIQUE INDEX platform_role_assignment_active_unique
  ON f01.platform_role_assignment(usuario_id, role_code) WHERE estado = 'ACTIVA';

CREATE TABLE f01.global_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_usuario_id uuid REFERENCES f01.usuario(id) ON DELETE RESTRICT,
  target_usuario_id uuid NOT NULL REFERENCES f01.usuario(id) ON DELETE RESTRICT,
  action text NOT NULL CHECK (action IN (
    'PLATFORM_ROLE_GRANT', 'PLATFORM_ROLE_REVOKE',
    'BOOTSTRAP_PLATFORM_ADMIN', 'BOOTSTRAP_PHARMACY_OWNER'
  )),
  result text NOT NULL CHECK (result IN ('PERMITIDO', 'DENEGADO')),
  approval_id uuid NOT NULL REFERENCES f01.privileged_approval(id) ON DELETE RESTRICT,
  correlation_id uuid NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX global_audit_actor_date_idx ON f01.global_audit(actor_usuario_id, occurred_at DESC);

CREATE TABLE f01.bootstrap_execution (
  idempotency_key text PRIMARY KEY CHECK (char_length(idempotency_key) BETWEEN 16 AND 200),
  operation text NOT NULL CHECK (operation IN ('INITIAL_PLATFORM_ADMIN', 'INITIAL_PHARMACY_OWNER')),
  target_usuario_id uuid NOT NULL REFERENCES f01.usuario(id) ON DELETE RESTRICT,
  scope_farmacia_id uuid REFERENCES f01.farmacia_referencia(id) ON DELETE RESTRICT,
  approval_id uuid NOT NULL UNIQUE REFERENCES f01.privileged_approval(id) ON DELETE RESTRICT,
  executed_at timestamptz NOT NULL DEFAULT now()
);

DO $role$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='f01_bootstrap_executor') THEN
    CREATE ROLE f01_bootstrap_executor NOLOGIN NOSUPERUSER NOBYPASSRLS;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='f01_bootstrap_executor'
             AND (rolsuper OR rolbypassrls OR rolcanlogin)) THEN
    RAISE EXCEPTION 'f01_bootstrap_executor debe ser NOLOGIN NOSUPERUSER NOBYPASSRLS';
  END IF;
END;
$role$;

REVOKE ALL ON f01.platform_role_permission, f01.privileged_approval,
  f01.platform_role_assignment, f01.global_audit, f01.bootstrap_execution FROM PUBLIC;

CREATE FUNCTION f01.has_platform_permission(required_permission text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, f01
AS $policy$
  SELECT required_permission IN (
      'PLATFORM_USER_READ', 'PLATFORM_USER_STATUS_MANAGE',
      'PLATFORM_GLOBAL_AUTH_READ', 'PLATFORM_GLOBAL_AUTH_MANAGE', 'PLATFORM_AUDIT_READ'
    )
    AND EXISTS (
      SELECT 1
      FROM f01.sesion s
      JOIN f01.usuario u ON u.id=s.usuario_id
      JOIN f01.platform_role_assignment a ON a.usuario_id=u.id AND a.estado='ACTIVA'
      JOIN f01.platform_role_permission p ON p.role_code=a.role_code
      WHERE s.token_fingerprint=decode(NULLIF(current_setting('app.session_fingerprint',true),''),'hex')
        AND s.usuario_id=NULLIF(current_setting('app.actor_user_id',true),'')::uuid
        AND s.estado='VIGENTE' AND s.idle_expires_at>now() AND s.absolute_expires_at>now()
        AND u.estado='ACTIVO' AND p.permission_code=required_permission
    );
$policy$;

CREATE FUNCTION f01.list_platform_role_assignments()
RETURNS TABLE(id uuid, usuario_id uuid, role_code text, estado text, granted_at timestamptz, revoked_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = pg_catalog, f01
AS $function$
BEGIN
  IF NOT f01.has_platform_permission('PLATFORM_GLOBAL_AUTH_READ') THEN
    RAISE EXCEPTION 'permiso insuficiente' USING ERRCODE='42501';
  END IF;
  RETURN QUERY SELECT a.id,a.usuario_id,a.role_code,a.estado,a.granted_at,a.revoked_at
    FROM f01.platform_role_assignment a ORDER BY a.granted_at,a.id;
END;
$function$;

CREATE FUNCTION f01.grant_platform_role(target_id uuid, requested_role text, approval uuid, correlation uuid)
RETURNS TABLE(id uuid, usuario_id uuid, role_code text, estado text, granted_at timestamptz, revoked_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, f01
AS $function$
DECLARE actor uuid := NULLIF(current_setting('app.actor_user_id',true),'')::uuid;
DECLARE approved f01.privileged_approval%ROWTYPE;
BEGIN
  IF requested_role <> 'ADMINISTRADOR_PLATAFORMA' OR actor IS NULL OR actor=target_id OR
     NOT f01.has_platform_permission('PLATFORM_GLOBAL_AUTH_MANAGE') THEN
    RAISE EXCEPTION 'permiso insuficiente' USING ERRCODE='42501';
  END IF;
  SELECT * INTO approved FROM f01.privileged_approval WHERE privileged_approval.id=approval FOR UPDATE;
  IF NOT FOUND OR approved.operation<>'GRANT_PLATFORM_ROLE' OR approved.target_usuario_id<>target_id OR
     approved.role_code<>requested_role OR approved.scope_farmacia_id IS NOT NULL OR
     approved.consumed_at IS NOT NULL OR approved.expires_at<=now() THEN
    RAISE EXCEPTION 'aprobacion invalida' USING ERRCODE='42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM f01.usuario WHERE usuario.id=target_id AND usuario.estado='ACTIVO') THEN
    RAISE EXCEPTION 'objetivo no visible' USING ERRCODE='42501';
  END IF;
  INSERT INTO f01.platform_role_assignment(usuario_id,role_code,approval_id,granted_by_usuario_id)
    VALUES(target_id,requested_role,approval,actor)
    RETURNING platform_role_assignment.id,platform_role_assignment.usuario_id,
      platform_role_assignment.role_code,platform_role_assignment.estado,
      platform_role_assignment.granted_at,platform_role_assignment.revoked_at
      INTO id,usuario_id,role_code,estado,granted_at,revoked_at;
  UPDATE f01.privileged_approval SET consumed_at=now(),consumed_by_usuario_id=actor WHERE privileged_approval.id=approval;
  INSERT INTO f01.global_audit(actor_usuario_id,target_usuario_id,action,result,approval_id,correlation_id)
    VALUES(actor,target_id,'PLATFORM_ROLE_GRANT','PERMITIDO',approval,correlation);
  RETURN NEXT;
END;
$function$;

CREATE FUNCTION f01.revoke_platform_role(assignment uuid, approval uuid, correlation uuid)
RETURNS TABLE(id uuid, usuario_id uuid, role_code text, estado text, granted_at timestamptz, revoked_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, f01
AS $function$
DECLARE actor uuid := NULLIF(current_setting('app.actor_user_id',true),'')::uuid;
DECLARE target uuid;
DECLARE approved f01.privileged_approval%ROWTYPE;
BEGIN
  SELECT a.usuario_id INTO target FROM f01.platform_role_assignment a
    WHERE a.id=assignment AND a.estado='ACTIVA' FOR UPDATE;
  IF target IS NULL OR actor IS NULL OR actor=target OR
     NOT f01.has_platform_permission('PLATFORM_GLOBAL_AUTH_MANAGE') THEN
    RAISE EXCEPTION 'permiso insuficiente' USING ERRCODE='42501';
  END IF;
  IF (SELECT count(*) FROM f01.platform_role_assignment WHERE platform_role_assignment.estado='ACTIVA')<=1 THEN
    RAISE EXCEPTION 'ultimo administrador' USING ERRCODE='23514';
  END IF;
  SELECT * INTO approved FROM f01.privileged_approval WHERE privileged_approval.id=approval FOR UPDATE;
  IF NOT FOUND OR approved.operation<>'REVOKE_PLATFORM_ROLE' OR approved.target_usuario_id<>target OR
     approved.role_code<>'ADMINISTRADOR_PLATAFORMA' OR approved.scope_farmacia_id IS NOT NULL OR
     approved.consumed_at IS NOT NULL OR approved.expires_at<=now() THEN
    RAISE EXCEPTION 'aprobacion invalida' USING ERRCODE='42501';
  END IF;
  UPDATE f01.platform_role_assignment a SET estado='REVOCADA',revoked_by_usuario_id=actor,revoked_at=now()
    WHERE a.id=assignment
    RETURNING a.id,a.usuario_id,a.role_code,a.estado,a.granted_at,a.revoked_at
      INTO id,usuario_id,role_code,estado,granted_at,revoked_at;
  UPDATE f01.sesion SET estado='REVOCADA',revoked_at=now() WHERE sesion.usuario_id=target AND sesion.estado='VIGENTE';
  UPDATE f01.privileged_approval SET consumed_at=now(),consumed_by_usuario_id=actor WHERE privileged_approval.id=approval;
  INSERT INTO f01.global_audit(actor_usuario_id,target_usuario_id,action,result,approval_id,correlation_id)
    VALUES(actor,target,'PLATFORM_ROLE_REVOKE','PERMITIDO',approval,correlation);
  RETURN NEXT;
END;
$function$;

CREATE FUNCTION f01.record_privileged_approval(approval_id uuid, requested_operation text,
  target_id uuid, pharmacy_id uuid, requested_role text, approval_reason text,
  approval_expires_at timestamptz, document_hash text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, f01
AS $function$
BEGIN
  INSERT INTO f01.privileged_approval(id,operation,target_usuario_id,scope_farmacia_id,role_code,reason,expires_at,integrity_hash)
    VALUES(approval_id,requested_operation,target_id,pharmacy_id,requested_role,approval_reason,approval_expires_at,document_hash)
    ON CONFLICT (id) DO NOTHING;
  IF NOT EXISTS (
    SELECT 1 FROM f01.privileged_approval a
    WHERE a.id=approval_id AND a.operation=requested_operation AND a.target_usuario_id=target_id
      AND a.scope_farmacia_id IS NOT DISTINCT FROM pharmacy_id AND a.role_code=requested_role
      AND a.reason=approval_reason AND a.expires_at=approval_expires_at AND a.integrity_hash=document_hash
  ) THEN
    RAISE EXCEPTION 'expediente duplicado incompatible' USING ERRCODE='23505';
  END IF;
END;
$function$;

CREATE FUNCTION f01.execute_initial_bootstrap(approval uuid, idempotency text, correlation uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, f01
AS $function$
DECLARE approved f01.privileged_approval%ROWTYPE;
BEGIN
  IF EXISTS (SELECT 1 FROM f01.bootstrap_execution WHERE idempotency_key=idempotency) THEN RETURN; END IF;
  SELECT * INTO approved FROM f01.privileged_approval WHERE privileged_approval.id=approval FOR UPDATE;
  IF NOT FOUND OR approved.operation NOT IN ('INITIAL_PLATFORM_ADMIN','INITIAL_PHARMACY_OWNER') OR
     approved.consumed_at IS NOT NULL OR approved.expires_at<=now() THEN
    RAISE EXCEPTION 'aprobacion invalida' USING ERRCODE='42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM f01.usuario WHERE usuario.id=approved.target_usuario_id AND usuario.estado='ACTIVO') THEN
    RAISE EXCEPTION 'objetivo no visible' USING ERRCODE='42501';
  END IF;
  IF approved.operation='INITIAL_PLATFORM_ADMIN' THEN
    IF EXISTS (SELECT 1 FROM f01.platform_role_assignment WHERE platform_role_assignment.estado='ACTIVA') THEN
      RAISE EXCEPTION 'bootstrap global ya ejecutado' USING ERRCODE='23505';
    END IF;
    INSERT INTO f01.platform_role_assignment(usuario_id,role_code,approval_id)
      VALUES(approved.target_usuario_id,'ADMINISTRADOR_PLATAFORMA',approval);
    INSERT INTO f01.global_audit(actor_usuario_id,target_usuario_id,action,result,approval_id,correlation_id)
      VALUES(NULL,approved.target_usuario_id,'BOOTSTRAP_PLATFORM_ADMIN','PERMITIDO',approval,correlation);
  ELSE
    IF approved.scope_farmacia_id IS NULL OR EXISTS (
      SELECT 1 FROM f01.usuario_farmacia WHERE farmacia_id=approved.scope_farmacia_id AND rol='DUENO' AND estado='ACTIVA'
    ) THEN RAISE EXCEPTION 'bootstrap farmacia no disponible' USING ERRCODE='23505'; END IF;
    INSERT INTO f01.usuario_farmacia(usuario_id,farmacia_id,rol,estado,changed_by_usuario_id)
      VALUES(approved.target_usuario_id,approved.scope_farmacia_id,'DUENO','ACTIVA',approved.target_usuario_id);
    INSERT INTO f01.global_audit(actor_usuario_id,target_usuario_id,action,result,approval_id,correlation_id)
      VALUES(NULL,approved.target_usuario_id,'BOOTSTRAP_PHARMACY_OWNER','PERMITIDO',approval,correlation);
  END IF;
  UPDATE f01.privileged_approval SET consumed_at=now() WHERE privileged_approval.id=approval;
  INSERT INTO f01.bootstrap_execution(idempotency_key,operation,target_usuario_id,scope_farmacia_id,approval_id)
    VALUES(idempotency,approved.operation,approved.target_usuario_id,approved.scope_farmacia_id,approval);
END;
$function$;

REVOKE ALL ON FUNCTION f01.has_platform_permission(text), f01.list_platform_role_assignments(),
  f01.grant_platform_role(uuid,text,uuid,uuid), f01.revoke_platform_role(uuid,uuid,uuid),
  f01.record_privileged_approval(uuid,text,uuid,uuid,text,text,timestamptz,text),
  f01.execute_initial_bootstrap(uuid,text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION f01.has_platform_permission(text), f01.list_platform_role_assignments(),
  f01.grant_platform_role(uuid,text,uuid,uuid), f01.revoke_platform_role(uuid,uuid,uuid)
  TO f01_runtime;
GRANT USAGE ON SCHEMA f01 TO f01_bootstrap_executor;
GRANT EXECUTE ON FUNCTION f01.record_privileged_approval(uuid,text,uuid,uuid,text,text,timestamptz,text),
  f01.execute_initial_bootstrap(uuid,text,uuid) TO f01_bootstrap_executor;
