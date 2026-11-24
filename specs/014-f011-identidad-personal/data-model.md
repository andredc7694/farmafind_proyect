# Modelo de datos — F01.1

Migraciones aditivas `backend/migrations/f01/011_staff_identity.sql` (tablas y políticas), `012_staff_functions.sql` (alta atómica de personal), `013_staff_invitations.sql` (invitaciones y permisos), `014_account_recovery.sql` (restablecimiento, verificación y reemisión), `015_mfa.sql` (segundo factor; exige factor verificado en `has_platform_permission`) y `016_profile.sql` (perfil, sesiones y cambio de clave/correo propios; ámbito `REAUTH_ACCOUNT`). Prefijos siguientes a `010_platform_authorization.sql`. Solo se aplica en bases TEST efímeras o fixtures marcados. Todas las tablas nuevas: `ENABLE` y `FORCE ROW LEVEL SECURITY`; el rol `f01_runtime` no obtiene permisos globales; `f01_auth` recibe únicamente las columnas necesarias.

## Tablas alteradas

### `f01.usuario`
| Cambio | Detalle |
|---|---|
| `email_canonico` | pasa a **NULL permitido** (conserva UNIQUE y su CHECK de formato cuando existe). |
| `alias_canonico text` | nuevo, UNIQUE, CHECK `^[a-z0-9][a-z0-9._-]{2,39}$` y minúsculas. |
| `email_verificado_at timestamptz` | nuevo, NULL hasta verificar. |
| CHECK `usuario_identificador` | `email_canonico IS NOT NULL OR alias_canonico IS NOT NULL`. |
| `rol_plataforma`/otros | sin cambios. |

### `f01.sesion`
| Cambio | Detalle |
|---|---|
| `restringida_motivo text` | NULL \| `CAMBIO_CLAVE` \| `MFA_PENDIENTE`. |
| `mfa_verificada_at timestamptz` | NULL hasta verificar el segundo factor. |

### `f01.abuse_attempt`
CHECK de `scope` ampliado con `TEMP_KEY_ACCOUNT`, `RESET_ACCOUNT`, `RESET_IP`, `TOTP_ACCOUNT`, `STAFF_CREATE_IP`, `REAUTH_ACCOUNT` (016). Reservados sin uso hoy: `TEMP_KEY_ACCOUNT` y `STAFF_CREATE_IP` (el bloqueo de clave temporal reutiliza el límite de inicio de sesión).

## Tablas nuevas

### `f01.credencial_temporal` (una por usuario)
| Columna | Tipo / regla |
|---|---|
| `usuario_id` | PK, FK → `usuario`. |
| `clave_hash` | text, Argon2id (nunca la clave). |
| `farmacia_id` | FK → `farmacia_referencia` (quién la emitió para qué farmacia). |
| `emitida_por_usuario_id` | FK → `usuario`. |
| `motivo` | `ALTA` \| `RECUPERACION`. |
| `emitida_at`, `expira_at` | `expira_at = emitida_at + 24 h`. |
| `consumida_at` | NULL hasta el primer ingreso; luego la credencial no vuelve a servir. |

Estados: emitida → consumida · emitida → vencida · emitida → reemplazada (reemisión sobrescribe la fila). Acceso: `f01_auth` lee y consume; el propietario solo emite mediante procedimiento de aplicación, nunca lee el hash.

### `f01.invitacion_personal`
| Columna | Tipo / regla |
|---|---|
| `id` | uuid PK. |
| `farmacia_id` | FK, RLS por farmacia. |
| `usuario_destino_id` | FK → `usuario`. |
| `invitado_por_usuario_id` | FK → `usuario`. |
| `rol` | `TRABAJADOR` (único rol concedible, ROL-01). |
| `estado` | `PENDIENTE` \| `ACEPTADA` \| `RECHAZADA` \| `VENCIDA` \| `REVOCADA`. |
| `creada_at`, `expira_at`, `resuelta_at` | `expira_at = creada_at + 7 días`. |

Único parcial: una invitación `PENDIENTE` por (`farmacia_id`, `usuario_destino_id`). Aceptar crea la membresía y registra auditoría en una sola transacción. Políticas RLS: propietario/administrador autorizado de la farmacia (contexto tenant) y destinatario (contexto de autenticación) ven solo lo suyo.

### `f01.token_cuenta`
| Columna | Tipo / regla |
|---|---|
| `id` | uuid PK. |
| `usuario_id` | FK. |
| `proposito` | `VERIFICAR_CORREO` \| `RESTABLECER_CLAVE` \| `CAMBIO_CORREO`. |
| `token_hash` | bytea(32), SHA-256 del token; el token nunca se guarda. |
| `correo_destino` | text, solo para `CAMBIO_CORREO`/`VERIFICAR_CORREO` (canónico). |
| `expira_at`, `usado_at` | 30 min (restablecer) / 24 h (verificar). |

Un solo uso; al restablecer se invalidan los demás tokens de la cuenta.

### `f01.mfa_totp` (solo administradores generales)
| Columna | Tipo / regla |
|---|---|
| `usuario_id` | PK, FK. |
| `secreto_cifrado`, `nonce` | bytea; AES-256-GCM con clave de configuración externa. |
| `estado` | `PENDIENTE` \| `ACTIVO` \| `REINICIADO`. |
| `ultimo_paso_usado` | bigint; evita reutilizar un código. |
| `activado_at` | timestamptz. |

### `f01.perfil_usuario`
`usuario_id` PK; `nombre` (≤120), `telefono` (formato validado, opcional), `avatar_preset` (entero 1–12, opcional), `tema` (`CLARO|OSCURO|SISTEMA`, defecto `SISTEMA`), `notif_reservas`, `notif_seguridad` (boolean). Sin permisos ni roles.

### `f01.auditoria_identidad`
| Columna | Tipo / regla |
|---|---|
| `id` | uuid PK. |
| `actor_usuario_id`, `objetivo_usuario_id` | FK, opcionales. |
| `farmacia_id` | FK, opcional (RLS: propietario ve solo su farmacia). |
| `accion` | catálogo cerrado: `STAFF_CREATE`, `TEMP_KEY_ISSUE`, `TEMP_KEY_CONSUME`, `INVITE_CREATE`, `INVITE_ACCEPT`, `INVITE_DECLINE`, `INVITE_REVOKE`, `CAPABILITY_GRANT`, `CAPABILITY_REVOKE`, `MEMBERSHIP_REVOKE`, `PASSWORD_CHANGE`, `PASSWORD_RESET`, `EMAIL_VERIFY`, `EMAIL_CHANGE`, `MFA_ENROLL`, `MFA_VERIFY`, `MFA_RESET`, `SESSION_REVOKE`, `ELEVATION_DENIED`. |
| `resultado` | `PERMITIDO` \| `DENEGADO`. |
| `ocurrido_at`, `correlation_id` | tiempo y correlación. |

Sin claves, tokens, códigos ni secretos (SC-008). Solo inserción desde la aplicación; sin UPDATE/DELETE para los roles de aplicación.

## Relaciones y reglas transversales

- Cuenta de personal → `usuario` (alias) + `usuario_farmacia` (rol `TRABAJADOR`) + `delegacion` (capacidades) + `credencial_temporal` + `perfil_usuario`.
- Capacidades concedibles (existentes): `reservation.read|accept|deliver|settings`, `inventory.read|write|import.preview|import.confirm|history`. `membership.manage` (gestión de personal) no es delegable.
- Contexto: el `farmacia_id` activo lo fija el servidor desde la membresía validada; nunca desde el cliente.
- Sin datos reales: alias, correos y teléfonos ficticios (`example.test`).

## Volumen y retención (supuestos)

Decenas de cuentas por farmacia; tokens y credenciales expiradas se purgan por consulta de mantenimiento (tarea); la auditoría se conserva sin purga en este incremento.
