# F02.5 — Modelo de datos propuesto (sin migraciones ejecutadas)

Los nombres son de planificación y deben contrastarse con migraciones existentes al implementar. PostgreSQL sigue siendo fuente oficial. Todos los identificadores son UUID, las fechas `timestamptz` y las escrituras de activación comparten una transacción.

| Entidad | Campos y restricciones propuestas | Acceso |
|---|---|---|
| `f025.solicitud` | id; solicitante_id FK F01; estado en siete valores; nombre_comercial 1–160; contacto y dirección mínimos ficticios; departamento/provincia/distrito; representante ficticio; ruc opcional TEST; version positiva; timestamps; farmacia_activada_id único/nullable. El identificador comercial normalizado sirve para detectar posibles duplicados, no prueba titularidad legal. | RLS: solicitante lee/edita solo su BORRADOR/OBSERVADA; revisor TEST con permiso específico lee/decide. Sin sesión, cero filas. |
| `f025.revision` | id; solicitud_id; actor_id; acción/estado anterior/nuevo; motivo acotado; versión anterior/nueva; correlación; fecha; append-only; unicidad de decisión efectiva por versión. | Solicitante ve solo resultado minimizado de su solicitud; revisor autorizado ve historial pertinente. |
| `f025.documento` | id; solicitud_id; ubicación privada TEST; tipo real permitido; tamaño, checksum, fecha y retención. Opcional y solo sintético. No incluir contenido en SQL, logs o Outbox. | RLS por solicitante o capacidad `F025_DOCUMENT_READ`; entrega autenticada, nunca URL pública. |
| `f025.platform_capability_grant` | actor_id; código cerrado F02.5; estado; expediente/huella de aprobación TEST; fecha; unicidad activa por actor/capacidad. | Sin rutas públicas de mutación; provisionado offline solo en base efímera, vinculado a asignación F01 global activa. |
| `f025.activacion` | solicitud_id único; farmacia_id único FK F01; membresia_dueno_id único FK F01; revisor_id; clave de idempotencia; correlación; fecha. | Solo lectura de auditoría autorizada; prueba material de una única activación. |
| `f025.farmacia_perfil` | farmacia_id PK/FK F01; contacto/dirección aprobados; versión; campos privados separados de proyección F03. | RLS por tenant para administración; público ve solo proyección depurada. |
| `f025.outbox_evento` | id; solicitud_id; tipo de cambio; payload mínimo sin documentos; correlación; fecha, estado, reintentos, deduplicación. | Solo escritor transaccional y worker F05 autorizado; no lectura pública. |

## Máquina de estados

| Origen | Destino | Actor y condición |
|---|---|---|
| BORRADOR | PENDIENTE | Solicitante titular, envío explícito y datos válidos. |
| PENDIENTE | EN_REVISION | Revisor con `F025_APPLICATION_REVIEW`; bloqueo de versión. |
| PENDIENTE / EN_REVISION / OBSERVADA | CANCELADA | Titular antes de decisión final, según versión; el revisor no activa. |
| EN_REVISION | OBSERVADA / RECHAZADA | Revisor con `F025_APPLICATION_DECIDE`, motivo obligatorio. |
| OBSERVADA | PENDIENTE | Titular corrige y reenvía, conserva historial. |
| EN_REVISION | APROBADA | Revisor con `F025_APPLICATION_DECIDE` **y** `F025_PHARMACY_ACTIVATE`; creación atómica. |
| APROBADA / RECHAZADA / CANCELADA | — | Terminal para esa solicitud; una nueva solicitud requiere ID nuevo y control de duplicados. |

## Integridad y concurrencia

- Bloquear la fila de solicitud durante decisión; comprobar `version`/estado e idempotency key. Índices únicos en activación por solicitud y farmacia, además de unicidad de membresía F01 por `(usuario_id,farmacia_id)`.
- Deduplicar posibles establecimientos por identificador disponible y nombre/dirección normalizados para revisión; nunca revelar si otra persona presentó una solicitud. No convertir un nombre parecido en identidad legal verificada.
- Una aprobación que falle al crear farmacia, perfil, DUENO, auditoría, proyección u Outbox revierte todo. Redis se invalida **después** del commit; un fallo de Redis no cambia el resultado confirmado.
- F01 `farmacia_referencia` y `usuario_farmacia` se reutilizan; no se crean tablas paralelas de identidad o tenant. F03 `farmacia_publica` es proyección limitada, no inventario privado. Las coordenadas públicas siguen el flujo de revisión F07, sin publicación automática.
- Todas las nuevas tablas privadas aplicables tendrán RLS y FORCE RLS; el rol de aplicación carece de SUPERUSER/BYPASSRLS. El diseño SQL exacto y las pruebas de pool son puerta obligatoria antes de marcar tareas de activación.
