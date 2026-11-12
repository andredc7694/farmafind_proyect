# Feature Specification: F01 — Usuarios, autenticación, roles y membresías de farmacia

**Feature Branch**: `feat/f01-identidad-multitenant`
**Created**: 2026-11-10
**Status**: Especificación aprobada; implementación F01 parcial en rama de trabajo. EXC-01/ROL-01 ratificadas el 2026-11-12 para gestión local limitada a `TRABAJADOR`; GLO-01 y ejecución de BOOT-01 siguen bloqueadas. Aceptación completa pendiente.
**Input**: Solicitud de especificar F01 mediante GitHub Spec Kit, sin generar código ni avanzar al plan.

## Clarifications

### Session 2026-11-10

- Q: ¿Quién puede gestionar membresías y delegaciones? → A: Administración delegada: el administrador de plataforma gestiona autorizaciones globales según sus permisos; el dueño o administrador autorizado gestiona solo su farmacia. Se prohíbe concederse permisos, elevarse privilegios o actuar sobre una farmacia ajena; cada cambio verifica identidad, membresía, rol, recurso y contexto y genera auditoría.
- Q: ¿Se adopta correo electrónico y contraseña propios para autenticar F01? → A: Sí, conforme al modelo de usuarios propuesto en el maestro v2.0; las contraseñas se almacenan protegidas, las sesiones expiran y pueden revocarse, se limita el abuso y se prueban casos positivos y negativos. Algoritmo, formato y plazos concretos se justifican en el plan; no se adopta proveedor externo.

### Registro de decisiones 2026-11-10 posterior a la aprobación de la especificación

La administración delegada se restringe a membresías de trabajadores y roles delegables inferiores de otras personas dentro de la farmacia autorizada. La concesión global exige autorización y procedimiento específicos; la asignación inicial de dueños y administradores de plataforma requiere un procedimiento separado y auditado. El paquete `argon2` es la primera opción técnica para Argon2id, condicionada a comprobación real en Windows 10 con Node.js 24.17.0. Estas decisiones y la discrepancia literal con el capítulo 27 del maestro se registran en [authorization-decisions.md](authorization-decisions.md). Este registro no altera los 20 requisitos funcionales ni los siete criterios de éxito aprobados.

### Ratificación limitada 2026-11-12, posterior a la aprobación de la especificación

**EXC-01** ratifica expresamente como decisión nueva de F01 la excepción limitada frente a la frase histórica del capítulo 27: dueño o administrador autorizado puede gestionar membresías de trabajadores de otras personas solo en su farmacia y con permiso explícito. **ROL-01** fija `TRABAJADOR` como único rol delegable inicial para concesión/revocación local; no autoriza conceder dueño, administrador, privilegios globales, capacidades de negocio ni permisos propios. La identidad, membresía activa, contexto, recurso, acción, auditoría y RLS siguen obligatorios. **GLO-01** no autoriza concesión global en este incremento. **BOOT-01** permite diseñar, pero no ejecutar, un procedimiento separado y auditado de alta inicial. Los escenarios de delegaciones y concesión global de US3 siguen pendientes donde excedan este catálogo; no se consideran aprobados ni probados por esta ratificación.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Registrar una identidad y gestionar su sesión (Priority: P1)

Como cliente quiero registrarme, identificarme y cerrar mi sesión para acceder únicamente a mis datos y a futuras operaciones protegidas. La búsqueda pública seguirá disponible sin cuenta.

**Why this priority**: La identidad verificable precede a la autorización de cualquier recurso privado.

**Independent Test**: Una persona con datos ficticios crea una identidad, inicia sesión, consulta su propia identidad, cierra sesión y comprueba que el acceso protegido ya no funciona; otro visitante continúa consultando información pública sin autenticarse.

**Acceptance Scenarios**:

1. **Given** un visitante sin cuenta y correo electrónico y contraseña válidos, **When** solicita registrarse, **Then** se crea una identidad de cliente con correo único y se confirma el resultado sin mostrar la contraseña ni otorgar membresías o privilegios administrativos.
2. **Given** una identidad activa y correo electrónico y contraseña correctos, **When** inicia sesión, **Then** puede acceder a su perfil privado y el sistema distingue su identidad de cualquier farmacia o rol delegado.
3. **Given** una sesión activa, **When** la persona cierra sesión, la revoca o la sesión expira, **Then** una operación protegida posterior se rechaza y no conserva un contexto de farmacia utilizable.
4. **Given** contraseña incorrecta, una identidad inactiva, intentos abusivos o una sesión inválida, **When** se intenta acceder a información privada, **Then** se rechaza o limita el intento sin revelar si existe una cuenta ni exponer datos privados.
5. **Given** un visitante sin cuenta, **When** consulta la información pública permitida, **Then** no se le exige autenticación ni se muestran datos de usuarios o datos privados de farmacias.

---

### User Story 2 - Acceder a farmacias mediante membresías activas (Priority: P1)

Como dueño, administrador o personal de farmacia quiero reconocer a qué establecimientos pertenezco, seleccionar uno de ellos y ejercer solo mis permisos allí. Un usuario puede tener más de una membresía.

**Why this priority**: La pertenencia verificable y el establecimiento activo son la frontera de seguridad del modelo pooled.

**Independent Test**: Con usuarios y farmacias ficticios A y B, una persona con dos membresías activas cambia de establecimiento y recibe solo el contexto autorizado; una persona con membresía exclusiva en A no obtiene contexto privado de B.

**Acceptance Scenarios**:

1. **Given** una persona autenticada con membresías activas en A y B, **When** consulta sus establecimientos disponibles y elige B, **Then** el contexto autorizado identifica B y el rol y las delegaciones que tiene en B, sin trasladar los de A.
2. **Given** una persona con membresía activa solo en A, **When** envía el identificador de B en ruta, parámetros, cuerpo o preferencia de sesión, **Then** se rechaza el acceso privado a B sin revelar sus registros.
3. **Given** una membresía suspendida, revocada o de una farmacia inactiva, **When** se intenta usarla o se cambia a ella, **Then** se deniega el contexto privado aunque la sesión siga siendo válida.
4. **Given** una persona que ya seleccionó A, **When** cambian sus permisos o se revoca la membresía, **Then** la siguiente operación protegida refleja el estado vigente y no reutiliza la autorización antigua.
5. **Given** dos solicitudes concurrentes del mismo usuario con contextos A y B, **When** se resuelven, **Then** cada una conserva solo su farmacia validada, sin contaminación entre solicitudes o conexiones reutilizadas.

---

### User Story 3 - Administrar roles, permisos y delegaciones sin escalamiento (Priority: P1)

Como responsable autorizado quiero asignar o retirar membresías y delegaciones dentro de mi ámbito para que cada persona ejerza solo las acciones permitidas. La administración transversal de la plataforma será explícita y auditable.

**Why this priority**: La identidad por sí sola no concede acceso al recurso ni privilegios en una farmacia.

**Independent Test**: Con identidades ficticias, un responsable permitido modifica una membresía de su ámbito; un cliente, un empleado sin delegación y un administrador de A no pueden concederse privilegios ni alterar membresías de B.

**Acceptance Scenarios**:

1. **Given** un dueño o administrador autorizado de A y un usuario objetivo distinto, **When** concede, modifica o revoca una membresía o delegación de A, **Then** se comprueban identidad, membresía, rol, recurso y contexto A; queda auditado el cambio y la autorización posterior utiliza el nuevo estado.
2. **Given** una persona autenticada sin permiso de gestionar membresías, **When** intenta crearse, elevarse un rol o delegarse una capacidad, **Then** se deniega y el estado permanece igual.
3. **Given** personal de farmacia sin delegación expresa para aceptar reservas, **When** se evalúa ese permiso, **Then** no se considera suficiente su rol general; la capacidad solo existe con delegación válida y comprobación física posterior en F04.
4. **Given** un administrador de plataforma con permiso global explícito, **When** gestiona una autorización global, **Then** la acción se limita a ese permiso, se audita y no le concede por defecto editar inventario de otra farmacia.
5. **Given** un dueño o administrador autorizado de A, **When** intenta gestionar una membresía de B, **Then** se rechaza aunque conozca el identificador de B y no se modifica ningún permiso.

---

### User Story 4 - Proteger la separación de datos y revisar accesos (Priority: P1)

Como persona usuaria y responsable de seguridad quiero que los datos privados de identidad y farmacia permanezcan separados, y que los intentos relevantes de acceso queden auditados sin exponer credenciales.

**Why this priority**: La autorización de aplicación y el aislamiento de datos deben impedir el acceso cruzado incluso ante entradas manipuladas.

**Independent Test**: Un conjunto ficticio de dos farmacias comprueba acceso positivo dentro de A, denegación a B, ausencia de filas privadas sin contexto, rechazo de escritura con otra farmacia y registros de seguridad sin secretos.

**Acceptance Scenarios**:

1. **Given** una operación privada autorizada para A, **When** se realiza, **Then** solo obtiene o modifica datos de A permitidos para ese rol y recurso.
2. **Given** identidad o membresía insuficiente, **When** se intenta leer, crear, modificar o borrar datos privados de B, **Then** se deniega, no se modifica ninguna fila y se registra el intento relevante sin datos sensibles.
3. **Given** una transacción sin contexto de farmacia validado, **When** intenta acceder a registros privados, **Then** no lee ni modifica esos registros.
4. **Given** una sesión de A seguida por otra de B sobre infraestructura compartida, **When** se atienden ambas, **Then** el contexto de A no aparece en la operación de B ni en su respuesta.
5. **Given** una consulta pública permitida, **When** se entrega información de establecimiento, **Then** la respuesta contiene solo campos públicos autorizados y excluye credenciales, membresías, auditoría y operaciones internas.

### Edge Cases

- Registro repetido de la misma identidad, credenciales malformadas, múltiples intentos de inicio fallido y sesión vencida o cerrada.
- Usuario con cero, una o varias membresías; selección de farmacia inexistente, inactiva, revocada o sin el permiso solicitado.
- Cambio de rol o delegación entre validación inicial y operación, y solicitudes paralelas con farmacias distintas.
- Identificador de farmacia manipulado en ruta, cuerpo o parámetros; identificador de usuario ajeno; ausencia de contexto en una transacción.
- Reutilización de conexión, fallo o reversión de transacción y trabajos internos sin una política de alcance explícita.
- Administrador transversal sin motivo o permiso específico; petición de datos privados a través de una salida pública.

## Requirements *(mandatory)*

### Functional Requirements

- **F01-FR-001**: El sistema DEBE permitir el registro de identidad de cliente mediante correo electrónico único y contraseña, con entradas validadas; DEBE impedir duplicados y no asignar membresías ni privilegios administrativos por el mero registro.
- **F01-FR-002**: El sistema DEBE autenticar a una persona activa con su correo electrónico y contraseña propios, rechazar intentos inválidos sin revelar existencia de cuentas y limitar intentos abusivos de acceso.
- **F01-FR-003**: El sistema DEBE permitir cerrar o revocar la sesión y hacer que las sesiones expiradas, cerradas o revocadas no autoricen operaciones posteriores; el acceso privado DEBE exigir una sesión válida.
- **F01-FR-004**: El sistema DEBE permitir a cada persona autenticada consultar únicamente sus datos de identidad permitidos; las búsquedas públicas DEBEN seguir accesibles sin cuenta y sin exponer datos privados.
- **F01-FR-005**: El sistema DEBE distinguir identidad global, rol de plataforma, membresía usuario–farmacia, rol y delegaciones de esa membresía, farmacia seleccionada y permiso sobre el recurso solicitado. Ninguno de estos elementos por sí solo DEBE sustituir a los demás.
- **F01-FR-006**: Una persona DEBE poder consultar sus membresías vigentes y seleccionar explícitamente una farmacia activa entre las autorizadas; la selección DEBE revalidarse en cada operación protegida y no depender solo del identificador enviado por el cliente.
- **F01-FR-007**: Una membresía DEBE tener usuario, farmacia, rol, delegaciones y estado; las membresías revocadas, suspendidas o asociadas a farmacias inactivas NO DEBEN habilitar acceso privado.
- **F01-FR-008**: La concesión, modificación y revocación de membresías, roles o delegaciones DEBE verificar identidad, pertenencia pertinente, rol, recurso y contexto autorizado y producir un registro auditable. El administrador de plataforma solo DEBE gestionar autorizaciones globales conforme a un permiso transversal explícito, sin presumir membresía en todas las farmacias; el dueño o administrador autorizado DEBE tener membresía activa y solo DEBE gestionar membresías y delegaciones dentro de su propia farmacia, sobre otras personas.
- **F01-FR-009**: El sistema DEBE impedir que un usuario se otorgue a sí mismo privilegios, use un rol de otra farmacia o administre membresías ajenas sin autorización.
- **F01-FR-010**: La autorización DEBE evaluar identidad autenticada, estado, rol, delegación cuando corresponda, farmacia activa, recurso y acción. La propiedad de recursos de cliente DEBE comprobarse independientemente de permisos de farmacia.
- **F01-FR-011**: El acceso transversal del administrador de plataforma DEBE requerir permiso explícito, alcance limitado y auditoría; NO DEBE equivaler a autorización general para modificar inventarios privados.
- **F01-FR-012**: Los datos de usuarios y membresías DEBEN ser privados salvo los campos expresamente autorizados para la propia persona o un administrador con permiso; las salidas públicas de farmacias DEBEN excluir credenciales, membresías, registros de seguridad y datos internos.
- **F01-FR-013**: Las contraseñas DEBEN almacenarse en forma protegida y nunca en claro; credenciales y sesiones NO DEBEN exponerse en frontend, respuestas o registros. Las sesiones DEBEN tener expiración y revocación efectivas; el acceso DEBE limitar abuso y los errores NO DEBEN revelar secretos ni existencia de cuentas. El algoritmo de protección, formato y plazos de sesión y controles concretos se justifican en el plan, sin seleccionar proveedor externo por anticipado.
- **F01-FR-014**: Los eventos de registro, inicio de sesión exitoso o fallido, cierre de sesión, cambios de membresía/rol/delegación y denegaciones relevantes DEBEN tener trazabilidad de actor, acción, ámbito, resultado, fecha y correlación, minimizando datos personales y sin guardar secretos.
- **F01-FR-015**: PostgreSQL DEBE ser la fuente oficial de identidades, membresías, roles, estados y auditoría; las escrituras relacionadas DEBEN preservar integridad de usuario–farmacia y no crear relaciones cruzadas inválidas.
- **F01-FR-016**: El modelo multi-tenant DEBE ser pooled: registros privados vinculados a farmacia, autorización por farmacia/recurso/rol y PostgreSQL RLS como barrera adicional para lectura, inserción, actualización y borrado. Sin contexto válido, el acceso privado DEBE denegarse.
- **F01-FR-017**: El contexto de farmacia DEBE derivarse de identidad y membresía comprobadas y establecerse localmente a la transacción, en la misma conexión de las consultas; NO DEBE persistir entre transacciones, conexiones reutilizadas o trabajos. El rol de aplicación NO DEBE ser superusuario ni eludir RLS; propietarios, migraciones, mantenimiento y trabajadores requieren políticas explícitas y auditadas.
- **F01-FR-018**: Las pruebas de F01 DEBEN cubrir registros e inicios/cierres válidos e inválidos, contraseñas incorrectas, abuso, expiración y revocación de sesión, roles y delegaciones, membresías múltiples/revocadas, cambio de farmacia, lecturas y escrituras cruzadas, ausencia de contexto, reutilización/concurrencia de conexiones y salida pública; el 100 % de los intentos no autorizados definidos en la batería AC04 DEBE ser rechazado sin filtración de datos, junto con casos positivos equivalentes.
- **F01-FR-019**: Los contratos de operaciones protegidas DEBEN definir validación, respuestas de no autenticado/no autorizado/no encontrado, errores consistentes y trazabilidad, sin revelar datos de otro usuario o farmacia. Su forma concreta se documentará antes de implementar.
- **F01-FR-020**: F01 DEBE limitarse a identidad, roles, membresías, autorización y su aislamiento verificable; NO DEBE implementar CRUD de farmacias, inventario, reservas, búsqueda, notificaciones de negocio, pagos ni FarmaFind AI.

### Key Entities *(include if feature involves data)*

- **Usuario**: identidad global, correo electrónico único, estado y referencia a contraseña protegida; no pertenece automáticamente a una farmacia.
- **Rol de plataforma**: permiso transversal explícito para administración de FarmaFind, separado de roles de farmacia.
- **Farmacia de referencia**: identificador y estado necesarios para validar membresías; su alta y gestión de negocio pertenecen a otra funcionalidad.
- **Membresía usuario–farmacia**: asociación explícita con rol, estado y delegaciones; puede haber varias por usuario, sin mezclar sus permisos.
- **Sesión/contexto autenticado**: identidad comprobada, vigencia y revocación; la farmacia seleccionada solo es válida tras verificar su membresía actual.
- **Evento de auditoría**: actor, acción, ámbito, resultado, momento y correlación, sin credenciales ni datos personales innecesarios.

### Scope Boundaries and Security Rules

F01 define la base de identidad y aislamiento para módulos posteriores. Las pruebas pueden usar dos farmacias y usuarios ficticios, pero no autorizan implementar las operaciones de inventario, reserva o búsqueda utilizadas como ejemplos históricos. `farmacia_id` presentado por el cliente es una petición de contexto, nunca la prueba de autorización. La salida pública usa una proyección segura y no desactiva RLS para consultar datos privados. Los procesos internos y el administrador transversal necesitan permisos específicos; no se presume bypass. La elección de biblioteca, proveedor, esquema de sesión, ORM y políticas SQL finales pertenece al plan y a las ADR complementarias aprobadas.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **F01-SC-001**: En la batería de aceptación con identidades ficticias, el 100 % de los registros válidos crea solo una identidad de cliente y el 100 % de los registros duplicados o inválidos falla sin privilegios nuevos.
- **F01-SC-002**: El 100 % de los accesos protegidos con sesión inválida, expirada, cerrada o revocada se deniega; todos los accesos positivos definidos con sesión vigente alcanzan solo los datos permitidos.
- **F01-SC-003**: En escenarios con dos farmacias y un usuario miembro de ambas, el 100 % de los cambios de establecimiento aplica el rol y las delegaciones del establecimiento seleccionado sin fuga del anterior, incluso en solicitudes concurrentes.
- **F01-SC-004**: El 100 % de los intentos no autorizados de la batería AC04, incluidos lectura y escritura entre farmacias, falta de membresía, delegación y contexto, se rechaza sin datos filtrados ni cambios; los casos positivos equivalentes funcionan.
- **F01-SC-005**: El 100 % de las respuestas públicas y registros de seguridad inspeccionados en las pruebas excluye credenciales, sesiones, datos privados de membresía y datos personales innecesarios.
- **F01-SC-006**: El 100 % de los cambios de membresía, rol o delegación ejecutados en las pruebas deja un evento auditable y afecta la siguiente evaluación de acceso; ningún cambio no autorizado altera el estado.
- **F01-SC-007**: Una revisión de alcance identifica F01 como identidad multi-tenant y conserva íntegros los siete módulos históricos, con cero operaciones de negocio de otros módulos atribuidas a F01.

## Assumptions

- El registro ordinario corresponde a cliente, como indica el actor del maestro; la incorporación de personal a farmacias requiere membresía autorizada y no se obtiene en el autorregistro.
- Una persona puede administrar varias farmacias, pero selecciona una activa por operación protegida y se revalida la pertenencia vigente. La interfaz concreta de selección se decidirá en el plan.
- Se adopta correo electrónico y contraseña propios, conforme al modelo propuesto en el maestro; no se selecciona proveedor externo, algoritmo, formato de sesión ni plazo exacto en la especificación. El plan debe justificar esas decisiones con riesgos y pruebas antes de implementar. La recuperación de cuenta no se presupone como funcionalidad de F01.
- Las farmacias A/B, usuarios, credenciales de prueba y eventos serán ficticios. PostgreSQL/RLS requerirá integración real de prueba para acreditar F01; la base de F00 por sí sola no lo demuestra.
- La aceptación definitiva de F00 continúa pendiente de Playwright, preparaciones A/B completas y revisión humana. F01 no altera ni cierra esas tareas.

### Sources and Traceability

| Fuente leída | Obligación conservada en F01 | Límite |
|---|---|---|
| Documento Maestro Definitivo v2.0, capítulos 4, 7, 12–14, 27–29, 33 y 36 | Actores, registro/autenticación, membresías usuario–farmacia, selección activa, autorización por recurso, RLS pooled y pruebas de dos tenants | Los ejemplos SQL y rutas son ilustrativos; no son implementación aprobada. |
| Constitución v1.1.0, principios I–VIII, XIII–XV, XVII–XX | SDD, siete módulos, stack y capas, PostgreSQL, aislamiento, pruebas, privacidad y revisión humana | No modifica la Constitución ni sus ADR pendientes. |
| Histórico HU01–HU06, RF01–RF13 | HU01–02/RF01–04 mantienen búsqueda pública; HU03/RF05/08 necesitan cliente autenticado; HU04–05/RF09–10 dependen de permisos por farmacia; HU06/RF11 depende de administración autorizada | Ningún flujo de reserva, inventario, búsqueda o administración de farmacias se implementa en F01. |
| Histórico AC04, AC09, RC01–RC04, RC08, DA04, DA06, DA09, ADR-01–ADR-06 | Seguridad por rol/recurso, auditoría, restricciones de stack, monolito modular, Clean Architecture, PostgreSQL oficial y pruebas negativas | RC04 permanece pendiente de formalización documental; las ADR complementarias de RLS, AWS e IA permanecen pendientes. |
| Rúbrica oficial `RUBRICA.png`, 16 criterios con puntajes vacíos | F01 aporta requisitos a criterios 1–7, 9, 12 y 14–16 mediante diseño, pruebas y trazabilidad futura | Criterios 8, 10, 11 y 13 y la evidencia global de los 16 se atienden en otras fases; no se atribuyen resultados ni calificaciones. |
| Repositorio histórico `PROYEC_FARMAFIND`, archivo local `PROYEC_FARMAFIND.rar` y GitHub | Actores, HU, RF, restricciones, drivers, escenarios y ADR-01–12 contrastados | Repositorio documental; `farmafind_proyect` es la base de desarrollo SDD. |

### Pending Human Decisions

Las dos decisiones funcionales están aclaradas y la especificación fue aprobada expresamente el 2026-11-10 para planificar. El plan deberá justificar la matriz de acciones sin ampliar autoridades y los parámetros técnicos de contraseña, sesión y control de abuso; la recuperación de cuenta requeriría alcance y aprobación separados.

La especificación fue aprobada expresamente para `$speckit-plan` el 2026-11-10. Esa aprobación no autoriza generar tareas ni implementar F01 y no cierra la aceptación pendiente de F00.
