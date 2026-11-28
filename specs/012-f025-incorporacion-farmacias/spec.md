# Feature Specification: F02.5 — Incorporación y administración de farmacias

**Feature Branch**: `feat/f025-incorporacion-farmacias`
**Created**: 2026-11-19
**Status**: Especificación aprobada expresamente el 2026-11-19 para implementación TEST/DEMO; aceptación funcional final pendiente. Ver [approval.md](approval.md).
**Input**: Solicitud F02.5 del responsable recibida en esta conversación el 2026-11-19.

F02.5 se ubica conceptualmente entre F02 y F03, pero se prepara cronológicamente después de F08. `012` es solo el prefijo del directorio Spec Kit. No renumera F00–F10. La Constitution 1.3.0 y el Documento Maestro v3.0 rigen; la primera incorporó expresamente F02.5 al roadmap. El nuevo Documento Maestro v3.1, verificado íntegramente, sigue siendo una **propuesta documental no adoptada como fuente principal**; su sección A4 bis propone 28 requisitos y 12 criterios F02.5. No reemplaza al v3.0 por sí mismo.

**Secuencia resuelta:** `ADR-ROADMAP-V3-001`, decisión 3, conserva el antecedente F06.1 → F07 → F08 → F09 → F10. La Constitution 1.3.0, principio XV, incorpora expresamente F02.5 después de F08 y antes de F09, sin alterar identificadores históricos; véase [approval.md](approval.md).

## Clarifications

### Session 2026-11-19

- Q: ¿Se permiten permisos específicos de plataforma para revisar y activar farmacias? → A: Sí, DEC-01 aprobada para diseñar lectura de solicitudes, documentos autorizados, decisiones y activación auditada; sin acceso automático a inventarios/reservas privadas, sin SUPERUSER/BYPASSRLS y con ejecución solo TEST/DEMO aislada hasta autorización posterior.
- Q: ¿Puede una aprobación válida crear la primera membresía de propietario? → A: Sí, DEC-02 aprobada como excepción nueva, limitada a TEST/DEMO aislado, una sola membresía para el solicitante y farmacia recién aprobada, transaccional, idempotente y auditada; sin provisión persistente/productiva.
- Q: ¿Qué datos y documentos se exigen para TEST/DEMO? → A: DEC-03 aprueba datos ficticios mínimos de establecimiento, contacto, ubicación y representante; RUC y adjuntos opcionales solo en TEST/DEMO, sin afirmar verificación legal, sanitaria o documental.

### Adenda de aclaración 2026-11-21 — aprobada para diseño SDD TEST

El responsable aprobó expresamente esta revisión de `spec.md` y su adenda de `plan.md` para T031, T036–T037 y las suites F06.1 en la conversación del 2026-11-21; la identificación de la revisión consta en [approval.md](approval.md). La aprobación **no autoriza código en esta ejecución**, otros requisitos, F025-RF23, mejoras v3.2 ni AWS. No se añaden ni eliminan los 28 FR ni los ocho SC existentes.

- **T031 / F025-FR-008/017:** los eventos `SOLICITUD_ENVIADA`, `SOLICITUD_OBSERVADA`, `SOLICITUD_APROBADA` y `SOLICITUD_RECHAZADA` se dirigen solo al solicitante mediante el Outbox F02.5 y el servicio F05 ya existente. La recepción local privada e idempotente usa un contrato interno versionado distinto del contrato de reservas F04. El evento incluye solo identificadores, tipo, versión y fecha; no contiene contacto, documentos, motivo libre ni datos del establecimiento. Una caída de F05 no cambia el estado de la solicitud. Los registros de recepción y entrega local F02.5 en F05 se conservan **30 días en TEST, configurables**, con eliminación acotada y verificable solo de esos registros; la auditoría y el Outbox de la solicitud conservan sus reglas propias.
- **T036–T037 / F025-FR-010/011/013:** el DUENO activo con delegaciones explícitas `pharmacy.profile.read` y `pharmacy.profile.write` puede consultar el perfil privado de su farmacia y actualizar **solo `contacto`** con control de versión y auditoría. No obtiene derecho implícito por ser dueño o administrador global. Dirección y divisiones territoriales se leen, pero su modificación y publicación requieren un procedimiento de revisión administrativa posterior; nombre, estado, identificadores, propietario y permisos no se editan aquí. Trabajadores y administradores de farmacia sin delegación expresa, usuarios ajenos y administradores globales sin membresía quedan denegados.
- **Regresión F06.1:** las dos suites de integración PostgreSQL/Redis se preparan para una base madre TEST exclusiva, distinta de `farmafind_f01_test` y de la DEMO manual. Cada ejecución identifica las bases y roles efímeros que creó y solo puede limpiar esos recursos tras verificar su propiedad. Esta aprobación cubre el diseño de esa creación y limpieza acotada, **no ejecuta ni aprueba una operación real en esta revisión**; no se modifica la funcionalidad del asistente ni su modo MOCK.

**Escenarios de aceptación aprobados para verificación futura, aún no ejecutados:** (a) cada tipo de solicitud deja exactamente un efecto local lógico; reenvío idéntico no duplica, un payload distinto con el mismo ID se rechaza, el fallo de F05 conserva la solicitud y la retención TEST configurable se cumple; (b) DUENO de Alfa lee y cambia solo su `contacto`, mientras Beta, trabajador sin grant y revisor global no pueden leer ni escribirlo por HTTP ni SQL; revocar sesión/membresía/grant niega la siguiente operación; dos ediciones con la misma versión producen un éxito y un conflicto; (c) las dos suites F06.1 crean datos solo en hijos efímeros marcados y dejan intactas las bases preexistentes, con RLS y fallback Redis comprobados. Las condiciones existentes de cinco farmacias, F025-RF23 bloqueado y aceptación humana final no cambian.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Solicitar incorporación (Priority: P1)

Como persona con cuenta normal quiero presentar y seguir una solicitud de farmacia sin recibir privilegios por enviarla.

**Why this priority**: Es la entrada segura al proceso.

**Independent Test**: En TEST, una cuenta normal envía una solicitud ficticia, ve su estado y sigue sin poder administrar farmacias; otra cuenta no puede verla.

**Acceptance Scenarios**:
1. **Given** un visitante, **When** elige «Registrar mi farmacia», **Then** inicia sesión o se registra y vuelve al formulario sin rol privilegiado.
2. **Given** una sesión vigente, **When** envía datos válidos, **Then** obtiene una solicitud PENDIENTE; no se crea farmacia operativa ni membresía.
3. **Given** una solicitud OBSERVADA, **When** su titular corrige y reenvía, **Then** queda una nueva revisión y se conserva el historial.

### User Story 2 — Revisar y decidir (Priority: P1)

Como revisor de plataforma con permiso específico de Farmacias quiero examinar y decidir solicitudes sin acceder a inventarios privados.

**Why this priority**: Solo una decisión autorizada puede activar un establecimiento.

**Independent Test**: En TEST aislado, un revisor autorizado aprueba una solicitud sintética una sola vez; el solicitante, un cliente y un administrador de farmacia son rechazados.

**Acceptance Scenarios**:
1. **Given** una solicitud revisable, **When** un revisor autorizado observa o rechaza con motivo, **Then** quedan actor, motivo, fecha y estado auditados.
2. **Given** una solicitud aprobable, **When** se aprueba, **Then** se crea una farmacia, su tenant y la membresía de dueño aprobada, más auditoría y evento F05, en una unidad atómica; el inventario queda vacío.
3. **Given** dos aprobaciones concurrentes o un reintento, **When** se decide la misma solicitud, **Then** no se duplican farmacia, membresía ni evento efectivo.
4. **Given** una cuenta sin permiso, **When** intenta revisar, aprobar o leer documentos, **Then** se deniega sin revelar información privada.

### User Story 3 — Administrar la farmacia propia (Priority: P1)

Como dueño aprobado quiero seleccionar mi farmacia y usar las capacidades F01/F02/F04/F07 para las que tenga permiso, sin acceso privado a otro tenant.

**Why this priority**: El alta solo es útil si el establecimiento puede operarse con límites verificables.

**Independent Test**: Con Alfa y Beta TEST, Alfa administra únicamente Alfa aunque manipule URL, cuerpo, cabecera, archivo o identificadores de Beta.

**Acceptance Scenarios**:
1. **Given** aprobación válida, membresía y sesión vigentes, **When** selecciona su farmacia, **Then** ve resumen, inventario vacío y solo acciones realmente autorizadas.
2. **Given** el dueño de Alfa, **When** intenta leer o modificar inventario, reservas, trabajadores, ubicación o documentos privados de Beta, **Then** se rechaza en API y base de datos.
3. **Given** acceso independiente a Alfa y Beta, **When** cambia de farmacia activa, **Then** se revalidan permisos y no se filtra el contexto previo.
4. **Given** sesión revocada o membresía inactiva, **When** intenta operar, **Then** pierde acceso en la siguiente solicitud.

### User Story 4 — Importar y publicar (Priority: P2)

Como responsable con permiso F02 quiero descargar una plantilla, subir CSV o XLSX, revisar errores y confirmar una importación de mi farmacia.

**Why this priority**: Reutiliza F02/F03 sin redefinir sus reglas.

**Independent Test**: Alfa importa un archivo pequeño; Beta no puede acceder a la importación y el público ve solo la proyección permitida.

**Acceptance Scenarios**:
1. **Given** una farmacia activa, **When** carga CSV o XLSX admitido, **Then** obtiene vista previa y errores por fila antes de confirmar.
2. **Given** archivo válido, **When** confirma, **Then** se aplica atómicamente al tenant autorizado y se invalida la caché afectada.
3. **Given** archivo o petición con identificador de Beta, **When** Alfa intenta importar, **Then** se deniega; el archivo nunca determina el tenant efectivo.

### User Story 5 — Buscar y reservar como público (Priority: P2)

Como visitante quiero buscar y comparar ofertas públicas sin cuenta, y autenticarme solo al reservar.

**Why this priority**: Conecta la nueva incorporación con F03/F04.

**Independent Test**: Un visitante compara dos farmacias activas, inicia sesión al reservar y se revalida disponibilidad.

**Acceptance Scenarios**:
1. **Given** un visitante, **When** busca, compara, consulta cercanía o usa el asistente informativo, **Then** ve únicamente datos públicos autorizados.
2. **Given** una oferta elegida sin sesión, **When** intenta reservar, **Then** se conserva la intención; tras autenticarse se revalidan farmacia, producto y disponibilidad.
3. **Given** farmacia no aprobada o inactiva, **When** busca o reserva, **Then** no aparece como oferta activa ni recibe nuevas reservas.

### User Story 6 — Demostrar cinco farmacias (Priority: P2)

Como responsable quiero solicitar, aprobar y operar cinco farmacias ficticias desde el navegador en TEST aislado, sin scripts ni SQL para dar de alta cada una.

**Why this priority**: Demuestra el recorrido humano completo.

**Independent Test**: Un revisor TEST autorizado decide cinco solicitudes; cada solicitante importa manualmente inventario distinto y solo administra su tenant.

**Acceptance Scenarios**:
1. **Given** TEST vacío con un revisor provisionado por mecanismo aprobado, **When** cinco solicitantes completan el flujo, **Then** existen exactamente cinco farmacias activas y cinco membresías de dueño auditadas, con inventario inicial vacío.
2. **Given** cinco importaciones manuales, **When** se comparan ofertas y se crea una reserva, **Then** cada panel ve solo su tenant y el portal público solo datos autorizados.

### Edge Cases

- Solicitud duplicada, reenvío tras observación y rechazo/cancelación terminal sin aprobación por manipulación del cliente.
- Dos revisores deciden simultáneamente: solo una activación válida.
- Fallo entre farmacia, membresía, auditoría y evento: reversión completa.
- Documento faltante, ilegible, demasiado grande o con tipo falso: rechazo sin almacenamiento público.
- Desactivación posterior: no admitir nuevas reservas ni mostrar ofertas activas; conservar reglas de reservas existentes.
- Cambio de farmacia activa y reutilización de conexión: ningún contexto anterior puede filtrarse.
- CSV/XLSX con fórmulas, referencias externas, columnas o identificadores de otro tenant: rechazo conforme a F02.

## Requirements *(mandatory)*

### Functional Requirements

- **F025-FR-001**: El acceso público DEBE permitir búsqueda, comparación, cercanía y asistente informativo dentro de los límites históricos sin cuenta.
- **F025-FR-002**: El autorregistro DEBE crear solo una cuenta normal, sin membresía ni rol privilegiado.
- **F025-FR-003**: «Registrar mi farmacia» DEBE requerir sesión y ofrecer formulario y seguimiento propios, sin conceder permisos por enviar la solicitud.
- **F025-FR-004**: En TEST/DEMO la solicitud DEBE conservar datos ficticios mínimos de establecimiento, contacto, ubicación y representante. RUC y adjuntos son opcionales; no se presume validación legal, sanitaria ni documental. Su obligatoriedad futura exige fuentes y aprobación específicas.
- **F025-FR-005**: Los estados DEBEN ser BORRADOR, PENDIENTE, EN_REVISION, OBSERVADA, APROBADA, RECHAZADA y CANCELADA. Transiciones propuestas: BORRADOR→PENDIENTE; PENDIENTE→EN_REVISION/CANCELADA; EN_REVISION→OBSERVADA/APROBADA/RECHAZADA/CANCELADA; OBSERVADA→PENDIENTE/CANCELADA. APROBADA, RECHAZADA y CANCELADA son terminales para la misma revisión. Actor, motivo pertinente, fecha e historial DEBEN verificarse en cada transición.
- **F025-FR-006**: El solicitante DEBE consultar solo sus solicitudes, corregir y reenviar una OBSERVADA y cancelar cuando proceda; NO DEBE aprobar ni forzar estados.
- **F025-FR-007**: Solo un administrador de plataforma con permiso F02.5 expreso DEBE revisar solicitudes ajenas, decidirlas y acceder a documentos privados autorizados. El rol global F01 por sí solo NO confiere estas capacidades ni acceso a inventarios o reservas privados de tenant. DEC-01 autoriza diseñar estos permisos para TEST/DEMO aislado.
- **F025-FR-008**: En TEST/DEMO aislado, una aprobación legítima DEBE crear o activar exactamente una farmacia y su tenant, conceder una única membresía DUENO al solicitante y registrar auditoría y evento local F05 de forma transaccional, idempotente y segura ante concurrencia; inventario inicial vacío. DEC-02 es una excepción nueva limitada; no altera la regla histórica para otros entornos.
- **F025-FR-009**: El revisor general TEST DEBE provisionarse solo con mecanismo autorizado en base efímera; GLO-01/BOOT-01 no se habilitan en base persistente ni producción.
- **F025-FR-010**: Cada operación privada DEBE verificar sesión, identidad, rol, membresía activa, permiso, recurso y farmacia efectiva; conocer `farmacia_id` no autoriza.
- **F025-FR-011**: Datos privados de farmacia, inventario, importaciones, reservas, membresías y auditoría DEBEN quedar aislados por tenant mediante autorización y PostgreSQL RLS en lectura/escritura, con denegación sin contexto validado.
- **F025-FR-012**: El administrador de plataforma NO DEBE acceder a inventarios privados por tener un rol global; supervisión y decisiones DEBEN ser explícitas y auditadas.
- **F025-FR-013**: El portal DEBE mostrar farmacia activa y permisos vigentes y reutilizar únicamente las funciones F01/F02/F04/F07 autorizadas.
- **F025-FR-014**: La importación DEBE reutilizar CSV/XLSX de F02, plantilla, vista previa, mapeo, límites, errores por fila, confirmación, atomicidad, idempotencia y auditoría; el archivo NO DEBE seleccionar tenant.
- **F025-FR-015**: Búsqueda/comparación DEBEN usar solo proyecciones de farmacias activas y ofertas publicables; activación, desactivación autorizada y cambios de ofertas DEBEN actualizar o invalidar la caché F03 afectada. La desactivación DEBE impedir nuevas reservas y retirar ofertas activas, pero su operación administrativa sigue fuera del alcance hasta aprobar el procedimiento F025-RF23.
- **F025-FR-016**: Tras autenticarse para reservar, la intención del visitante DEBE recuperarse sin datos privados innecesarios y DEBE revalidarse conforme a F04.
- **F025-FR-017**: Reservas y notificaciones DEBEN conservar transiciones, vencimiento, concurrencia, Outbox transaccional F04 y procesamiento separado F05, sin canales externos nuevos. Los cambios de estado de solicitud que requieran aviso local DEBEN registrar eventos mínimos de Outbox sin adjuntos privados ni datos sensibles.
- **F025-FR-018**: Si en TEST/DEMO se recogen adjuntos sintéticos opcionales, DEBEN validarse tamaño, tipo real y contenido permitido, restringirse acceso/retención y mantenerse fuera de proyecciones públicas y evidencias. No se aceptan documentos personales reales ni se presume comprobación legal.
- **F025-FR-019**: Cada decisión administrativa DEBE auditar actor, solicitud/farmacia, acción, motivo, fecha y correlación sin secretos; errores denegados NO DEBEN revelar datos ajenos.
- **F025-FR-020**: Las pruebas DEBEN cubrir Alfa/Beta, manipulación de URL/cuerpo/cabecera/archivo, lectura/escritura cruzadas, cambio de tenant, revocación, concurrencia y proyección pública en HTTP y PostgreSQL RLS real TEST.
- **F025-FR-021**: En TEST aislado DEBE poder completarse desde navegador un recorrido con cinco farmacias ficticias sin scripts de alta individual; `farmafind_f01_test` DEBE quedar intacta.
- **F025-FR-022**: El frontend DEBE conservar una sola aplicación con áreas pública, cliente, farmacia y plataforma; ocultar botones NO DEBE reemplazar autorización del servidor.
- **F025-FR-023**: El solicitante DEBE poder guardar BORRADOR y enviarlo expresamente; solicitudes repetidas para el mismo establecimiento DEBEN detectarse sin revelar datos ajenos.
- **F025-FR-024**: El panel de plataforma TEST DEBE estar separado por ruta y exigir sesión, permiso F02.5 vigente y autorización por objeto; debe mostrar estados de carga, vacío y denegación accesibles.
- **F025-FR-025**: Los flujos de solicitud, revisión e importación DEBEN validar entradas, proteger sesión y cambios de estado contra abuso/CSRF según F01, y evitar enumeración de solicitudes.
- **F025-FR-026**: La desactivación/suspensión futura DEBE requerir procedimiento y permisos específicos que definan sus efectos en ofertas, sesiones, reservas y auditoría; **no se implementa en el alcance TEST inicialmente aprobado**. La propuesta F025-RF23 de v3.1 queda pendiente de decisión separada.
- **F025-FR-027**: Las vistas nuevas DEBEN mantener accesibilidad, adaptación móvil y español de F08, con estados de error, carga y recuperación verificables.
- **F025-FR-028**: Los campos de identificación comercial y documentos obligatorios futuros DEBEN contrastarse con fuentes peruanas vigentes y revisión humana antes de presentarse como habilitación legal real.
- **F025-FR-029** *(enmienda 2026-11-26, ver [enmienda-personal.md](enmienda-personal.md))*: Todo propietario creado por la activación de una solicitud aprobada DEBE recibir `membership.manage` de forma automática y atómica con su membresía. Solo el propietario (nunca trabajadores ni el administrador global), sin autoescalada. Las farmacias ya activadas se reparan una vez, con auditoría.

### Key Entities

- **Solicitud**: establecimiento propuesto, solicitante, estado, revisión, fechas e identidad estable; no es farmacia activa.
- **Revisión**: decisión, actor, motivo, fecha y correlación; conserva observaciones y reenvíos.
- **Farmacia/tenant**: establecimiento aprobado con estado y proyección pública depurada; reutiliza modelo existente.
- **Membresía de dueño**: vínculo explícito y auditable entre solicitante y farmacia aprobada.
- **Documento privado**: opcional y sujeto a aprobación del alcance, validación, acceso y retención.
- **Evento de activación**: notificación local posterior al compromiso, sin secretos ni documentos.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **F025-SC-001**: Cinco solicitudes TEST pueden registrarse y decidirse desde navegador; resultan exactamente cinco farmacias activas, sin activaciones duplicadas.
- **F025-SC-002**: Cada uno de los cinco dueños accede a su propio panel; los 20 casos negativos de aislamiento solicitados se deniegan en HTTP y, donde aplique, en la capa de datos.
- **F025-SC-003**: El 100 % de intentos de aprobación por cuentas sin permiso F02.5, incluido el solicitante, se deniega sin crear farmacia o membresía.
- **F025-SC-004**: Dos decisiones concurrentes o reintentos producen como máximo una activación y una membresía efectiva; un fallo crítico deja cero activaciones parciales.
- **F025-SC-005**: Los cinco inventarios empiezan vacíos; sus responsables pueden importar un archivo admitido con vista previa y errores antes de confirmar, sin afectar otro tenant.
- **F025-SC-006**: Visitantes sin cuenta comparan ofertas públicas de varias farmacias; en la muestra TEST aparecen cero campos privados.
- **F025-SC-007**: Un cliente retoma la reserva tras autenticarse y recibe revalidación de disponibilidad antes de confirmarla.
- **F025-SC-008**: El 100 % de las decisiones TEST conserva actor, acción, motivo y fecha auditables, sin credenciales ni documentos privados en la salida pública.

## Assumptions, dependencies and decisions requiring clarification

- **Fuentes**: Constitution 1.3.0; maestro v3.0 Parte A §§A2/A4 y Parte B caps. 4, 5, 12, 27–29; nuevo maestro v3.1 Parte A §A4 bis, **fuente específica de alcance F02.5 sin adopción como maestro principal**; F01 `authorization-decisions.md` (EXC-01/ROL-01/GLO-01/BOOT-01); especificaciones F02–F08.
- **Comprobación de reutilización**: F02 especifica CSV y XLSX; el parser actual admite ambos. F08 ya presenta importación. F01 provee identidad, sesiones y membresías. No se detectaron formulario/API de solicitudes y aprobación de farmacias. La plantilla CSV DEMO es un cambio local sin versionar, no aceptación histórica.
- **DEC-01 — aprobada con límites**: catálogo de permisos de Farmacias independiente de los cinco GLO-01, solo para solicitudes/documentos/decisiones/activación autorizadas; los códigos y el mecanismo de concesión TEST se fijarán en el plan para revisión, sin privilegios persistentes.
- **DEC-02 — aprobada con límites**: excepción nueva y trazada a la prohibición histórica del capítulo 27; una membresía DUENO por aprobación en TEST/DEMO, no autorregistro ni BOOT-01 en base persistente.
- **DEC-03 — aprobada con límites**: campos ficticios mínimos; RUC y documentos opcionales en TEST/DEMO; sin afirmaciones legales.
- Suspensión/desactivación (F025-RF23 de v3.1), asignación de dueños adicionales y uso productivo quedan fuera de la implementación hasta decisiones específicas. El plan puede preparar sus contratos futuros sin habilitarlos.
- F08 tiene 32/32 tareas técnicas marcadas y aceptación humana pendiente. Por la decisión expresa de priorizar F02.5, F08 queda en espera de esa revisión mientras F02.5 es la única funcionalidad activa en SDD. Sus cambios DEMO locales siguen sin versionar y no se modifican por esta especificación.

## Source traceability and approval gates

| Fuente | Regla documentada | Relación con F02.5 |
|---|---|---|
| Maestro v3.0 Parte A §§A2/A4; Parte B cap. 5 | Roadmap vigente; Farmacias gestiona alta, ubicación, contactos y estado. | F02.5 no altera la aceptación histórica. |
| Maestro v3.1 Parte A §A4 bis | Propone F025-RF01–RF28 y F025-AC01–AC12, estados y recorrido de cinco farmacias. | Fuente propuesta para F02.5, aún sin ratificación como maestro principal. |
| Maestro v3.0 Parte B caps. 4 y 12 | Plataforma administra farmacias; dueño solo su establecimiento; membresía expresa. | No define el permiso concreto de revisión ni el flujo de solicitudes. |
| Maestro v3.0 Parte B cap. 27, fila `usuario_farmacia` | «Solo la API autorizada, sin modificar membresías de terceros». | EXC-01 sigue íntegra; alta de DUENO por aprobación es una decisión nueva DEC-02, aprobada solo en TEST/DEMO. |
| Maestro v3.0 Parte B caps. 28–29; Constitution VIII | Contexto tenant por transacción, RLS, acceso cruzado denegado. | Condición obligatoria para datos y pruebas. |
| F01 GLO-01/BOOT-01 | Cinco permisos globales F01; bootstrap privilegiado solo TEST efímero y offline. | No incluyen aprobación de farmacias ni alta de dueños por HTTP. |
| F02–F08 | Importación, consultas públicas, reservas, notificaciones, GEO e interfaz en sus alcances aprobados. | Se reutilizan sin reescribir sus aceptaciones. |

**Puerta de implementación**: la aprobación humana de spec/plan y la inserción cronológica de F02.5 constan en [approval.md](approval.md) y Constitution 1.3.0. DEC-01–03 están aprobadas solo con los límites anteriores; F025-RF23 (suspensión), habilitación persistente/productiva y adopción normativa de v3.1 requieren aprobaciones separadas. Este documento no acredita pruebas, migraciones, aceptación ni operación persistente.
