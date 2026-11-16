# F05 — Evidencia de implementación

**Fecha:** 2026-11-14. **Estado:** cierre técnico provisional; revisión humana pendiente.

F05 implementa el publicador posterior al commit sobre `f04.outbox_evento`, el contrato
interno autenticado y el servicio independiente de Notificaciones con una entrega local
persistente. La decisión aprobada F05-DEC-01 A no envía mensajes ni define destinatarios.

## Resultado implementado

- Migraciones F05 aditivas, idempotentes y limitadas a TEST local.
- Roles `f05_outbox_publisher` y `f05_notifications_runtime` `NOLOGIN`, `NOSUPERUSER` y
  `NOBYPASSRLS`; tablas F05 con `FORCE ROW LEVEL SECURITY` y contexto tenant transaccional.
- Reclamo con lease y `SKIP LOCKED`, orden por reserva, recuperación de lease y backoff
  acotado a 12 intentos.
- `POST /internal/v1/events` con HMAC-SHA256, ventana anti-replay de cinco minutos,
  contrato estricto de 16 KiB, deduplicación por identidad/huella y conflicto auditable.
- Registro local determinista e idempotente. No hay correo, SMS, push, AWS ni proveedor.
- Métricas retornadas por ejecución: pendientes, intentos acumulados, edad del evento más
  antiguo, reclamados, publicados, reintentos, bloqueados y latencias.

## Comprobaciones reales

| Comando | Resultado observado |
|---|---|
| `npm run test:f05:unit` | 4 archivos, 8 pruebas pasadas. |
| `npm run test:f05:api` | 1 archivo, 5 pruebas pasadas: 202, 200, 401, 409, 413, 422 y `/health`. |
| `npm run test:f05:recovery` | 1 prueba pasada: cinco minutos controlados de caída, conservación y recuperación única. |
| `npm run test:f05:rls` | 1 archivo, 4 pruebas PostgreSQL reales pasadas. La suite crea y elimina solo una base efímera. |
| ejecución RLS con consola técnica | 100 eventos con dos publicadores en 15.1 ms; entrega local p95 10.4 ms y p99 11.8 ms. Son medidas locales, no SLO de producción. |
| `npm run build` | Backend y Notificaciones TypeScript, más frontend Vite de 46 módulos, sin errores. |
| `npm run check` | 93 archivos JS, TypeScript estricto y límites modulares correctos. |
| `npm run test:base` | 63 archivos pasados, 14 condicionados; 241 pruebas pasadas y 80 omitidas por servicios no inyectados en esa ejecución. |
| regresiones con servicios reales | F01 RLS 45, F02 RLS 14, F03 Redis 3, F03 RLS 4 y F04 RLS 16: todas pasadas. |
| `npm audit --audit-level=low` | 0 vulnerabilidades conocidas. |
| `git diff --check` y barrido de secretos | Sin errores de whitespace ni patrones de credenciales; `.cache`, `docs/referencias`, `node_modules` y `dist` permanecen ignorados. |

La suma consolidada sin contar repeticiones dirigidas es de **327 pruebas pasadas**: 241
en la suite base y 86 comprobaciones de PostgreSQL/Redis ejecutadas con sus servicios.
Los 80 `skip` de la suite base no se convierten en aprobados; las suites de servicio
aplicables se ejecutaron expresamente después.

## Seguridad y recuperación observadas

La prueba PostgreSQL usa Alfa/Beta ficticias y confirma que el runtime ve únicamente el
tenant configurado, que conocer identificadores no amplía permisos y que F05 no puede
actualizar Reservas. Cien reenvíos idénticos producen una sola entrega; una huella distinta
produce un conflicto persistente. Una caída simulada conserva Reserva y Outbox en la base
real durante cinco minutos de reloj controlado y publica al recuperarse. Dos publicadores
no reclaman dos veces el mismo conjunto y un lease abandonado vuelve a ser visible.

## Límites del cierre

No se desplegó HTTPS, AWS ni un proveedor. HTTPS interno sigue siendo obligación para el
despliegue futuro. No se ejecutó una entrega a personas. F04 y F05 conservan revisión humana
pendiente; este documento no cambia el estado de aceptación de F00–F04 ni asigna puntajes.
