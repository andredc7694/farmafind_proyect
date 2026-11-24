# F04.1 — Evidencia (resultados reales)

Fecha: 2026-11-24 · Rama `feat/f041-operacion-reservas`. Nada de esto equivale a aceptación.

| Tarea | Resultado real |
|---|---|
| T001 contrato | `npm run verify:contracts:f041`: 3/3 operaciones con ruta; `verify:contracts`: 41 operaciones sin cambios |
| T002 dominio | `f041-pickup-preference.test.ts`: 17 casos (30/60/120, franjas 15–120 min, plazos 1–8 h con 4 por defecto, rechazos con mensaje claro) |
| T003 migración | `008_pickup_preference.sql` aplicada e idempotente (segunda ejecución = 0 archivos) en TEST efímero |
| T004 RLS de la tabla | `f041-ops.rls.test.ts`: RLS+FORCE, sin UPDATE/DELETE para el rol de aplicación ni acceso del worker; la ve su dueño y la farmacia con `reservation.read`; no otro cliente ni otra farmacia; inserciones ajenas → 42501 |
| T005–T007 preferencia | Con/sin preferencia el stock comprometido es idéntico (3 reservas × 2); confirmación a las 15:10 → vence 19:10 (4 h) en las tres; cambiar el plazo a 8 h después no altera las ya confirmadas y la nueva vence a las 23:10; preferencia fuera del plazo (1 h vs 120 min) → rechazo sin reserva; fallo de CHECK al insertar → rollback total (misma cantidad de reservas y stock); idempotencia: mismo resultado y conflicto con otra preferencia; **AC05: 100 solicitudes concurrentes (con/sin preferencia) sobre 10 unidades → exactamente 10** |
| T008 UI cliente | `f041-center.test.jsx`: selector, aviso «no es una cita», franja inválida bloqueada, Mis reservas |
| T009–T012 centro/historial/export | cola solo de la farmacia propia con **una sola conexión reutilizada** (3 rondas Alfa/Beta), cliente y farmacia ajena rechazados, filtros, **leer no muta nada** (estado antes = después); historial por cursor sin duplicados ni huecos (coincide con las canceladas de la base); CSV solo de la farmacia propia, sin ids/correos del cliente |
| T010 CSV | neutralización de `= + - @ tab CR`, escape de comillas/comas/saltos, BOM |
| T011 rutas HTTP | `f041-http.test.ts`: sesión, filtros estrictos (400), `no-store`, cabeceras seguras del CSV, 422 con mensaje de preferencia |
| T013 UI farmacia | sondeo 30 s sin duplicados, descarte de instantáneas viejas, espera 30→60→120 s tras fallos, pausa con pestaña oculta, reconexión; el sondeo nunca confirma/entrega por sí solo; historial con «Cargar más» y descarga |

## T014 Regresión (resultados reales)

| Comprobación | Resultado |
|---|---|
| F04 unit / api / rls | **48/48** · **22/22** · **26/26** (rls incluye las 18 pruebas previas de F04 en el clúster F02.5) |
| F01 unit / api / rls | 114/114 · 128/128 · 135/135 |
| F02 unit / rls | 15/15 · 15/15 |
| F03 unit / rls | 25/25 · 4/4 |
| F05 unit / api | 8/8 · 5/5 |
| Frontend completo (sin Playwright) | 38 archivos, **147/147** (antes 134) |
| `npm run check` / `build` / `verify:contracts` | correctos (261 archivos JS; 41 operaciones) |
| No reejecutado | `f05:rls` (su guardia exige otra base; sin cambios en F05; la persistente está vedada) |

Hallazgo corregido: 2 pruebas heredadas de F08 (`frontend/tests/f08/reservations.test.jsx`) fallaron porque el centro cambió el texto del estado y ocultaba acciones en reservas vencidas; se restauró el comportamiento anterior (la interfaz no decide, rechaza el servidor) en lugar de cambiar esas pruebas.

## T015 E2E (Playwright Linux, Chromium, fixture propio)

**4/4**: reserva con preferencia de 60 min, la farmacia la ve **sin tocar nada** (sondeo), confirmar fija el vencimiento exacto de confirmación + 4 h y la preferencia se conserva; corte de red con aviso, segunda reserva creada mientras tanto y convergencia sin duplicados ni acciones automáticas; entregar y cancelar, historial con filtros y CSV descargado (cabecera, estados, sin correos del cliente, 2 filas); aislamiento Alfa/Beta (cola, historial y exportación → 403 para otra farmacia y para un cliente). Las primeras corridas fallaron por datos del fixture (nombre normalizado del medicamento) y por un selector ambiguo del propio spec; se corrigió el spec/fixture, no el producto.

## T016 Medición (TEST local, 5000 reservas cerradas + 200 pendientes, 7 repeticiones)

| Operación | mín | mediana | máx | tamaño |
|---|---|---|---|---|
| instantánea de la cola (200 pendientes) | 30 ms | 34 ms | 60 ms | 45 KiB |
| historial, página de 25 | 23 ms | 26 ms | 38 ms | 7 KiB |
| historial, página de 100 | 23 ms | 25 ms | 49 ms | 28 KiB |
| exportación CSV (5000 filas) | 225 ms | 235 ms | 310 ms | 513 KiB |

Sin umbrales definidos: valores medidos en este equipo.

## T017 DEMO
Fixture efímero preparado; API y web encendidas; guía en [demo-guide.md](demo-guide.md). Revisión humana pendiente.

## Hallazgos para analyze/converge
- La interfaz de la cola muestra el estado en texto original (PENDIENTE/CONFIRMADA) para no cambiar F08.
- El exportador excluye al cliente por diseño (D-02 = A); si Andre quiere nombre del cliente, es un cambio acotado en `exportCsv` y su prueba.
- El sondeo es por consulta (D-03 = A): hasta 30 s de retraso en ver reservas nuevas.
