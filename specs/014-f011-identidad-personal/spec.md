# Feature Specification: F01.1 — Identidad y personal de farmacia

**Feature Branch**: `feat/f011-identidad-personal`
**Created**: 2026-11-23
**Status**: Especificación aprobada el 2026-11-23 (ver [approval.md](approval.md)); *clarify* resuelto el 2026-11-23 (5 respuestas del responsable). Spec Kit: en curso *plan*, pendiente de aprobación.
**Input**: Documento Maestro v3.2 MEJ-015, MEJ-016, MEJ-017 y MEJ-019 (HU23–25, HU27; RF37–RF41, RF44–RF45; AC10–AC11); roadmap v3.2, orden 3.

## Clarifications

### Session 2026-11-23

- Q: ¿Cómo inicia sesión el personal? → A: **C** — con un alias interno único; el correo es opcional y se agrega después desde el perfil, con reverificación (F011-FR-001, FR-013).
- Q: ¿Cómo recupera su acceso un trabajador sin correo? → A: **A** — el propietario le emite una nueva clave temporal; quien tiene correo verificado restablece por el simulador local (F011-FR-011).
- Q: ¿Quién usa segundo factor (TOTP)? → A: **A** — obligatorio solo para administradores generales; propietarios quedan fuera de este incremento (F011-FR-012).
- Q: ¿Caducidad y límite de intentos de la clave temporal? → A: **A** — 24 horas; bloqueo temporal de 15 minutos tras 5 intentos fallidos (F011-FR-002).
- Q: ¿Cómo recupera su acceso un administrador que pierde el dispositivo del segundo factor? → A: **B** — reinicio técnico auditado por el operador, sin pantalla en la aplicación y sin códigos de respaldo (F011-FR-012).

Fuente: respuesta del responsable «si esta bien como detallaste» (aceptó las cinco recomendaciones).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - El propietario crea la cuenta de un trabajador (Priority: P1)

Como propietario de una farmacia quiero crear desde «Mi farmacia > Personal» una cuenta operativa para un trabajador que no tiene correo propio, para que pueda atender reservas e inventario solo en mi farmacia.

**Why this priority**: Es la necesidad principal de MEJ-016; sin ella el personal comparte credenciales (riesgo alto en el maestro §17).
**Independent Test**: Con la farmacia ficticia Alfa, el propietario crea un trabajador; este entra con una clave temporal, está obligado a cambiarla y solo ve datos de Alfa.

**Acceptance Scenarios**:

1. **Given** un propietario con la capacidad de gestionar personal, **When** crea un trabajador con un identificador interno único y un rol inicial, **Then** recibe una clave temporal que se muestra una sola vez y no puede volver a consultarla.
2. **Given** una clave temporal vigente, **When** el trabajador entra por primera vez, **Then** debe definir una clave nueva antes de usar cualquier función, y la temporal queda inutilizable.
3. **Given** una clave temporal vencida o ya usada, **When** se intenta usar, **Then** se rechaza con un mensaje claro y el propietario puede emitir una nueva.
4. **Given** un trabajador de Alfa, **When** intenta ver o actuar sobre datos de Beta (incluso manipulando identificadores), **Then** se deniega sin revelar información de Beta.

---

### User Story 2 - Vincular una cuenta existente y gestionar permisos (Priority: P1)

Como propietario quiero invitar a una persona que ya tiene cuenta FarmaFind y delegarle permisos concretos, y poder revocarlos en cualquier momento con efecto inmediato.

**Why this priority**: Evita cuentas duplicadas y cumple RF39 (permisos granulares, revocación efectiva, sin auto-escalada).
**Independent Test**: Una cuenta existente acepta una invitación de Alfa; el propietario le concede y luego revoca un permiso; las sesiones afectadas dejan de funcionar para esa farmacia.

**Acceptance Scenarios**:

1. **Given** una cuenta existente, **When** el propietario la invita, **Then** la vinculación solo ocurre cuando la persona acepta; nunca se fusionan identidades por coincidencia automática.
2. **Given** un trabajador vinculado, **When** el propietario concede o revoca permisos (reservas, inventario, importaciones; la gestión de personal queda reservada al propietario), **Then** el cambio rige de inmediato y queda auditado con autor, fecha y motivo.
3. **Given** la revocación de una membresía, **When** el trabajador estaba conectado, **Then** pierde el acceso a esa farmacia de inmediato y sus sesiones relacionadas se cierran.
4. **Given** un trabajador, **When** intenta concederse permisos o gestionar al personal, **Then** se deniega y se audita el intento.

---

### User Story 3 - Acceso reforzado y recuperación segura (Priority: P1)

Como usuario con cuenta quiero verificar mi correo (cuando lo tenga) y poder recuperar mi acceso sin comprometer la seguridad de la farmacia.

**Why this priority**: RF40; una recuperación débil anula el aislamiento entre farmacias.
**Independent Test**: En TEST, con un simulador local de correo, un usuario verifica su correo y restablece su clave; un trabajador sin correo recupera el acceso por la vía definida en la aclaración.

**Acceptance Scenarios**:

1. **Given** un usuario con correo, **When** solicita verificar o restablecer su clave, **Then** recibe un enlace/código de un solo uso con caducidad corta (en TEST, visible solo en el simulador local) y los intentos repetidos quedan limitados.
2. **Given** una solicitud de recuperación, **When** el correo o la cuenta no existen, **Then** la respuesta es idéntica a la de una cuenta existente (sin revelar si existe).
3. **Given** un trabajador sin correo propio, **When** pierde su clave, **Then** recupera el acceso por la vía aprobada (el propietario le emite una nueva clave temporal, con las mismas reglas de un solo uso y caducidad).
4. **Given** un restablecimiento completado, **When** se usa un enlace o código anterior, **Then** se rechaza y las demás sesiones de esa cuenta se cierran.

---

### User Story 4 - Administradores solo por provisión técnica y con segundo factor (Priority: P2)

Como responsable del proyecto quiero que nadie pueda volverse administrador general desde la aplicación y que los administradores usen un segundo factor.

**Why this priority**: MEJ-015 y RF37/RF41; reduce el riesgo de elevación de privilegios.
**Independent Test**: Se comprueba que no existe pantalla ni ruta pública para crear o ascender administradores, que la provisión técnica existente (GLO-01/BOOT-01) sigue funcionando solo en TEST efímero, y que un administrador no puede operar sin segundo factor.

**Acceptance Scenarios**:

1. **Given** cualquier usuario autenticado (incluido un propietario o administrador), **When** intenta crear o ascender un administrador por la aplicación, **Then** no existe vía para hacerlo y los intentos directos a la API se deniegan y auditan.
2. **Given** un administrador general provisionado técnicamente, **When** inicia sesión, **Then** debe completar un segundo factor temporal antes de realizar acciones de plataforma; el secreto del factor se guarda protegido y nunca se muestra de nuevo (código temporal tipo TOTP, obligatorio solo para administradores generales).
3. **Given** un administrador general, **When** consulta datos de farmacias, **Then** no obtiene acceso automático a inventarios ni reservas privadas.

---

### User Story 5 - Perfil y seguridad personal (Priority: P2)

Como usuario autenticado quiero editar mis datos y gestionar la seguridad de mi cuenta desde un solo lugar, sin poder cambiar mis propios permisos.

**Why this priority**: MEJ-019 / RF44–RF45; completa la experiencia de identidad.
**Independent Test**: Un usuario cambia su nombre y teléfono, cambia su clave y cierra sus otras sesiones; al cambiar su correo debe reverificarlo.

**Acceptance Scenarios**:

1. **Given** un usuario autenticado, **When** edita nombre, teléfono, avatar opcional, tema y preferencias de notificación, **Then** los cambios se guardan solo en su cuenta.
2. **Given** un cambio de correo o de clave, **When** se solicita, **Then** se pide reautenticación y, para el correo, reverificación antes de activarlo.
3. **Given** el perfil, **When** el usuario ve sus sesiones, **Then** puede cerrar una o todas las demás sin afectar a otros usuarios.
4. **Given** cualquier pantalla de perfil, **When** el usuario intenta modificar roles o permisos, **Then** no es posible desde ahí.

### Edge Cases

- Identificador de trabajador repetido o ya usado en otra farmacia; el identificador no debe permitir enumerar cuentas ajenas.
- Un mismo usuario con roles en dos farmacias (p. ej. trabajador en Alfa y propietario en Beta): cada contexto se valida por separado.
- Propietario que intenta emitirse claves o permisos a sí mismo, o crear otro propietario/administrador por esta vía.
- Revocación mientras hay operaciones en curso (reserva, importación): se rechazan las nuevas acciones sin dejar escrituras parciales.
- Intentos repetidos de entrada, de recuperación o de segundo factor: se limitan sin bloquear indefinidamente a la víctima.
- Pérdida del dispositivo del segundo factor: debe existir un procedimiento técnico y auditado, sin atajos por la aplicación.

## Requirements *(mandatory)*

### Functional Requirements

- **F011-FR-001**: El propietario autorizado puede crear una cuenta operativa de trabajador con identificador interno único (no se presenta como correo entregable) y rol inicial; solo en su farmacia; el personal inicia sesión con ese alias (p. ej. «alfa.caja1») y puede agregar luego un correo opcional desde su perfil.
- **F011-FR-002**: La clave temporal es de un solo uso, caduca a las 24 horas, se muestra una única vez y no se puede reconsultar por nadie; tras 5 intentos fallidos la cuenta se bloquea temporalmente 15 minutos.
- **F011-FR-003**: En el primer ingreso con clave temporal el trabajador debe definir una clave nueva antes de acceder a cualquier función.
- **F011-FR-004**: El propietario puede vincular una cuenta existente mediante invitación que la persona acepta; nunca se fusionan identidades automáticamente.
- **F011-FR-005**: Los permisos de personal son independientes y por farmacia (leer/confirmar/entregar reservas, leer/escribir inventario, ejecutar importaciones); gestionar personal queda reservado al propietario.
- **F011-FR-006**: Revocar una membresía o permiso rige de inmediato y cierra las sesiones afectadas para esa farmacia.
- **F011-FR-007**: Nadie puede concederse permisos, crear otro propietario o administrador, ni actuar sobre otra farmacia; los intentos se deniegan y se auditan.
- **F011-FR-008**: Toda creación, vinculación, cambio de permisos, revocación y recuperación queda auditada (autor, destino, fecha, resultado) sin guardar claves ni secretos.
- **F011-FR-009**: No existe pantalla, botón ni ruta pública para crear o ascender administradores generales; la provisión sigue siendo un procedimiento técnico auditado, solo en bases TEST efímeras.
- **F011-FR-010**: La verificación de correo y el restablecimiento de clave usan códigos/enlaces de un solo uso con caducidad corta y respuestas que no revelan si una cuenta existe; en TEST se entregan por un simulador local (sin proveedor de correo real ni costo).
- **F011-FR-011**: Existe una vía de recuperación para trabajadores sin correo, definida en la aclaración, sin intervención de administradores generales sobre datos privados.
- **F011-FR-012**: Los administradores generales requieren un segundo factor temporal (TOTP); su secreto se guarda protegido y nunca se vuelve a mostrar. Si pierden el dispositivo, el reinicio es un procedimiento técnico auditado del operador (sin pantalla en la aplicación ni códigos de respaldo). Los propietarios no usan segundo factor en este incremento; sus acciones sensibles se refuerzan con reautenticación.
- **F011-FR-013**: El usuario puede editar su perfil (nombre, teléfono, avatar opcional, tema, notificaciones), cambiar su correo con reverificación y su clave con reautenticación, y gestionar sus propias sesiones.
- **F011-FR-014**: El perfil nunca permite editar roles, membresías ni permisos.
- **F011-FR-015**: El aislamiento entre farmacias se conserva: contexto de farmacia verificado en el servidor y en la base de datos, cero acceso cruzado Alfa/Beta, sin permisos globales implícitos ni elusión de las políticas de la base de datos.
- **F011-FR-016**: Las pruebas se ejecutan solo en bases TEST efímeras con datos ficticios; no se tocan datos reales ni bases persistentes.

### Key Entities

- **Cuenta operativa de personal**: identidad con identificador interno, estado y estado de la clave temporal.
- **Invitación de vinculación**: oferta de la farmacia a una cuenta existente, con estado (pendiente, aceptada, vencida, revocada).
- **Membresía y permisos de personal**: relación persona–farmacia con permisos independientes y revocables.
- **Credencial temporal y código de recuperación**: secreto de un solo uso con caducidad; nunca visible tras su entrega.
- **Segundo factor**: secreto protegido por usuario administrador, con procedimiento de pérdida.
- **Perfil de usuario**: datos personales, preferencias y sesiones propias.
- **Evento de auditoría de identidad**: registro inalterable de acciones de identidad y permisos.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **F011-SC-001**: Un propietario crea un trabajador y este completa su primer ingreso con cambio de clave en menos de 5 minutos, sin intervención técnica.
- **F011-SC-002**: Una clave temporal funciona exactamente una vez y falla el 100 % de los intentos tras uso o vencimiento.
- **F011-SC-003**: Tras revocar, el 100 % de las acciones del trabajador sobre esa farmacia se deniegan en el siguiente intento.
- **F011-SC-004**: En la matriz de ataques Alfa/Beta hay cero accesos cruzados y cero elevaciones de privilegio exitosas (propietario, trabajador, cliente).
- **F011-SC-005**: Cero vías en la aplicación para crear administradores; el 100 % de los intentos directos se deniegan y auditan.
- **F011-SC-006**: Un administrador sin segundo factor completado no puede ejecutar ninguna acción de plataforma.
- **F011-SC-007**: Las respuestas de recuperación para cuentas existentes y no existentes son indistinguibles para quien consulta.
- **F011-SC-008**: Ningún registro de auditoría, bitácora ni respuesta contiene claves, secretos ni códigos.
- **F011-SC-009**: La regresión aplicable de F01, F02, F04 y F05 pasa sin cambios de comportamiento para clientes y propietarios existentes.

## Assumptions

- Se reutiliza F01 (correo y clave, sesiones, membresías, RLS, GLO-01/BOOT-01) sin reabrir sus aceptaciones; F01.1 la extiende.
- Clave temporal: caducidad de 24 horas y bloqueo de 15 minutos tras 5 intentos fallidos (confirmado en *clarify*).
- En TEST/DEMO no hay proveedor de correo real: se usa un simulador local. Activar correo real requiere autorización de licencia, privacidad y costo (Puerta 5).
- Incluye de MEJ-018 solo lo mínimo para operar estas pantallas; el sistema visual integral pertenece a F08.1.
- Fuera de alcance: despliegue en AWS (F09), bases persistentes o datos reales, nuevo proveedor de pago, reservas/inventario (F04.1/F08.1), cambios a F02.5.
- F02.5 sigue sin aceptar (T046, T057, T063); F08 y F06.1 también; F02.1 está aceptada en TEST/DEMO (2026-11-23).

## Traceability and approval gate

| Fuente | Cobertura | Estado |
|---|---|---|
| Maestro v3.2 MEJ-015, HU23, RF37, AC10–AC11 | F011-FR-009; SC-005 | Propuesta; pendiente de aprobación |
| MEJ-016, HU24, RF38–RF39 | F011-FR-001–008; SC-001–004 | Propuesta |
| MEJ-017, HU25, RF40–RF41 | F011-FR-010–012; SC-006–007 | Propuesta; 2 decisiones abiertas |
| MEJ-019, HU27, RF44–RF45 | F011-FR-013–014 | Propuesta |
| F01 (EXC-01, ROL-01, GLO-01, BOOT-01), Constitution 2.0.0 | F011-FR-015–016; SC-008–009 | Se preservan |

Aprobada el 2026-11-23 para pasar a *clarify*; ver [approval.md](approval.md).
