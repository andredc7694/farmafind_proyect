# Feature Specification: F04.1 — Operación de reservas

**Feature Branch**: `feat/f041-operacion-reservas`
**Created**: 2026-11-24
**Status**: Borrador pendiente de aprobación de Andre (Puerta 3). Spec Kit: *specify* hecho; *clarify* con 3 decisiones abiertas.
**Input**: Documento Maestro v3.2 MEJ-013 y MEJ-014 (HU21–HU22; RF34–RF36; AC14–AC15); roadmap v3.2, orden 4. Conserva ADR-F04-SEC-001 y F04-TIME-01 (vencimiento fijo de 1–8 h, 4 por defecto, desde la confirmación).

## Decisiones abiertas (se resuelven en *clarify*, después de aprobar esta spec)

- **D-01 · Franjas «dentro de horario»**: hoy FarmaFind no guarda el horario de atención de las farmacias. ¿Qué significa «dentro de horario»? Se propone (A) sin horario semanal: la preferencia solo debe caber antes del vencimiento de la reserva; (B) añadir un horario semanal opcional por farmacia; (C) postergar las franjas y dejar solo 30/60/120 min.
- **D-02 · Exportación del historial**: formato y alcance. Se propone (A) CSV del historial de la farmacia activa con filtros de estado y fechas, sin datos personales del cliente más allá de un código de reserva; (B) CSV con nombre del cliente; (C) sin exportación en este incremento.
- **D-03 · Actualización automática del centro de atención**: se propone (A) consulta periódica cada 30 s que tolera cortes de red, sin duplicar ni mutar reservas; (B) eventos en tiempo real (más complejo, fuera de lo ya aprobado); (C) solo botón «Actualizar».

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Centro de atención con actualización automática (Priority: P1)

Como propietario o trabajador autorizado quiero ver la cola de reservas de mi farmacia que se actualiza sola, con filtros por estado, para atender sin recargar la página.

**Why this priority**: Es el núcleo de MEJ-013; una cola desactualizada hace perder reservas por vencimiento.
**Independent Test**: Con Alfa y Beta ficticias, se crean reservas; el personal de Alfa ve las suyas aparecer solas, nunca las de Beta, y tras un corte de red la lista se recupera sin duplicados.

**Acceptance Scenarios**:

1. **Given** personal con permiso de ver reservas, **When** abre el centro de atención, **Then** ve las reservas de su farmacia agrupadas por estado y con el tiempo que falta para su vencimiento.
2. **Given** una reserva nueva, **When** pasa el intervalo de actualización, **Then** aparece sin recargar y sin duplicarse.
3. **Given** un corte de red, **When** vuelve la conexión, **Then** la lista se sincroniza con el estado real, sin repetir ni perder reservas y sin ejecutar ninguna acción por su cuenta.
4. **Given** personal de Alfa, **When** pide reservas de Beta (manipulando identificadores), **Then** se deniega sin revelar nada.
5. **Given** un filtro de estado o de fechas, **When** se aplica, **Then** solo se muestran las reservas que cumplen, dentro de la farmacia autorizada.

---

### User Story 2 - Historial y exportación de la farmacia (Priority: P2)

Como propietario quiero consultar el historial de reservas cerradas (entregadas, canceladas, expiradas) y exportarlo, para llevar mi control.

**Why this priority**: Completa MEJ-013 (RF35) pero no bloquea la atención diaria.
**Independent Test**: El propietario de Alfa exporta su historial y el archivo contiene solo reservas de Alfa; el de Beta, solo las suyas; un trabajador sin permiso no puede exportar.

**Acceptance Scenarios**:

1. **Given** personal con permiso de historial, **When** exporta con un rango de fechas, **Then** obtiene solo reservas de su farmacia en ese rango, con los campos definidos en *clarify*.
2. **Given** alguien sin permiso o de otra farmacia, **When** intenta exportar, **Then** se deniega (403/404) sin datos.
3. **Given** una exportación, **When** se genera, **Then** no cambia ningún estado ni inventario y no incluye secretos.

---

### User Story 3 - Preferencia de recogida del cliente (Priority: P1)

Como cliente quiero indicar cuándo creo poder recoger (en unos 30, 60 o 120 minutos, o en una franja válida), para que la farmacia se organice, sabiendo que esto no es una cita ni cambia el vencimiento.

**Why this priority**: Es el núcleo de MEJ-014 (RF36) y toca la regla delicada F04-TIME-01.
**Independent Test**: El cliente reserva con preferencia de 60 min; al confirmarse, el vencimiento se calcula como siempre (1–8 h, 4 por defecto) y no cambia; la farmacia ve la preferencia como orientación.

**Acceptance Scenarios**:

1. **Given** una reserva nueva, **When** el cliente elige 30, 60 o 120 minutos (o una franja válida), **Then** la preferencia se guarda como dato opcional y se muestra a la farmacia como «preferencia estimada, no es una cita».
2. **Given** una preferencia que excede el plazo de recogida configurado de la farmacia, **When** se envía, **Then** se rechaza con mensaje claro (o se acota, según *clarify*).
3. **Given** una reserva confirmada con preferencia, **When** cambia después la configuración o la preferencia, **Then** el vencimiento exacto de la reserva (`recogida_expira_en`) no se recalcula ni se amplía.
4. **Given** una reserva sin preferencia, **When** se crea, **Then** todo funciona exactamente como en F04.
5. **Given** cien solicitudes concurrentes sobre diez unidades, **When** llevan o no preferencia, **Then** se mantienen exactamente diez PENDIENTES y diez unidades comprometidas.

---

### User Story 4 - Atención sin cambiar las reglas de F04 (Priority: P1)

Como farmacia quiero que entregar, cancelar y expirar sigan funcionando igual de seguro, incluso con la actualización automática y las preferencias nuevas.

**Why this priority**: Es la garantía de no regresión (AC14–AC15).
**Independent Test**: La regresión completa de F04 y los casos nuevos pasan: transiciones, liberación única de stock y Outbox idempotente.

**Acceptance Scenarios**:

1. **Given** el centro de atención, **When** se entrega, cancela o expira una reserva, **Then** el efecto sobre inventario y Outbox ocurre exactamente una vez, como en F04.
2. **Given** reintentos o actualizaciones repetidas de la lista, **When** se ejecutan, **Then** no se produce ninguna acción ni evento duplicado.

---

### Edge Cases

- Reserva que vence mientras el personal tiene la lista abierta: la lista la muestra vencida al sincronizar y bloquea acciones sobre ella.
- Reconexión tras largo corte: se carga el estado completo vigente, sin duplicados.
- Exportación grande: tope de filas definido en *plan*; se informa si se trunca.
- Preferencia en reservas ya existentes (creadas antes de F04.1): quedan sin preferencia.
- Personal con membresía revocada mientras la lista está abierta: la siguiente consulta se deniega.
- Cliente que cancela mientras la farmacia confirma: gana la primera transición válida (concurrencia de F04, sin cambios).

## Requirements *(mandatory)*

### Functional Requirements

- **F041-FR-001**: El centro de atención DEBE mostrar la cola de reservas de la farmacia activa con estado, cantidad, medicamento, preferencia (si existe) y tiempo restante, solo a personal con permiso de ver reservas.
- **F041-FR-002**: La lista DEBE actualizarse automáticamente según la decisión D-03, sin duplicar reservas, sin ejecutar acciones y recuperándose tras cortes de red.
- **F041-FR-003**: La lista DEBE admitir filtros por estado y rango de fechas, siempre dentro de la farmacia autorizada.
- **F041-FR-004**: DEBE existir historial de reservas cerradas de la farmacia, paginado, solo para personal autorizado.
- **F041-FR-005**: Según D-02, el personal autorizado DEBE poder exportar el historial de su farmacia; la exportación NO DEBE mutar estados ni inventario y NO DEBE incluir secretos ni datos de otra farmacia.
- **F041-FR-006**: El cliente PODRÁ indicar al crear la reserva una preferencia de recogida opcional (30, 60 o 120 minutos, o franja según D-01); si no la indica, la reserva se comporta como en F04.
- **F041-FR-007**: La preferencia NO DEBE ampliar, recalcular ni sustituir el vencimiento de recogida de F04-TIME-01, NO DEBE prometer cita y DEBE mostrarse como orientación.
- **F041-FR-008**: Una preferencia que no cabe en el plazo de recogida de la farmacia o fuera de horario (según D-01) DEBE rechazarse de forma clara.
- **F041-FR-009**: Cualquier campo nuevo DEBE conservar `farmacia_id` y RLS; leer o exportar DEBE usar el contexto autorizado local a la transacción y el rol runtime sin `BYPASSRLS`.
- **F041-FR-010**: Entrega, cancelación y expiración, la liberación única de stock, la idempotencia y el Outbox de F04 DEBEN conservarse sin cambios; la preferencia no participa en la decisión de ninguna transición.
- **F041-FR-011**: La concurrencia 10/100 de F04 DEBE seguir pasando con y sin preferencia.
- **F041-FR-012**: La interfaz DEBE estar en español sencillo, con estados de carga y error claros, y el personal sin permiso no debe ver las acciones.
- **F041-FR-013**: Las pruebas DEBEN cubrir aislamiento Alfa/Beta, ausencia de contexto, conexiones reutilizadas, reconexión sin duplicados, exportación solo de la farmacia propia, límites de preferencia (30/60/120, 1–8 h, 4 por defecto), vencimiento fijo, cancelación/expiración y concurrencia.
- **F041-FR-014**: F04.1 NO DEBE implementar pagos, notificaciones externas, nuevos privilegios globales ni cambios en búsqueda pública o inventario; solo TEST efímero con datos ficticios.

### Key Entities

- **Reserva** (existente): se le añade, de forma opcional, una *preferencia de recogida*; el vencimiento exacto permanece intacto.
- **Preferencia de recogida**: orientación opcional del cliente (minutos o franja); no es cita ni compromiso.
- **Vista de historial / exportación**: lectura de reservas cerradas de una farmacia, con filtros.

## Success Criteria *(mandatory)*

- **F041-SC-001**: En el 100 % de los casos, una preferencia no cambia el vencimiento exacto de ninguna reserva (comparación antes/después).
- **F041-SC-002**: Tras un corte de red simulado, la lista converge al estado real con cero duplicados y cero acciones automáticas.
- **F041-SC-003**: La exportación de Alfa contiene cero filas de Beta y viceversa; el 100 % de intentos sin permiso se deniegan.
- **F041-SC-004**: La regresión completa de F04 (incluida la concurrencia 10/100 con y sin preferencia) pasa sin cambios de comportamiento.
- **F041-SC-005**: Un trabajador autorizado completa el recorrido «ver cola → confirmar → entregar» desde la interfaz con datos ficticios sin recargar manualmente.
- **F041-SC-006**: Ningún archivo exportado, registro ni respuesta contiene secretos.

## Assumptions

- Se reutilizan identidad, membresías y permisos de F01/F01.1 (`reservation.read`, `reservation.accept`, `reservation.deliver`, `reservation.settings`) y las reglas de F04; no se reabren.
- No existe hoy un horario de atención por farmacia (ver D-01).
- Alcance TEST/DEMO local; ninguna base persistente ni proveedor externo.

## Trazabilidad

| Origen | Requisitos |
|---|---|
| MEJ-013, HU21, RF34–RF35, AC10, AC14 | F041-FR-001–005, 009, 012; SC-002, SC-003, SC-005 |
| MEJ-014, HU22, RF36, AC14, AC15 | F041-FR-006–008; SC-001 |
| F04, ADR-F04-SEC-001, F04-TIME-01 | F041-FR-009–011, 013–014; SC-004, SC-006 |
