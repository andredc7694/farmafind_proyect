# Notificaciones F00

Proceso Express + TypeScript independiente con configuración propia y solo `GET /health`. No importa la instancia API, envía mensajes, consume eventos ni procesa una Outbox. En etapas posteriores la entrega seguirá el commit de negocio mediante Transactional Outbox y Unit of Work; esta ruta no afirma que existan eventos reales.

PostgreSQL/RLS, Redis Cache-Aside, Docker Compose y AWS S3 privado/CloudFront OAC/Lightsail son obligaciones posteriores de la arquitectura. No se activan en este servicio F00. Los requisitos históricos HU01–HU06, RF01–RF13, AC01–AC09, RC01–RC11, DA01–DA09 y las ADR se conservan; RC04 y ADR complementarias siguen pendientes de formalización.
