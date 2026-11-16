# Research: F05 — Notificaciones

## R01 — Semántica de entrega

**Decision**: entrega al menos una vez en transporte y exactamente una vez lógica mediante
deduplicación persistente por evento+huella.

**Rationale**: la Constitution prohíbe prometer entrega externa exactamente una vez; una
confirmación puede perderse y obliga a reenviar.

**Alternatives considered**: marcar antes de enviar pierde eventos; transacción distribuida
acopla Reserva con Notificaciones; ambas se rechazan.

## R02 — Destino

**Decision**: adaptador local determinista persistente, opción A aprobada.

**Rationale**: demuestra el pipeline completo sin inventar canal, proveedor, plantilla o
destinatario y sin PII/costos.

**Alternatives considered**: buzón web y correo, no aprobados.

## R03 — Autenticación interna

**Decision**: HMAC-SHA256 con timestamp, identidad de evento y hash exacto del cuerpo,
comparación constante y ventana anti-replay.

**Rationale**: usa Node nativo, no añade dependencia y permite pruebas deterministas. HTTPS
seguirá siendo obligatorio en despliegue.

**Alternatives considered**: token bearer no liga el cuerpo; mTLS requiere infraestructura
no aprobada; JWT añade claves/dependencias innecesarias.

## R04 — Reclamos y reintentos

**Decision**: lease PostgreSQL con `SKIP LOCKED`; backoff exponencial base 1 s, máximo 60 s,
12 intentos, todo configurable y probado con reloj inyectable.

**Rationale**: habilita dos workers, recuperación de procesos caídos y escenario de cinco
minutos sin espera real.

**Alternatives considered**: cola Redis contradice su alcance de búsqueda; bloqueo abierto
durante HTTP consume conexiones; ambos se rechazan.

## R05 — Persistencia y tenant

**Decision**: esquema `f05`, roles NOLOGIN sin BYPASSRLS, FORCE RLS y políticas por
`farmacia_id`; publicador solo accede a columnas operativas del Outbox.

**Rationale**: PostgreSQL es fuente oficial y el worker transversal requiere privilegios
explícitos, pequeños y verificables.

**Alternatives considered**: usar `f01_runtime` mezclaría autoridad de usuario y worker;
usar migrador o propietario eludiría RLS.

## R06 — Orden

**Decision**: no reclamar un evento si existe para la misma reserva otro anterior aún no
publicado; ordenar por `creado_en,id`.

**Rationale**: evita presentar estados anteriores después de terminales sin crear una cola global.

**Alternatives considered**: orden global reduce concurrencia; aceptar cualquier orden obliga
al destino a reconstruir estados que F05 no necesita.
