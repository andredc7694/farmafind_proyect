# ADR-F04-SEC-001 — Acceso a stock durante reservas sin exposición de inventario privado

**Estado:** aprobada por el responsable el 2026-11-19; implementada y verificada solo en PostgreSQL TEST efímero F02.5. No aplicada a bases persistentes ni producción.
**Fecha:** 2026-11-19.
**Ámbito:** F04 y validación de aislamiento F02.5 en PostgreSQL TEST efímero.

## Hallazgo reproducido

`backend/migrations/f04/003_rls.sql` añadió `inventory_reservation_select` e
`inventory_reservation_update` para `f01_runtime`. Ambas autorizan cualquier
farmacia indicada en `app.farmacia_id` si existe una sesión vigente, incluso
sin membresía de esa farmacia. Las políticas RLS permisivas se combinan con
OR, de modo que el rechazo de `f02.can_inventory_action` no evita el acceso.
La prueba `node scripts/f025/verify-rls.mjs` reprodujo lectura y modificación
de inventario Beta por Alfa, y de inventario Alfa por un administrador global
sin membresía. Los fixtures se revirtieron; consultar `evidence.md` de F02.5.

## Decisión aprobada e implementada en TEST

1. Añadir una migración aditiva, aplicada solo tras revisión, que retire ambas
   políticas F04 para `f01_runtime`. Conservar las políticas F02 que exigen
   membresía y delegación de inventario, y el rol separado del worker F04.
2. Encapsular **creación de reserva y compromiso de stock** y **transiciones
   que liberan o consumen stock** en operaciones transaccionales estrechas de
   base de datos. Las funciones deben tener `search_path` fijo, dueño
   `NOLOGIN NOBYPASSRLS`, grants de columnas mínimos, y no conceder ese rol
   al runtime. La ejecución se invoca mediante `EXECUTE` limitado; no devuelve
   campos privados de inventario.
3. Las operaciones deben validar sesión F01 vigente, actor, farmacia activa,
   recurso y estado de reserva, autorización específica para personal de
   farmacia, cantidad, vencimiento e idempotencia. Crear/liberar/consumir stock,
   transición y Outbox deben conservar atomicidad y orden de bloqueo. Los
   clientes pueden reservar ofertas autorizadas de cualquier farmacia sin
   obtener lectura ni escritura general de su inventario.
4. Adaptar solo el repositorio F04 que hoy lee/actualiza directamente
   `f02.inventario`. Mantener rutas, formatos de respuesta y contratos HTTP.
   No ampliar permisos del administrador de plataforma.

## Impacto y pruebas antes de activar

El cambio afecta `backend/migrations/f04/003_rls.sql` por sustitución **aditiva**
(sin reescribir la migración histórica),
`backend/src/modules/reservas/infrastructure/reservation-repository.ts`,
los tests RLS/API de reservas, inventario y F02.5, y la ADR F04 de seguridad.
El worker de expiración conserva su rol y políticas actuales; debe verificarse
su concurrencia con cancelación y entrega. Las pruebas obligatorias incluyen:
lectura y `UPDATE` directo Alfa/Beta con ID y contexto manipulados; lectura
del administrador global; propietario propio; reserva pública Alfa/Beta;
creación, confirmación, cancelación, entrega, expiración, doble ejecución,
100 solicitudes concurrentes sobre 10 unidades, Outbox, transacciones y
regresión HTTP. F02.5 no se acepta ni se publica antes de que todas pasen.

## Motivo de la revisión arquitectónica

Retirar solo las políticas corta el acceso a stock que usa actualmente F04.
Una función que cambie stock sin crear/actualizar la reserva y su auditoría
puede desincronizar cantidades mediante una llamada directa. Por ello la
corrección exige reemplazar el mecanismo de persistencia de F04 y una
migración nueva, más allá de las cinco migraciones F02.5 aprobadas. La
autorización posterior de ADR-F04-SEC-001 permitió aplicarla solo al TEST efímero.

## Implementación y consecuencias comprobadas

La aprobación arquitectónica expresa del responsable autorizó el reemplazo acotado de la persistencia de stock F04. Las migraciones nuevas `backend/migrations/f04/005_stock_isolation.sql`–`007_stock_closure_guard.sql` retiran ambas políticas permisivas del runtime y conceden acceso a stock únicamente a `f04_stock_executor`, rol `NOLOGIN NOSUPERUSER NOBYPASSRLS` sin membresía concedida a la aplicación. Las funciones `reserve_stock` y `close_reservation_stock` son `SECURITY DEFINER`, fijan `search_path`, validan sesión vigente, actor, farmacia y operación, no devuelven campos privados de inventario y escriben stock, reserva, transición y Outbox en la misma transacción. El repositorio F04 conserva los contratos HTTP y registra idempotencia en esa misma unidad de trabajo. El worker de expiración conserva su rol separado. La entrega verifica el vencimiento con el reloj de PostgreSQL, incluso frente a una llamada SQL directa con fecha falsificada.

Se aplicaron las migraciones nuevas exclusivamente a `farmafind_f01_test_0e5a2f669e60` en el clúster identificado `farmafind-f025-test`. `node scripts/f025/verify-rls.mjs` pasó **28/28** controles, incluidas las cinco fugas previas; `node scripts/f025/check-f04-rls.mjs` pasó **18/18** pruebas de migración, reservas, Outbox, cancelación, entrega, expiración, concurrencia y llamadas directas; `npm run test:f04:unit` pasó **18/18** y `npm run test:f04:api` **6/6**. Las unitarias F01 **57/57** y F02 **15/15** también pasaron. Estas evidencias no equivalen a aceptación final F02.5: sus rutas HTTP y recorrido E2E siguen pendientes.
