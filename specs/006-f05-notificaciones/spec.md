# Feature Specification: F05 — Notificaciones mediante Transactional Outbox

**Feature Branch**: `feat/f05-notificaciones`

**Created**: 2026-11-14

**Status**: Approved — F05-DEC-01 opción A aprobada el 2026-11-14

**Input**: Continuar el orden funcional del Documento Maestro Definitivo v2.0 con el
servicio independiente de Notificaciones preparado en F00 y los eventos Outbox confirmados
por F04. El alcance conserva HU06, DA05, DA08 y AC06–AC09 sin escoger un canal o proveedor
externo que las fuentes no hayan autorizado.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Publicar eventos confirmados sin bloquear Reservas (Priority: P1)

Como responsable operativo, necesito que cada evento Outbox confirmado de F04 pueda
transferirse al servicio independiente de Notificaciones después del commit, para que una
caída de ese servicio nunca revierta ni impida una reserva válida.

**Why this priority**: Es la garantía arquitectónica central de Unit of Work + Outbox.

**Independent Test**: Confirmar eventos ficticios en PostgreSQL, detener Notificaciones y
demostrar que las reservas permanecen confirmadas y los eventos pendientes; restablecer el
servicio y comprobar que el publicador los transfiere sin pérdida.

**Acceptance Scenarios**:

1. **Given** una reserva y su evento confirmados, **When** Notificaciones está disponible,
   **Then** el publicador envía el evento después del commit mediante el contrato interno autenticado.
2. **Given** Notificaciones no disponible, **When** se confirma una reserva o transición,
   **Then** la operación F04 termina normalmente y el evento permanece pendiente.
3. **Given** un evento todavía no confirmado o una transacción revertida, **When** el
   publicador consulta pendientes, **Then** no publica datos inexistentes o no confirmados.

---

### User Story 2 - Procesar cada evento lógico de forma idempotente (Priority: P1)

Como responsable de confiabilidad, necesito que Notificaciones acepte reintentos del mismo
evento sin producir entregas lógicas duplicadas.

**Why this priority**: La red y los procesos pueden repetir solicitudes; la Constitución
prohíbe prometer exactamente una vez sin garantías verificadas.

**Independent Test**: Enviar dos o más veces el mismo identificador y comprobar un único
registro lógico procesado, con respuestas estables y correlacionables.

**Acceptance Scenarios**:

1. **Given** un identificador nuevo y contrato válido, **When** Notificaciones lo recibe,
   **Then** valida, persiste la deduplicación y procesa una única entrega lógica.
2. **Given** el mismo evento ya procesado, **When** llega de nuevo, **Then** responde de
   forma idempotente sin repetir el efecto.
3. **Given** el mismo identificador con contenido materialmente distinto, **When** llega,
   **Then** lo rechaza como conflicto sin sustituir el registro anterior.

---

### User Story 3 - Recuperar pendientes con reintentos controlados (Priority: P2)

Como operador, necesito que los fallos transitorios conserven los eventos y permitan
reintentos observables para recuperar el servicio sin perder eventos confirmados.

**Why this priority**: Implementa DA08 y el escenario E2E-06/AC06–AC08.

**Independent Test**: Inducir indisponibilidad durante cinco minutos en tiempo controlado,
restablecer el servicio y demostrar recuperación completa, sin duplicados lógicos.

**Acceptance Scenarios**:

1. **Given** un fallo transitorio, **When** vence el momento permitido para reintentar,
   **Then** el evento se intenta nuevamente y conserva conteo, último error minimizado y correlación.
2. **Given** el servicio recuperado, **When** se procesan pendientes, **Then** cada evento
   confirmado termina una sola vez en el destino aprobado por F05-DEC-01.
3. **Given** un fallo no recuperable o el límite aprobado agotado, **When** se evalúa el
   evento, **Then** queda visible para intervención y no se descarta silenciosamente.

---

### User Story 4 - Operar sin filtrar datos privados entre farmacias (Priority: P2)

Como responsable de seguridad, necesito que el transporte, la deduplicación y las métricas
usen contratos mínimos y no permitan consultar reservas o datos de otra farmacia.

**Why this priority**: Notificaciones es un proceso separado, pero sigue sujeto a mínimo
privilegio, privacidad y aislamiento multi-tenant.

**Independent Test**: Usar Alfa y Beta ficticias, eventos válidos e intentos cruzados o
manipulados; comprobar rechazo, payload mínimo y ausencia de secretos o datos personales en logs.

**Acceptance Scenarios**:

1. **Given** un evento válido de Alfa, **When** se procesa, **Then** su identidad,
   correlación y deduplicación no conceden acceso a datos de Beta.
2. **Given** una solicitud interna sin autenticación, firma/credencial inválida o contrato
   alterado, **When** llega al servicio, **Then** se rechaza sin producir efecto ni filtrar datos.
3. **Given** logs y métricas, **When** se inspeccionan, **Then** muestran estado técnico,
   intentos y latencia sin credenciales, contenido sensible ni datos personales reales.

### Edge Cases

- El publicador se detiene después de que Notificaciones procesa el evento pero antes de
  marcarlo publicado; el reintento debe ser idempotente.
- Dos instancias del publicador reclaman simultáneamente el mismo evento pendiente.
- Eventos distintos de la misma reserva conservan orden lógico suficiente para no presentar
  una transición anterior como posterior.
- El payload es inválido, demasiado grande, contiene tipo desconocido o campos no permitidos.
- Una reserva, farmacia o membresía cambia después del evento; Notificaciones no reescribe
  el hecho histórico ni adquiere autoridad para modificar Reserva o Inventario.
- PostgreSQL o el contrato interno no están disponibles; el servicio falla de forma visible
  y recuperable sin inventar una entrega.

## Requirements *(mandatory)*

### Functional Requirements

- **F05-FR-001**: F05 DEBE reutilizar el proceso independiente `notifications` preparado
  en F00; NO DEBE convertirlo en una ruta pública del monolito ni crear otro microservicio.
- **F05-FR-002**: El publicador DEBE seleccionar exclusivamente eventos F04 confirmados y
  pendientes después del commit; llamadas externas NO DEBEN entrar en la transacción de reserva.
- **F05-FR-003**: La caída o lentitud de Notificaciones NO DEBE fallar, revertir ni bloquear
  la creación o transición ya confirmada de una reserva.
- **F05-FR-004**: La comunicación API/publicador → Notificaciones DEBE usar un contrato
  HTTPS/REST interno autenticado en despliegue; localmente DEBE conservar el mismo límite
  contractual sin exponer el puerto fuera de loopback o red privada.
- **F05-FR-005**: El contrato DEBE incluir identificador persistente del evento, tipo,
  versión, fecha, correlación, farmacia y payload mínimo permitido, sin secretos.
- **F05-FR-006**: El servicio DEBE validar esquema, versión, tipo y límites del contrato y
  rechazar campos o tamaños no autorizados antes de producir efectos.
- **F05-FR-007**: El consumidor DEBE deduplicar persistentemente por identificador de evento
  y huella; un reintento idéntico NO DEBE repetir la entrega lógica.
- **F05-FR-008**: Reutilizar un identificador con contenido materialmente distinto DEBE
  producir conflicto auditable y ningún reemplazo.
- **F05-FR-009**: El publicador DEBE reclamar pendientes de forma segura para impedir trabajo
  concurrente duplicado y DEBE poder recuperar reclamos abandonados.
- **F05-FR-010**: Un evento solo DEBE marcarse publicado después de que Notificaciones
  confirme su aceptación durable; un fallo previo DEBE conservarlo pendiente.
- **F05-FR-011**: Los fallos transitorios DEBEN aplicar reintentos limitados y observables;
  sus intervalos, máximo y clasificación se justificarán en el plan tras aprobar F05-DEC-01.
- **F05-FR-012**: Los eventos que agoten el límite aprobado DEBEN permanecer persistidos,
  visibles y recuperables para intervención; NO DEBEN descartarse silenciosamente.
- **F05-FR-013**: F05 DEBE procesar los tipos F04 documentados
  `RESERVA_CREADA`, `RESERVA_CONFIRMADA`, `RESERVA_ENTREGADA`,
  `RESERVA_CANCELADA` y `RESERVA_EXPIRADA`; tipos desconocidos se rechazan.
- **F05-FR-014**: F05 NO DEBE modificar reservas, inventario, membresías, permisos ni
  transiciones; una notificación o recordatorio NO DEBE alterar stock.
- **F05-FR-015**: El acceso PostgreSQL del publicador y del consumidor DEBE usar roles
  mínimos sin `SUPERUSER` ni `BYPASSRLS`, políticas explícitas y datos limitados a su trabajo.
- **F05-FR-016**: Los datos tenant DEBEN conservar `farmacia_id` y correlación; conocer
  identificadores no DEBE conceder lectura transversal ni acceso a payloads ajenos.
- **F05-FR-017**: Logs, métricas y errores DEBEN excluir secretos, credenciales, hashes,
  datos personales reales y payloads privados innecesarios.
- **F05-FR-018**: Se DEBEN medir pendientes, intentos, edad del evento más antiguo, latencia,
  éxitos, fallos, conflictos de deduplicación y tiempo de recuperación.
- **F05-FR-019**: Las pruebas DEBEN cubrir contrato, autenticación interna, idempotencia,
  conflicto de huella, concurrencia de publicadores, caída de cinco minutos, recuperación,
  orden de eventos, roles mínimos y aislamiento Alfa/Beta con PostgreSQL real.
- **F05-FR-020**: Fixtures, evidencias y demostraciones DEBEN usar solo datos ficticios y
  archivos locales ignorados; no se usarán proveedores externos ni credenciales reales
  sin una autorización posterior explícita.
- **F05-FR-021**: F05 NO DEBE implementar pagos, AWS, SMS, correo, push, WhatsApp, proveedor
  externo, rediseño visual, IA ni funcionalidades F06+ mientras no exista aprobación expresa.
- **F05-FR-022**: El significado de una entrega completada y su destinatario/canal para el
  MVP DEBEN seguir la decisión F05-DEC-01; hasta aprobarla no se implementará el efecto final.

### F05-DEC-01 — Destino de entrega del MVP *(approved)*

Las fuentes obligan a publicar, conservar, reintentar y deduplicar, pero no definen canal,
proveedor, destinatario ni plantilla. El 2026-11-14 se aprobó expresamente:

- **A — Registro local determinista (aprobada)**: F05 completa el pipeline con un
  adaptador de entrega local persistente y auditable, sin enviar mensajes a personas. Permite
  demostrar caída/recuperación, idempotencia y seguridad sin costos ni datos personales.
  Correo/SMS/push quedan para una especificación posterior.
- **B — Notificación dentro de la aplicación (no aprobada)**: añade un buzón del usuario propietario y UI,
  ampliando frontend, autorización de lectura y retención.
- **C — Correo electrónico (no aprobada)**: envía al correo de la cuenta mediante un proveedor todavía
  por elegir; requiere consentimiento, plantillas, secretos, política de rebotes y aprobación
  del proveedor/costo antes de implementar.

### Key Entities

- **Evento Outbox F04**: hecho confirmado y pendiente que inicia el flujo posterior al commit.
- **Reclamo de publicación**: posesión temporal y recuperable de un evento por un publicador.
- **Recepción idempotente**: registro durable del identificador, huella, resultado y tiempos.
- **Intento de entrega**: ejecución correlacionada, resultado, clasificación de fallo y próximo intento.
- **Entrega**: efecto final definido exclusivamente por F05-DEC-01.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **F05-SC-001**: El 100 % de reservas/transiciones confirmadas durante una caída controlada
  de Notificaciones permanece confirmado y conserva exactamente un evento lógico pendiente.
- **F05-SC-002**: Tras cinco minutos de indisponibilidad controlada, el 100 % de eventos
  confirmados del conjunto se recupera sin pérdida y sin entregas lógicas duplicadas.
- **F05-SC-003**: Cien reenvíos del mismo evento válido producen una única recepción y una
  única entrega lógica; variantes con la misma identidad se rechazan como conflicto.
- **F05-SC-004**: Dos publicadores concurrentes procesan cada evento del conjunto una sola
  vez de forma lógica y recuperan reclamos interrumpidos sin dejar eventos invisibles.
- **F05-SC-005**: El 100 % de solicitudes internas sin autenticación o con contrato inválido,
  tipo desconocido, tenant cruzado o payload excesivo se rechaza sin efecto ni fuga.
- **F05-SC-006**: Todos los eventos y resultados de prueba son correlacionables con estado,
  intentos y latencia, sin secretos ni datos personales reales.
- **F05-SC-007**: El servicio conserva `/health` y puede iniciarse, detenerse y recuperarse
  independientemente de API y frontend.
- **F05-SC-008**: La suite F00–F04 permanece satisfactoria o registra explícitamente cualquier
  comprobación condicionada; ninguna aceptación humana pendiente se declara resuelta.

## Assumptions and dependencies

- F04 permanece técnicamente cerrada en `251419a`, con 65/65 tareas y revisión humana final pendiente.
- F05 consume el Outbox F04 existente y puede requerir migraciones aditivas para reclamos,
  recepción, intentos y métricas; no reescribe la historia de reservas.
- PostgreSQL sigue siendo la fuente oficial. Redis no participa en el pipeline F05.
- La autenticación interna exacta, parámetros de reintento y esquema de roles se decidirán
  en el plan, dentro de las obligaciones ya aprobadas y después de F05-DEC-01.
- La opción F05-DEC-01 A permite completar F05 sin proveedor externo, costo ni mensaje real;
  no se presentará como correo, SMS, push o entrega a una persona.

## Source traceability

- Documento Maestro v2.0: capítulos 5–6, 15 (E2E-06), 21 (E12), 26 y 32–36.
- Constitution v1.1.0: principios VI–VIII, X–XIV, XVII y XX; DA05, DA08, AC06–AC09.
- Historia conservada: HU06, RF y ADR históricas aplicables según la trazabilidad ratificada;
  esta especificación no reescribe su contenido.
- F00: proceso independiente y contrato técnico de salud de Notificaciones.
- F04: F04-FR-003/020/021, tipos y persistencia de `f04.outbox_evento`.
