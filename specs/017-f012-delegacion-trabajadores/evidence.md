# F01.2 — Evidencia (resultados reales, 2026-11-24)
Cambios: migraciones `f02/006_worker_delegation.sql` y `f04/009_worker_delegation.sql` (`CREATE OR REPLACE`, solo se añade `TRABAJADOR` al rol elegible; se mantiene sesión vigente, usuario/membresía/farmacia activos, misma farmacia y delegación ACTIVA de la capacidad exacta); `canUseInventory` y `authorizeReservationContext` equivalentes. Sin cambios en gestión de personal, plataforma ni RLS por farmacia. Sin tocar `farmafind_f01_test`.

- Unitarias actualizadas (trabajador con/sin delegación, revocada, rol desconocido): verdes.
- Nueva matriz RLS `backend/tests/reservations/f012-worker-delegation.rls.test.ts` (6 pruebas, conexión única Alfa/Beta): lectura de resúmenes y aceptar reserva con delegación; solo lectura no acepta; sin delegación, revocada, membresía suspendida, sesión cerrada, farmacia inactiva y otra farmacia denegadas; revocar corta en la petición siguiente; no escalada (`can_manage_local_worker`, `membership.manage`, `platform.admin` falsos para el trabajador aunque exista la fila).
- Prueba heredada F08.1 `f081-summary.rls`: la expectativa «trabajador denegado» pasó a «trabajador con reservation.read lee» (cambio exigido por FR-001).
- Regresión: F01 unit 114, api 128, rls 142 · F02 unit 15, rls 15 · F03 33/3/9 · F04 unit 48, api 25, rls 37 (+6) · F05 8/5 · F06.1 85/15 · f021-rls 3 · frontend 208 · check, build, contratos OK.
- E2E F08.1 actualizado (trabajador ve cifras de Alfa; 200 propias, 403 en Beta y en personal): **7/7**.
- No reejecutado: `f05:rls` (base marcada).
