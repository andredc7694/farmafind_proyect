# Implementation Plan: F05 — Notificaciones mediante Transactional Outbox

**Branch**: `feat/f05-notificaciones` | **Date**: 2026-11-14 | **Spec**: [spec.md](spec.md)

## Summary

Extender el proceso independiente `notifications` de F00 para recibir eventos F04 por un
contrato REST interno autenticado, deduplicarlos en PostgreSQL y producir una entrega local
determinista aprobada. Un publicador separado reclama eventos Outbox confirmados después del
commit, los envía con garantía al menos una vez y solo entonces marca `publicado_en`.
No se integra correo, SMS, push, proveedor externo, AWS ni interfaz nueva.

## Technical Context

**Runtime**: Node.js 24.17.0, npm 11.13.0, TypeScript, JavaScript/JSX sin cambios
**Primary dependencies**: Express 5.2.1, `pg`, Node `crypto`; no se añade dependencia
**Storage**: PostgreSQL 18.6 local; esquemas existentes F01/F02/F04 y nuevo esquema `f05`
**Testing**: Vitest, Supertest, PostgreSQL real en Docker, reloj/HTTP inyectables
**Target platform**: Windows 10; Docker Desktop local para PostgreSQL; futuro Lightsail privado
**Project type**: monolito modular API + proceso independiente Notificaciones
**Performance goal**: 100 eventos ficticios sin pérdida ni duplicado lógico; métricas p95/p99
**Constraints**: sin proveedor, PII, AWS, Redis, GLO-01, BOOT-01 o cambios F00–F04
**Scale**: lote local configurable de 25, reintentos acotados y dos publicadores concurrentes

## Constitution Check

| Gate | Aplicación F05 | Estado |
|---|---|---|
| I SDD | spec aprobada, plan, tareas, análisis, pruebas y evidencia | PASS |
| VI Clean Architecture | dominio/puertos sin Express, PostgreSQL o HTTP | PASS |
| VII PostgreSQL oficial | recepción, deduplicación, intentos y entrega local durables | PASS |
| VIII tenant/RLS | roles worker explícitos, FORCE RLS y pruebas Alfa/Beta | PASS |
| X Outbox/Notificaciones | posterior al commit, independiente, autenticado, reintentos | PASS |
| XI–XII AWS | compatibilidad futura; cero recursos o gastos | PASS |
| XIII pruebas | unitarias, contrato, integración, seguridad, caída/recuperación y carga | PASS |
| XIV evidencias | 16 criterios trazados sin inventar resultados | PASS |
| XVI–XVIII flujo | rama F05, una feature, alcance aprobado antes del código | PASS |
| XX privacidad | fixtures ficticios, secretos locales ignorados | PASS |

No hay excepción constitucional. La opción A de F05-DEC-01 fue aprobada el 2026-11-14.

## Design decisions

### Contrato y autenticación interna

- `POST /internal/v1/events` recibe JSON versionado y limitado a 16 KiB.
- Cabeceras: identificador, timestamp UTC y firma HMAC-SHA256 sobre método, ruta, timestamp,
  identificador y hash del cuerpo. La clave solo existe en configuración local ignorada.
- Ventana anti-replay configurable de cinco minutos. HTTPS es obligatorio al desplegar;
  local usa loopback/red privada y mantiene firma.

### Publicador Outbox

- Worker del backend con rol `f05_outbox_publisher` NOLOGIN/NOSUPERUSER/NOBYPASSRLS.
- Reclamo transaccional por `FOR UPDATE SKIP LOCKED`, lease de 30 segundos y lote 25.
- Orden por `creado_en,id`; una reserva no reclama un evento mientras tenga uno anterior pendiente.
- Éxito durable del consumidor marca `publicado_en`; timeout/5xx libera o vence el lease y
  programa reintento exponencial configurable, base 1 s, máximo 60 s, 12 intentos.
- 4xx permanente o agotamiento queda `BLOQUEADO`, persistido y observable; no se elimina.

### Consumidor y entrega aprobada

- El servicio valida firma y contrato antes de persistir.
- `f05.recepcion_evento` usa `evento_id` único y huella SHA-256; mismo evento/huella es
  idempotente, misma identidad/otra huella es conflicto.
- El adaptador local escribe `f05.entrega_local` una sola vez por evento. Este registro es
  evidencia técnica, no un mensaje a una persona.
- No consulta ni modifica Reserva o Inventario. El payload mínimo F04 contiene solo
  `reservationId` y `state`; farmacia/tipo/correlación viajan en el sobre.

### Migraciones y roles

- Migración F05 aditiva amplía `f04.outbox_evento` con lease, próximo intento, último error
  minimizado y estado; crea esquema/tablas F05, índices, constraints, roles y políticas.
- `f05_notifications_runtime` solo inserta/consulta sus tablas mediante políticas explícitas.
- El propietario de tablas no es ninguno de los roles runtime; todas las tablas tenant usan
  ENABLE/FORCE RLS. No se conceden permisos sobre reservas o inventario.

## Project Structure

```text
backend/
  migrations/f05/
  src/modules/notificaciones/
    domain/
    application/
    infrastructure/
  tests/notifications/
notifications/
  src/events/
  tests/
scripts/f05/
specs/006-f05-notificaciones/
  contracts/
```

El publicador vive en el backend porque accede al Outbox del monolito. La recepción y entrega
local viven exclusivamente en el proceso `notifications`. Los contratos compartidos son
tipos mínimos copiados desde OpenAPI/JSON Schema; no se introduce un workspace nuevo.

## Validation strategy

1. Unitarias: firma, huella, validación, backoff, clasificador de fallos e idempotencia.
2. HTTP: 202 nuevo, 200 reintento idéntico, 401 firma, 409 huella, 413 tamaño, 422 contrato.
3. PostgreSQL real: migración repetible, roles, RLS Alfa/Beta, reclamo concurrente, lease
   abandonado, orden por reserva, éxito y bloqueo persistente.
4. Integración: F04 confirma aunque Notificaciones esté caída; reloj simula cinco minutos;
   recuperación completa sin pérdida ni duplicado local.
5. Carga local: 100 eventos y dos publicadores; contar Outbox, recepciones y entregas.
6. Regresión: build y suites F00–F04; omisiones condicionadas se documentan.

## Complexity Tracking

No existen violaciones que requieran excepción. El proceso independiente ya está aprobado y
no fragmenta el núcleo. La entrega local evita dependencias, costos y decisiones de canal.

## Post-design Constitution Check

PASS. El diseño mantiene PostgreSQL como autoridad, llamadas fuera de la transacción F04,
entrega al menos una vez con deduplicación, seguridad tenant, mínimo privilegio y evidencia real.
