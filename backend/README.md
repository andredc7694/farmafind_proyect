# Núcleo F00

Express + TypeScript implementa únicamente `GET /health`. [Límites de módulos](src/modules/README.md) registra los siete módulos históricos y FarmaFind AI futura. La composición técnica permanece fuera de `domain`; futuras capas `application`, `domain`, `presentation` e `infrastructure` seguirán Clean Architecture.

PostgreSQL será la fuente oficial. El aislamiento por farmacia exigirá membresía, rol y autorización por recurso, contexto de tenant por transacción, RLS sin `BYPASSRLS` y pruebas de aislamiento. Redis seguirá Cache-Aside con TTL, invalidación posterior al commit y fallback a PostgreSQL. Unit of Work y Transactional Outbox permanecen obligaciones futuras. Ninguna conexión, política SQL o transacción opera en F00.

Docker Compose y AWS S3 privado, CloudFront OAC y Lightsail permanecen para etapas posteriores. No hay recursos creados. Se conservan HU01–HU06, RF01–RF13, AC01–AC09, RC01–RC11, DA01–DA09 y las ADR históricas; RC04 y ADR complementarias siguen pendientes de formalización documental.
