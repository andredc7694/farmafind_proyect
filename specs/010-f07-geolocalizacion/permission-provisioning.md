# F07 — Concesión propuesta de capacidades de ubicación

**Estado:** diseño pendiente de aprobación humana para cualquier base persistente o producción. No es una autorización de concesión.

Las capacidades `GEO_LOCATION_PROPOSE` y `GEO_LOCATION_REVIEW` pertenecen al ámbito de una sola farmacia y se registran como delegaciones explícitas de una membresía F01 activa. No equivalen a `ADMINISTRADOR_PLATAFORMA`, no forman parte del catálogo GLO-01 y no se conceden por el nombre de un rol. F07 no ofrece un endpoint de concesión de estas capacidades.

En una base TEST efímera se pueden crear identidades ficticias separadas para proponer y revisar: ambas deben pertenecer a la misma farmacia y la capacidad de una no implica la otra. La prueba debe incluir actor sin capacidad, membresía suspendida/revocada, intento entre farmacias, autoaprobación y reutilización de conexión. Toda publicación exige evidencia revisada y auditoría transaccional.

Para una base persistente se requiere antes una decisión humana específica que defina quién puede conceder, revocar y auditar cada capacidad; cómo se verifica su autoridad y membresía; cómo se prueba la separación de funciones; y el procedimiento de respaldo/migración de datos. La ratificación GLO-01/BOOT-01 de F01 autoriza solo TEST efímera y no cubre esta concesión persistente. Hasta entonces, las rutas privadas F07 deben denegar por defecto en esa base.

Fuentes: [F07 spec](spec.md), [plan](plan.md), [F01 authorization-decisions](../002-f01-identidad-multitenant/authorization-decisions.md), Constitution v1.2.0.
