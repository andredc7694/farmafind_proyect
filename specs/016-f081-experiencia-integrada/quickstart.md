# Quickstart — F08.1 (verificación local)

1. Node 24.17, rama `feat/f081-experiencia-integrada`, spec/plan/tasks aprobados en `approval.md`.
2. Encender `farmafind-f01-postgres` (y `farmafind-f025-postgres` solo para `f04:rls`; ambos usan el puerto 55431, uno a la vez). Redis TEST (`compose.f03-search.yaml`) para las pruebas de F03 con caché. Nunca `farmafind_f01_test`.
3. Capas (PowerShell): `node scripts/f04/check.mjs …`, `scripts/f03/check.mjs …`, `scripts/f01/check.mjs …`, frontend `node node_modules/vitest/vitest.mjs run frontend/tests/ --exclude "**/*.spec.js"`, `npm run check`, `npm run build`, `npm run verify:contracts`, `npm run verify:contracts:f081`.
4. E2E al final: `node scripts/f081/run-browser-linux.mjs` (fixture propio que se elimina).
5. DEMO: `node scripts/f081/harness.mjs prepare|serve|drop` y `demo-guide.md`.

| Recorrido | Qué debe ocurrir |
|---|---|
| Visitante | Menú público mínimo; buscar con sugerencias, filtros plegables, lista/mapa; chat flotante; tema que se recuerda. |
| Cliente | Su menú y sus reservas; nada de paneles de farmacia. |
| Trabajador | Solo las tareas de sus permisos, sin Personal ni Configuración. |
| Propietario | Resumen, Farmacia y ubicación, Inventario, Importar, Reservas, Historial, Personal, Configuración en ese orden. |
| Revisor | Revisión de ubicaciones/solicitudes si tiene la capacidad. |
| Rutas directas | Sin permiso → el servidor deniega, aunque el menú las ocultara. |
