# F04 — Evidencia de implementacion

## Alcance y gates

- F04-TIME-01 aplicada: 1–8 horas, default 4, snapshot inmutable al confirmar.
- PENDIENTE vence a los 20 minutos por configuracion validada.
- F05 solo recibe Outbox futuro; no se publican notificaciones.
- GLO-01, BOOT-01, pagos, AWS e IA siguen fuera del incremento.

## Resultados reales — 2026-11-13 y 2026-11-14

| Control | Resultado |
|---|---|
| `npm run test:f04:unit` | 8 archivos, 17 pruebas satisfactorias. |
| `npm run test:f04:api` | 2 archivos, 6 pruebas de contrato satisfactorias. |
| `npm run test:f04:rls` | 2 archivos, 16 pruebas PostgreSQL/RLS satisfactorias. |
| `npm run test:f04:load` | AC05 final: 10/100 exitos, p95 472.9 ms, p99 477.6 ms, total 487.0 ms. |
| `npm run build` | Backend, frontend y Notificaciones compilan; Vite transformo 46 modulos. |
| `npm run test:base` | 57 archivos y 228 pruebas pasaron; 13 archivos/76 pruebas condicionadas se omitieron. |
| `npm audit --audit-level=low` | 0 vulnerabilidades. |
| `npm run test:f04:e2e:linux` | Playwright 1.65.0 en `mcr.microsoft.com/playwright:v1.65.0-noble`: 1 recorrido, 1 satisfactorio, 4.5 s (2026-11-14). |

Las pruebas PostgreSQL crean una base TEST aislada con sufijo aleatorio, aplican F01/F02/F04,
usan login runtime sin SUPERUSER/BYPASSRLS y la eliminan al terminar. La base persistente no se modifica.

## Seguridad y concurrencia demostradas

- Propietario solo consulta/cancela sus reservas; conocer `farmacia_id` no concede autoridad.
- Farmacia exige sesion, membresia y farmacia activas, rol elegible y capacidad exacta.
- Sesion revocada pierde acceso de inmediato; TRABAJADOR sin delegacion no obtiene autoridad.
- Reserva, compromiso, historial, incidencia y Outbox comparten transaccion.
- Reintentos de crear, cancelar, entregar y expirar no duplican efectos.
- Carreras de cancelacion/expiracion dejan una unica transicion terminal.
- Worker NOLOGIN/NOSUPERUSER/NOBYPASSRLS solo expira lotes vencidos y no configura farmacias.
- Cambiar 4→8 no altera CONFIRMADAS existentes.
- El recorrido Linux verifica en React creacion, consulta, confirmacion, vencimiento visible, entrega y cancelacion con API simulada y datos ficticios. No sustituye las 16 pruebas PostgreSQL/RLS reales que verifican autoridad, persistencia y aislamiento.

## Pendiente obligatorio

- Revision humana final de F04.
- El resultado local no equivale a aceptacion definitiva de F04.
