# Tasks: F04.1 — Operación de reservas

**Input**: [spec.md](spec.md), [plan.md](plan.md), [data-model.md](data-model.md), [contracts/](contracts/), [research.md](research.md). Casilla `[X]` solo con evidencia real en `evidence.md`. T-final de aceptación: solo Andre.

## Lote 1 — Base (migración, RLS, dominio)

- [X] T001 Registrar aprobaciones y contrato: `approval.md` (spec ✔), añadir el modo `--f041-contract/--f041-routes` (3 operaciones) a `scripts/integration/check-openapi-routes.mjs` y los scripts `npm run verify:contracts:f041` (F041-FR-009; SC-004).
- [X] T002 [P] Dominio `backend/src/modules/reservas/domain/pickup-preference.ts`: validación pura de 30/60/120 y franjas (15–120 min dentro de `[ahora, ahora+plazo]`), mensajes claros; pruebas en `backend/tests/reservations/f041-pickup-preference.test.ts` con límites 1–8 h y 4 por defecto (F041-FR-006–008; SC-001).
- [X] T003 Migración `backend/migrations/f04/008_pickup_preference.sql` (tabla `preferencia_recogida`, RLS/FORCE, política de inserción atómica, índice de historial) y su registro en `migrate.ts`; prueba de migración/idempotencia en `backend/tests/reservations/migrations.test.ts` (F041-FR-009).
- [X] T004 Pruebas RLS Alfa/Beta de la tabla nueva en `backend/tests/reservations/f041-preference.rls.test.ts`: dueño ve la suya, personal con `reservation.read` ve las de su farmacia, otra farmacia y otro cliente no; sin `UPDATE`/`DELETE`; inserción solo del dueño con contexto; conexiones reutilizadas; worker sin acceso (F041-FR-009, FR-013; SC-003).

## Lote 2 — Preferencia de recogida (US3)

- [X] T005 Puertos y repositorio: `ReservationRow.pickupPreference`, inserción de la preferencia en la misma transacción que `reserve_stock`, lectura adjunta en `listOwn/findOwn/listPharmacy/create`; huella de idempotencia con preferencia, en `ports.ts` y `reservation-repository.ts` (F041-FR-006–007, FR-010).
- [X] T006 Caso de uso `CreateReservation` con preferencia opcional validada contra el plazo de la farmacia; ruta `POST /reservas` acepta `pickupPreference` (422 si inválida) en `create-reservation.ts` y `customer-reservations-router.ts`; pruebas HTTP en `backend/tests/reservations/f041-customer.http.test.ts` (F041-FR-006, FR-008).
- [X] T007 Pruebas de integración `backend/tests/reservations/f041-us3.rls.test.ts`: con y sin preferencia el stock comprometido es idéntico; al confirmar, `recogida_expira_en = confirmación + plazo` y **no cambia** ni con otra preferencia ni al cambiar la configuración después; rollback total si la preferencia falla; reintento idempotente (mismo resultado) y con otra preferencia → conflicto; concurrencia 100/10 con y sin preferencia = 10 PENDIENTES (F041-FR-007, FR-010–011; SC-001, SC-004).
- [X] T008 [P] Interfaz del cliente: selector de preferencia en `CreateReservation.jsx` (30/60/120, franja, o ninguna; texto «no es una cita») y muestra en `OwnReservations.jsx`; cliente HTTP en `reservations-client.js`; pruebas en `frontend/tests/reservations/f041-preference.test.jsx` (F041-FR-006, FR-012).

## Lote 3 — Centro de atención, historial y exportación (US1–US2)

- [X] T009 Repositorio y caso de uso `AttentionCenter` (instantánea con filtros, historial con cursor, exportación) con SQL parametrizado, límite 100/5000 y unión al catálogo para el nombre; `attention-center.ts` y `reservation-repository.ts` (F041-FR-001, FR-003–005).
- [X] T010 [P] Utilidades de exportación CSV con neutralización de fórmulas y BOM en `backend/src/modules/reservas/domain/csv-export.ts`; pruebas en `f041-csv-export.test.ts` (F041-FR-005; SC-006).
- [X] T011 Rutas `GET …/reservas/centro`, `…/historial`, `…/historial/exportar` en `pharmacy-reservations-router.ts` (autorización `reservation.read`, validación de filtros/cursor, `Cache-Control: no-store`, sin tocar las rutas existentes) y montaje en `identity-app.ts`; pruebas HTTP en `f041-pharmacy.http.test.ts` y `npm run verify:contracts:f041` (F041-FR-001–005, FR-012).
- [X] T012 Pruebas `backend/tests/reservations/f041-us1-us2.rls.test.ts`: cola y filtros solo de la farmacia propia (Alfa/Beta, conexión única reutilizada); historial paginado sin duplicados ni huecos; CSV solo de la farmacia propia y sin columnas del cliente; sin permiso → 403, otra farmacia → 404; ninguna lectura cambia estado ni inventario (F041-FR-009, FR-013; SC-002–003).
- [X] T013 [P] Interfaz de la farmacia: `AttentionCenter` con sondeo de 30 s (pausa con pestaña oculta, espera creciente, reanudación), fusión por `id` y descarte de instantáneas viejas; filtros; pestaña «Historial» con «Cargar más» y «Descargar CSV» en `PharmacyReservations.jsx`, `polling.js` y el cliente; pruebas en `frontend/tests/reservations/f041-center.test.jsx` incluida la simulación de corte de red (F041-FR-002, FR-012; SC-002).

## Lote 4 — No regresión y cierre

- [X] T014 Regresión: `npm run check`, `build`, `verify:contracts`, F04 (`unit`, `api`, `rls`), F01, F02, F03, F05 y frontend, con resultados reales en `evidence.md`; registrar los archivos nuevos en `scripts/f04/check.mjs` (F041-FR-010–011; SC-004).
- [X] T015 E2E Playwright Linux en fixture efímero propio (`frontend/e2e/f041-reservations.spec.js`, `scripts/f041/*`): reserva con preferencia, confirmación, cola con actualización sola, historial y CSV, aislamiento Alfa/Beta (SC-001–003, SC-005).
- [X] T016 [P] Medición breve: tiempo de la instantánea y de la exportación con 5000 filas ficticias en TEST; registrar sin inventar umbrales (plan).
- [X] T017 DEMO manual en TEST con Alfa/Beta ficticias y guía `demo-guide.md` (SC-005).
- [X] T018 Trazabilidad (`traceability.md`) y *analyze*/*converge* (`convergence.md`), corrigiendo contradicciones (todas las FR).
- [X] T019 Preparar `acceptance.md` y solicitar la aceptación humana; **nunca autoaprobar**; registrar la decisión solo cuando Andre responda.

## Dependencias

Lote 1 → 2 → 3 → 4. Paralelos `[P]` dentro de su lote. T007 depende de T003–T006; T012 de T009–T011; T015 de T014.

## Cobertura

| Requisito | Tareas |
|---|---|
| F041-FR-001, 002, 003 | T009, T011, T013 |
| F041-FR-004, 005 | T009–T012 |
| F041-FR-006, 007, 008 | T002, T005–T008 |
| F041-FR-009 | T001, T003, T004, T012 |
| F041-FR-010, 011 | T005, T007, T014 |
| F041-FR-012 | T008, T011, T013 |
| F041-FR-013 | T002, T004, T007, T012 |
| F041-FR-014 | T014 (revisión de alcance) |
| SC-001…006 | T002, T007, T012, T013, T014, T015 |

## Notas de ejecución (2026-11-24)

T001–T018 marcadas con evidencia real en [evidence.md](evidence.md). **T019 sin marcar:** [acceptance.md](acceptance.md) está preparado; la decisión es solo de Andre. Desviaciones: las pruebas RLS de T004, T007 y T012 se reunieron en un solo archivo, `f041-ops.rls.test.ts` (comparten fixture y el guardia exige el clúster F02.5); T006/T011 en `f041-http.test.ts` y T010 en la misma suite; las rutas devuelven **403** (no 404) ante farmacia ajena, igual que el resto de F04; se conservó el comportamiento de F08 de mostrar acciones aun en reservas vencidas (decide el servidor); T015 usa un fixture propio (`scripts/f041/`) que se crea y elimina por corrida; T016: `scripts/f041/harness.mjs measure`.
