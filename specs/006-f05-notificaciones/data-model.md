# Data Model: F05 — Notificaciones

## Extensión `f04.outbox_evento`

| Campo | Regla |
|---|---|
| `estado_publicacion` | PENDIENTE, REINTENTO, PUBLICADO o BLOQUEADO |
| `reclamo_id`, `reclamado_hasta` | lease opcional y recuperable |
| `proximo_intento_en` | UTC; null cuando publicado/bloqueado |
| `intentos` | existente, no negativo; aumenta por envío |
| `ultimo_error_codigo` | código técnico limitado, nunca mensaje sensible |
| `publicado_en` | solo después de aceptación durable |

La identidad, farmacia, reserva, tipo, payload y correlación existentes permanecen inmutables.

## `f05.recepcion_evento`

| Campo | Regla |
|---|---|
| `evento_id` | PK, corresponde a Outbox |
| `farmacia_id` | tenant obligatorio |
| `tipo`, `version` | lista y versión autorizadas |
| `huella` | SHA-256 del sobre canónico |
| `correlacion_id` | UUID |
| `estado` | RECIBIDO, ENTREGADO o FALLIDO |
| `recibido_en`, `actualizado_en` | UTC |

Misma identidad+huella retorna resultado previo; misma identidad+otra huella es conflicto.

## `f05.intento_entrega`

Identificador, evento, número secuencial, inicio/fin, resultado EXITO/FALLO, código de error
limitado y latencia. Unicidad evento+número; no contiene cuerpos ni secretos.

## `f05.entrega_local`

`evento_id` PK, farmacia, tipo, estado de reserva derivado del payload permitido, correlación
y fecha. Es la evidencia determinista aprobada; no representa envío a una persona.

## State transitions

`PENDIENTE → REINTENTO | PUBLICADO | BLOQUEADO`; `REINTENTO → REINTENTO | PUBLICADO |
BLOQUEADO`. PUBLICADO y BLOQUEADO son terminales para el worker automático. La intervención
manual futura no forma parte de F05.
