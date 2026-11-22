# F02.5 — Paquete de revisión humana del SQL TEST

**Estado:** cinco borradores preparados; **ninguna migración ejecutada**. Las tareas T006–T010 siguen sin marcar hasta verificar el SQL y sus criterios en PostgreSQL real. `tasks.md`, fase 2, exige revisión humana del SQL antes de ejecutarlo.

| Orden | Archivo | SHA-256 | Alcance de revisión |
|---|---|---|---|
| 1 | [001_applications.sql](../../backend/migrations/f025/001_applications.sql) | `0DC2EDB8326D5BF72558883EB06677D9E02A69FA82F557464157BC2456236C7D` | Solicitudes previas al tenant, revisión, documentos opcionales, activación única y perfil. |
| 2 | [002_platform_permissions.sql](../../backend/migrations/f025/002_platform_permissions.sql) | `FC7427191D8EDC0680FBA2C12D9A8CCC94DE09DF91205BE5EBEA7AEB2590282C` | Cinco capacidades F02.5 cerradas, roles internos sin LOGIN/BYPASSRLS; ningún grant a una cuenta. |
| 3 | [003_rls.sql](../../backend/migrations/f025/003_rls.sql) | `5B467815BAD93D298B1FF82EB474C89AB0EFEAB1F000EFC21AD00A8507CEBAFC` | Sesión F01, actor y capacidad, RLS/FORCE RLS, denegación por defecto y perfil tenant. |
| 4 | [004_activation.sql](../../backend/migrations/f025/004_activation.sql) | `090C26AD66FFA70A1F0E15F40D24AAD8D72C1A1A8E2A5692569234C848ED6004` | Activación TEST transaccional/idempotente, único DUENO, auditoría, control de clúster y autoaprobación. |
| 5 | [005_outbox.sql](../../backend/migrations/f025/005_outbox.sql) | `5EA8CCA911F2C47DC794AF63CFE09A01A1DD42298DCC3679BC95F9CE5392C32A` | Outbox propio, evento mínimo de aprobación mediante trigger en la misma transacción y lectura F05 separada. |

## Aislamiento de la ejecución prevista

`compose.f025-postgres.yaml` define PostgreSQL oficial `18.6-bookworm`, clúster `farmafind-f025-test`, volumen `f025_pgdata` exclusivo y puerto `127.0.0.1:55431`. Un secreto aleatorio exclusivo de F02.5 está en `.cache/f025-docker/postgres-password.txt`, ignorado por Git; su contenido no se registró. El contenedor **no se ha iniciado**. La base de trabajo deberá ser una nueva `farmafind_f01_test_<12 hex>` dentro de ese clúster, con marca TEST requerida por F07; `farmafind_f01_test` del clúster habitual no se migrará ni modificará. Si el puerto está ocupado, la ejecución debe detenerse sin parar servicios ajenos. El guardarraíl en `scripts/f025/test-env.mjs` y la función de activación verifican destino y clúster antes de operaciones F02.5.

## Puntos obligatorios para la revisión

1. Comprobar que las políticas y funciones SECURITY DEFINER no permiten lectura/escritura de otras solicitudes, membresías o farmacias; los roles internos no reciben LOGIN, SUPERUSER ni BYPASSRLS.
2. Comprobar que `f01_runtime` solo inserta borradores propios y no puede cambiar estado, farmacia activada ni privilegios directamente.
3. Comprobar que la función de aprobación exige sesión válida, asignación global F01 activa, ambas capacidades F02.5, revisor distinto del solicitante, versión, motivo e idempotencia.
4. Comprobar que una falla en farmacia, DUENO, revisión, perfil, activación o trigger Outbox revierte toda la transacción y que dos aprobaciones concurrentes producen un solo efecto.
5. Confirmar que documentos sintéticos opcionales seguirán deshabilitados hasta fijar acceso y retención; `F025-RF23` suspensión sigue bloqueado.

Los controles estáticos detectaron cero líneas con espacios finales y ninguna instrucción `DROP`, `TRUNCATE` o `DELETE FROM` en estos cinco archivos. **No prueban sintaxis PostgreSQL, permisos efectivos, RLS ni ausencia de fallos.** `docker compose -f compose.f025-postgres.yaml config --quiet` pasó. La ejecución requiere Docker Desktop disponible y pruebas PostgreSQL reales Alfa/Beta.

## Aprobación humana del paquete SQL

El responsable del proyecto aprobó expresamente ejecutar las cinco migraciones de este paquete únicamente en el contenedor F02.5 TEST dedicado en esta conversación, el 2026-11-19 (respuesta «si apruebo» a la solicitud de aprobación de las cinco migraciones). Los cinco hashes SHA-256 se volvieron a comprobar y coinciden con esta tabla. Esta aprobación no autoriza ejecutarlas en `farmafind_f01_test`, otros clústeres ni producción; tampoco acredita por sí sola el resultado de la migración o las pruebas RLS.
