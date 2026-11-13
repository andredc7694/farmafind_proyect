# Feature Specification: F04 — Reservas y concurrencia

**Feature Branch**: `feat/f04-reservas`

**Created**: 2026-11-13

**Status**: Especificación aprobada expresamente el 2026-11-13, incluida la decisión F04-TIME-01; planificación e implementación autorizadas en modo autónomo controlado.

**Input**: Continuar la secuencia actualizada del capítulo 33 del Documento Maestro Definitivo v2.0. F04 cubre HU03–HU04 y RF05–RF09: creación y consulta de reservas, compromiso concurrente, máquina de estados, cancelación, expiración, confirmación física, entrega, autorización por farmacia y registro transaccional de eventos Outbox. El procesamiento y envío de notificaciones pertenece a F05.

## Clarifications

### Session 2026-11-13

- Q: ¿Cuál será el plazo de recogida de una reserva CONFIRMADA? → A: **F04-TIME-01** sustituye la propuesta histórica no ratificada de 24 horas: cada farmacia puede configurar entre 1 y 8 horas con permiso explícito; el valor predeterminado es 4 horas; el plazo comienza al confirmar y el vencimiento exacto queda fijado en la reserva aunque la configuración cambie después.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Solicitar una reserva sin sobreasignar stock (Priority: P1)

Como cliente autenticado quiero reservar temporalmente una cantidad disponible de un medicamento en una farmacia activa, para esperar la comprobación física del establecimiento antes de desplazarme.

**Why this priority**: HU03 y RF05–RF06 definen el valor central de F04 y exigen consistencia frente a solicitudes concurrentes.

**Independent Test**: Con una identidad ficticia vigente, una farmacia activa y diez unidades digitales disponibles, solicitudes válidas crean reservas PENDIENTES y comprometen como máximo diez unidades; cualquier fallo deja reserva, compromiso y evento sin cambios parciales.

**Acceptance Scenarios**:

1. **Given** un cliente autenticado, una oferta vigente de una farmacia activa y cantidad disponible suficiente, **When** solicita una reserva, **Then** se crea una PENDIENTE propia con vencimiento de respuesta, se compromete la cantidad y se registra un evento Outbox en una sola operación indivisible.
2. **Given** disponibilidad digital insuficiente o una farmacia desactivada, **When** el cliente solicita una reserva, **Then** se rechaza sin crear reserva, compromiso ni evento parcial.
3. **Given** la misma solicitud reenviada con la misma identidad de idempotencia, **When** se procesa más de una vez, **Then** produce un único resultado lógico y no duplica reserva, compromiso ni evento.
4. **Given** diez unidades disponibles y cien solicitudes concurrentes válidas e independientes de una unidad, **When** se procesan, **Then** existen exactamente diez nuevas PENDIENTES, diez unidades comprometidas y cero sobreasignación o stock negativo.

---

### User Story 2 - Consultar y cancelar reservas propias (Priority: P1)

Como cliente autenticado quiero consultar el estado y vencimiento de mis reservas y cancelar una reserva vigente, para conocer su situación y liberar unidades que ya no recogeré.

**Why this priority**: RF07–RF08 exigen propiedad del recurso, visibilidad del plazo y liberación única.

**Independent Test**: Dos clientes ficticios consultan sus propias reservas; ninguno obtiene datos del otro. El propietario cancela una PENDIENTE o CONFIRMADA vigente y los reintentos concurrentes liberan el compromiso exactamente una vez.

**Acceptance Scenarios**:

1. **Given** un cliente con reservas en distintos estados, **When** consulta su listado o detalle, **Then** solo recibe sus reservas y ve estado y fecha de expiración aplicable.
2. **Given** un identificador perteneciente a otra persona, **When** el cliente intenta consultarlo o cancelarlo, **Then** no obtiene datos privados ni altera la reserva.
3. **Given** una PENDIENTE o CONFIRMADA vigente propia, **When** el cliente la cancela, **Then** pasa a CANCELADA y el compromiso se libera una sola vez junto con el evento correspondiente.
4. **Given** una reserva ENTREGADA, CANCELADA o EXPIRADA, **When** se intenta cancelar o cambiar nuevamente, **Then** el estado, inventario y eventos lógicos permanecen sin duplicación.

---

### User Story 3 - Confirmar físicamente una reserva autorizada (Priority: P1)

Como dueño, administrador o personal expresamente delegado de una farmacia quiero revisar sus reservas PENDIENTES y confirmar solo las que verifiqué físicamente, para informar al cliente que puede recoger el producto.

**Why this priority**: HU04 y RF09 separan el compromiso digital de la existencia física y requieren autorización por establecimiento.

**Independent Test**: En dos farmacias ficticias, un actor autorizado de Alfa confirma una PENDIENTE vigente de Alfa después de la comprobación física; personal sin delegación y cualquier actor de Beta son denegados. La falta física ejecuta la cancelación especial sin inconsistencias.

**Acceptance Scenarios**:

1. **Given** una PENDIENTE vigente de Alfa y un dueño o administrador de Alfa con permiso efectivo, **When** registra que comprobó físicamente el producto, **Then** la reserva pasa a CONFIRMADA y recibe un vencimiento de recogida configurable.
2. **Given** personal de Alfa con delegación expresa vigente para aceptar reservas, **When** confirma una PENDIENTE vigente de Alfa tras la comprobación física, **Then** obtiene el mismo resultado autorizado sin adquirir otros privilegios.
3. **Given** personal sin delegación, una membresía revocada, un actor de Beta o un identificador de farmacia manipulado, **When** intenta confirmar una reserva de Alfa, **Then** la operación se deniega sin revelar ni modificar datos de Alfa.
4. **Given** que el producto no existe físicamente al revisar una PENDIENTE, **When** el actor autorizado registra `STOCK_FISICO_INSUFICIENTE`, **Then** la reserva se cancela y la liberación única, incidencia, movimiento y alerta Outbox se confirman juntas; queda solicitada la conciliación del inventario.
5. **Given** una farmacia y un actor con permiso explícito para configurar su plazo de recogida, **When** establece un valor entero entre 1 y 8 horas, **Then** las confirmaciones posteriores usan ese valor; valores fuera del rango, actores sin permiso y farmacias ajenas son rechazados sin cambiar la configuración.

---

### User Story 4 - Registrar la entrega autorizada (Priority: P1)

Como personal autorizado de una farmacia quiero registrar la entrega de una reserva CONFIRMADA y vigente, para cerrar su ciclo y mantener consistente el inventario.

**Why this priority**: HU04 y RF09 establecen ENTREGADA como cierre exitoso y prohíben entregar estados no vigentes.

**Independent Test**: Una CONFIRMADA vigente se entrega una vez por personal autorizado de su farmacia; la transacción descuenta cantidad física y comprometida exactamente una vez. Reintentos y estados terminales no vuelven a consumir inventario.

**Acceptance Scenarios**:

1. **Given** una CONFIRMADA vigente y personal autorizado de la misma farmacia, **When** registra la entrega, **Then** pasa a ENTREGADA y se descuentan una vez la cantidad física registrada y la comprometida junto con su evento Outbox.
2. **Given** una PENDIENTE, CANCELADA, EXPIRADA, ENTREGADA o CONFIRMADA vencida, **When** se intenta registrar entrega, **Then** se rechaza sin consumir ni liberar nuevamente inventario.
3. **Given** dos entregas concurrentes o un reintento de la misma entrega, **When** se procesan, **Then** solo una puede producir la transición y el consumo de inventario.
4. **Given** un actor sin permiso, de otra farmacia o con sesión/membresía no vigente, **When** intenta entregar, **Then** se deniega sin filtrar datos ni alterar estado, inventario u Outbox.

---

### User Story 5 - Expirar reservas vencidas de forma segura (Priority: P1)

Como sistema quiero expirar PENDIENTES y CONFIRMADAS que superaron su plazo, para liberar compromisos sin intervención manual ni duplicaciones.

**Why this priority**: RF07 exige vencimientos automáticos y la consistencia depende de que cancelación, expiración y entrega compitan de forma segura.

**Independent Test**: Un proceso autorizado expira reservas ficticias vencidas; una reserva aún vigente no cambia y la competencia con cancelar, confirmar o entregar produce una única transición válida y un único efecto de inventario.

**Acceptance Scenarios**:

1. **Given** una PENDIENTE cuyo plazo configurable de respuesta terminó, **When** se procesa el vencimiento, **Then** pasa a EXPIRADA y libera el compromiso una sola vez.
2. **Given** una CONFIRMADA cuyo plazo de recogida terminó sin entrega, **When** se procesa el vencimiento, **Then** pasa a EXPIRADA y libera el compromiso una sola vez.
3. **Given** una reserva todavía vigente o terminal, **When** se ejecuta el proceso, **Then** no cambia su estado ni duplica efectos.
4. **Given** expiración y otra transición válida concurrentes, **When** compiten, **Then** solo una transición se confirma y el inventario, la reserva y el Outbox permanecen consistentes.

### Edge Cases

- La disponibilidad pública consultada antes puede quedar obsoleta; la creación siempre revalida la fuente oficial y nunca confía en Redis para comprometer stock.
- Una sesión, membresía, delegación o farmacia puede revocarse entre lectura y escritura; la autorización se revalida dentro de la operación.
- Un usuario puede pertenecer a Alfa y Beta; el contexto seleccionado no transfiere permisos ni reservas entre farmacias.
- Una cantidad cero, negativa, no entera, excesiva respecto de la disponibilidad o una presentación distinta se rechaza sin cambios parciales.
- Un cambio de configuración posterior no modifica el vencimiento exacto almacenado en reservas ya confirmadas.
- Confirmación, cancelación, expiración y entrega simultáneas sobre la misma reserva producen una sola transición válida.
- Un fallo del servicio independiente de Notificaciones no revierte una reserva confirmada en PostgreSQL; el evento permanece pendiente para F05.
- La reserva PENDIENTE compromete disponibilidad digital, pero no garantiza existencia física hasta la comprobación del establecimiento.

## Requirements *(mandatory)*

### Functional Requirements

- **F04-FR-001**: Solo un cliente con identidad y sesión vigentes DEBE poder crear una reserva; la identidad propietaria DEBE provenir del contexto autenticado y no del cuerpo de la solicitud.
- **F04-FR-002**: La creación DEBE aceptar una referencia, farmacia activa y cantidad entera positiva, y DEBE revalidar en la fuente oficial que la disponibilidad digital de esa presentación sea suficiente.
- **F04-FR-003**: Comprometer inventario, crear la reserva PENDIENTE y registrar su evento Outbox DEBEN confirmarse en una sola transacción mediante Unit of Work.
- **F04-FR-004**: Cualquier fallo en validación, autorización, concurrencia, persistencia o registro Outbox DEBE revertir íntegramente la creación sin reserva, compromiso o evento parcial.
- **F04-FR-005**: La creación y las transiciones mutables DEBEN admitir idempotencia de solicitud para impedir duplicación lógica por reintentos; una clave no DEBE reutilizarse para una operación materialmente distinta.
- **F04-FR-006**: Una PENDIENTE DEBE conservar un vencimiento de respuesta configurable, con valor inicial documentado de 20 minutos, sin convertir ese plazo en garantía de confirmación física.
- **F04-FR-007**: Cada cliente DEBE poder listar y consultar exclusivamente sus reservas, con estado y vencimiento aplicable, sin acceder a reservas de otra persona por conocer su identificador.
- **F04-FR-008**: El cliente propietario DEBE poder cancelar una PENDIENTE o CONFIRMADA vigente; CANCELADA es terminal y los reintentos no DEBEN repetir liberaciones ni eventos lógicos.
- **F04-FR-009**: El sistema DEBE expirar automáticamente PENDIENTES que superen el plazo de respuesta y CONFIRMADAS que superen el plazo de recogida sin entrega.
- **F04-FR-010**: Cancelación y expiración DEBEN liberar la cantidad comprometida exactamente una vez y registrar la transición y su evento Outbox en la misma transacción.
- **F04-FR-011**: Las únicas transiciones permitidas DEBEN ser `PENDIENTE → CONFIRMADA | CANCELADA | EXPIRADA` y `CONFIRMADA → ENTREGADA | CANCELADA | EXPIRADA`; ENTREGADA, CANCELADA y EXPIRADA DEBEN ser terminales.
- **F04-FR-012**: La consulta y atención por farmacia DEBEN exigir identidad, sesión, farmacia activa, membresía vigente, recurso perteneciente a esa farmacia y permiso efectivo; conocer o enviar un `farmacia_id` NO DEBE conceder acceso.
- **F04-FR-013**: Solo el dueño, administrador o personal con delegación expresa vigente para aceptar reservas DEBE poder pasar una PENDIENTE vigente a CONFIRMADA después de registrar la comprobación física. El rol `TRABAJADOR` por sí solo NO DEBE conceder esta capacidad.
- **F04-FR-014**: Cada farmacia DEBE tener un plazo de recogida configurable en horas enteras entre 1 y 8, con valor predeterminado de 4 horas. Solo un actor con identidad, sesión, membresía, farmacia y permiso explícito vigentes DEBE poder modificar la configuración de su propia farmacia; valores fuera del rango y cambios cruzados DEBEN rechazarse.
- **F04-FR-015**: Si falta existencia física al atender una PENDIENTE, el actor autorizado DEBE cancelarla con motivo `STOCK_FISICO_INSUFICIENTE`; cancelación, liberación única, incidencia, movimiento y alerta Outbox DEBEN confirmarse juntas y requerir conciliación posterior.
- **F04-FR-016**: Solo personal autorizado de la farmacia DEBE poder entregar una CONFIRMADA vigente; la entrega DEBE pasarla a ENTREGADA y descontar una vez la cantidad física registrada y la comprometida en una transacción.
- **F04-FR-017**: Una farmacia desactivada NO DEBE recibir reservas nuevas; su desactivación NO DEBE borrar ni alterar silenciosamente las reservas existentes, que continuarán sujetas a sus transiciones autorizadas.
- **F04-FR-018**: PostgreSQL DEBE ser la fuente oficial de reserva e inventario. Redis y los resultados públicos de F03 NO DEBEN confirmar disponibilidad, crear reservas, decidir transiciones ni participar en la transacción.
- **F04-FR-019**: Las reservas, inventario privado, incidencias y Outbox sujetos a farmacia DEBEN conservar aislamiento multi-tenant y RLS para lectura y escritura, con contexto autorizado local a la transacción y rol runtime sin `BYPASSRLS`.
- **F04-FR-020**: Cada creación y transición confirmada DEBE registrar un evento Outbox mínimo, correlacionable y libre de secretos dentro de PostgreSQL. F04 NO DEBE publicar ni enviar el evento; esa ejecución pertenece a F05.
- **F04-FR-021**: La indisponibilidad de Notificaciones NO DEBE impedir crear o transicionar una reserva; el evento confirmado DEBE permanecer pendiente sin prometer entrega externa exactamente una vez.
- **F04-FR-022**: La interfaz DEBE permitir crear, listar, consultar y cancelar reservas propias, y permitir al personal autorizado revisar, confirmar, cancelar por falta física y entregar las de su farmacia, con estados y errores comprensibles en español; el navegador NO DEBE decidir permisos.
- **F04-FR-023**: Las pruebas DEBEN cubrir transiciones válidas e inválidas, propiedad del cliente, autorización y delegación, aislamiento Alfa/Beta, ausencia de contexto, conexiones reutilizadas, reintentos, rollback, RLS real y competencia entre crear, confirmar, cancelar, expirar y entregar.
- **F04-FR-024**: La prueba de concurrencia AC05 DEBE ejecutar cien solicitudes válidas e independientes de una unidad sobre diez unidades disponibles y obtener exactamente diez PENDIENTES, diez unidades comprometidas, cero disponibilidad y ninguna sobreasignación.
- **F04-FR-025**: F04 NO DEBE implementar pagos, procesamiento o envío de notificaciones, privilegios globales, alta inicial privilegiada, administración de inventario ajeno, búsqueda, FarmaFind AI ni rediseño visual.
- **F04-FR-026**: Al confirmar una reserva, el sistema DEBE calcular y conservar su fecha y hora exactas de vencimiento desde ese instante usando la configuración vigente de la farmacia. Cambios posteriores de configuración NO DEBEN alterar reservas ya confirmadas; una CONFIRMADA vencida DEBE pasar a EXPIRADA y NO DEBE poder entregarse.

### Key Entities *(include if feature involves data)*

- **Reserva**: solicitud de un cliente sobre una referencia y farmacia, con cantidad, propietario, estado, vencimientos, motivo de cierre, versión de concurrencia y correlación.
- **Compromiso de inventario**: cantidad reservada digitalmente que reduce la disponibilidad sin alterar todavía la cantidad física registrada.
- **Transición de reserva**: cambio autorizado e idempotente entre estados, con actor o proceso, momento, motivo y efecto único sobre inventario.
- **Delegación de aceptación**: capacidad expresa y vigente vinculada a la membresía de una farmacia; no equivale al rol general ni se transfiere a otra farmacia.
- **Evento Outbox**: registro mínimo creado en la misma transacción de la reserva para procesamiento posterior por F05.
- **Incidencia de falta física**: evidencia de discrepancia al comprobar una PENDIENTE, vinculada a cancelación, movimiento y conciliación requerida.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **F04-SC-001**: En el escenario AC05 de cien solicitudes concurrentes de una unidad y diez unidades disponibles, se crean exactamente diez PENDIENTES distintas, con diez unidades comprometidas, cero disponibilidad y ningún valor negativo.
- **F04-SC-002**: El 100 % de las transiciones válidas del conjunto de aceptación produce el estado y efecto de inventario esperados; el 100 % de transiciones inválidas o repetidas deja estado e inventario sin efectos adicionales.
- **F04-SC-003**: El 100 % de cancelaciones, expiraciones y entregas concurrentes del conjunto definido libera o consume el compromiso exactamente una vez y conserva un único evento lógico por transición.
- **F04-SC-004**: El 100 % de intentos definidos para leer o modificar reservas ajenas, de otra farmacia, sin contexto, sin permiso o sin delegación se deniega sin filtrar datos ni cambiar reservas, inventario u Outbox.
- **F04-SC-005**: El 100 % de fallos inducidos antes del compromiso transaccional deja cero escrituras parciales; una falla posterior del servicio de Notificaciones no revierte los datos ya confirmados.
- **F04-SC-006**: En todos los casos de `STOCK_FISICO_INSUFICIENTE` del conjunto de aceptación quedan correlacionadas una cancelación terminal, una liberación única, una incidencia, un movimiento y una alerta Outbox, sin ajuste automático que oculte la discrepancia.
- **F04-SC-007**: Los recorridos de cliente y farmacia definidos en US1–US5 se completan desde la interfaz en español con datos ficticios y las mismas decisiones de autorización que la API; su aprobación exige pruebas ejecutadas y revisión humana.
- **F04-SC-008**: Cada reserva y transición del conjunto de aceptación puede correlacionarse con su resultado, evento y evidencia de prueba sin exponer credenciales, datos personales reales ni información de otra farmacia.
- **F04-SC-009**: El 100 % de configuraciones autorizadas con valores enteros de 1 a 8 horas se acepta y afecta solo confirmaciones posteriores; el 100 % de valores fuera del rango y cambios no autorizados se rechaza, el valor predeterminado observado es 4 horas y ninguna reserva confirmada cambia su vencimiento por una modificación posterior.

## Assumptions

- F04 reutiliza la identidad, sesiones, membresías, selección de farmacia y delegaciones de F01, el catálogo e inventario privado de F02 y las referencias públicas de F03. No reabre sus requisitos ni declara aceptados sus pendientes.
- El plazo inicial de respuesta PENDIENTE es configurable y está documentado en 20 minutos. F04-TIME-01 fija para CONFIRMADA un rango configurable de 1 a 8 horas, valor predeterminado de 4 horas y vencimiento inmutable por reserva desde la confirmación.
- La delegación expresa para aceptar reservas ya está prevista por F01, pero debe representarse como capacidad específica de la membresía y verificarse con casos positivos y negativos; `TRABAJADOR` no recibe esa capacidad por defecto.
- Los fixtures y pruebas usarán exclusivamente personas, farmacias, inventarios y reservas ficticios en bases aisladas. No se ejecutarán GLO-01 ni BOOT-01.
- El registro Outbox forma parte de la atomicidad de F04. La publicación, reintentos, deduplicación del consumidor y proveedores de mensajes corresponden a F05 y no son condición para confirmar una transacción F04.
- F03 permanece publicada con sus 58 tareas cerradas y verificaciones automatizadas registradas, pero su aceptación humana sigue pendiente; F04 no cambia esa situación.

## Source Traceability and Scope Gates

| Fuente | Correspondencia F04 | Estado |
|---|---|---|
| Documento Maestro Definitivo v2.0, capítulos 2, 4, 7–8, 12–15 y 27–29 | HU03–HU04; RF05–RF09; transiciones, plazos, UoW, concurrencia, autorización, RLS y escenarios E2E/AC04/AC05. | Requisitos documentados; su propuesta no ratificada de 24 horas fue sustituida por F04-TIME-01 mediante aprobación humana del 2026-11-13. |
| Documento Maestro v2.0, capítulo 33 | F04 Reservas: transacciones, máquina de estados, recepción y delegación; terminado por no sobreasignación, autorización e idempotencia. F05 procesa Notificaciones. | Secuencia actualizada adoptada para esta especificación. |
| Constitution v1.1.0, principios VII–X, XIII–XVIII y restricciones | PostgreSQL oficial, RLS, UoW/Outbox, estados terminales, plazos, seguridad, pruebas y aprobación SDD. | Normativa ratificada, sin modificación. |
| Histórico `PROYEC_FARMAFIND` commit `56d3ef9`, HU03–HU04, RF05–RF09, AC04–AC09, RC y ADR | Reserva temporal, propiedad, comprobación física, entrega, liberación única, Clean Architecture, UoW y Outbox. | Fuente histórica leída; sus diseños siguen siendo propuestas hasta el plan aprobado. |
| F01/F02/F03 aprobados | Identidad y tenant, delegación específica, inventario comprometido y consulta pública referencial. GLO-01/BOOT-01 continúan bloqueados. | Dependencias existentes; F04 no amplía privilegios ni altera sus pendientes. |
| Rúbrica oficial de 16 criterios | F04 aporta trazabilidad directa a criterios 1–7, 9, 12–14 y 16 mediante requisitos, arquitectura posterior, API/UI, seguridad, concurrencia y evidencias; los demás conservan seguimiento transversal. | No se asignan puntajes ni se inventan evidencias. |

La especificación y F04-TIME-01 fueron aprobadas expresamente el 2026-11-13. La misma autorización permite generar plan, tareas e implementación de F04, sin aprobar por anticipado resultados de pruebas, despliegues ni recursos externos.
