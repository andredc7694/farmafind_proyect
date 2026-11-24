# Quickstart — F04.1 (verificación local)

1. Node 24.17, rama `feat/f041-operacion-reservas`, spec/plan/tasks aprobados en `approval.md`.
2. Encender el contenedor TEST del clúster F02.5 (`farmafind-f025-postgres`, lo exigen las pruebas RLS de F04) y, para F01, `farmafind-f01-postgres`. Nunca `farmafind_f01_test`.
3. Pruebas por capas (PowerShell): `node scripts/f04/check.mjs unit|api|rls` (incluyen las nuevas `f041-*`), `npm run check`, `npm run build`, `npm run verify:contracts`, `node scripts/integration/check-openapi-routes.mjs --f041-routes`.
4. Regresión: F01 (`scripts/f01/check.mjs`), F02, F03, F05.
5. E2E al final: `node scripts/f041/run-browser-linux.mjs` (fixture efímero propio que se elimina al terminar).
6. DEMO manual: `node scripts/f041/harness.mjs prepare|serve|drop` y la guía `demo-guide.md`.
7. Al terminar: apagar contenedores y eliminar el fixture propio.

| Recorrido | Qué debe ocurrir |
|---|---|
| Cliente reserva con preferencia de 60 min | Reserva PENDIENTE con «preferencia estimada»; stock comprometido igual que sin preferencia. |
| Farmacia confirma | Vence en el plazo configurado desde la confirmación; la preferencia no cambia ese instante. |
| Cola con actualización automática | Una reserva nueva aparece sola; tras un corte de red no hay duplicados. |
| Historial y CSV | Solo reservas de la farmacia activa; el CSV no tiene datos del cliente. |
| Alfa vs Beta | Cero datos cruzados en cola, historial y exportación. |
