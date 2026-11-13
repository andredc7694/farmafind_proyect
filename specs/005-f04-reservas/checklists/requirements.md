# Specification Quality Checklist: F04 — Reservas y concurrencia

**Purpose**: Validar que la especificación sea completa, verificable y apta para revisión humana antes de planificar.
**Created**: 2026-11-13
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No contiene diseño de implementación, librerías o estructura de código.
- [x] Explica valor para clientes y personal de farmacia.
- [x] Todas las secciones obligatorias de la plantilla están completas.
- [x] Diferencia hechos documentados, dependencias, propuestas y pendientes.

## Requirement Completeness

- [x] HU03–HU04 y RF05–RF09 están trazados sin renumerar las fuentes históricas.
- [x] Las cinco historias son independientes y tienen escenarios positivos y negativos.
- [x] Los 26 requisitos son verificables y conservan los límites de F01–F03.
- [x] La máquina de estados y sus estados terminales coinciden con la Constitution.
- [x] Creación, cancelación, expiración, falta física y entrega definen efectos atómicos y únicos.
- [x] Propiedad del cliente, delegación, tenant y RLS cuentan con escenarios negativos.
- [x] AC05 conserva exactamente 100 solicitudes, 10 unidades y 10 PENDIENTES.
- [x] Outbox se registra en F04 y su publicación/procesamiento queda en F05.
- [x] Pagos, notificaciones operativas, privilegios globales, BOOT-01, IA y rediseño quedan fuera.
- [x] Las nueve métricas de éxito son medibles y no declaran resultados ejecutados.
- [x] Dependencias con F01, F02 y F03 están identificadas.
- [x] La trazabilidad conserva los 16 criterios docentes sin inventar calificaciones.

## Clarifications and Readiness

- [x] El plazo PENDIENTE inicial de 20 minutos está respaldado y permanece configurable.
- [x] F04-TIME-01 sustituye expresamente la propuesta histórica de 24 horas por rango de 1 a 8 horas, valor predeterminado de 4 horas y vencimiento fijado al confirmar.
- [x] No existen otras ambigüedades bloqueantes detectadas para aprobar la especificación.
- [x] La especificación y F04-TIME-01 recibieron aprobación humana explícita el 2026-11-13.

## Notes

- Se leyó el DOCX maestro v2.0 completo, incluidos los capítulos 25–36, con SHA-256 `761e59cf403c0d153c8fcbbe535f48f991bdd3789e8f2eca0e20dd76cf3faf05`.
- Se contrastó el repositorio histórico en el commit `56d3ef9d334a96df400a29d1e0c52e8a6cd696f0`, especialmente HU, RF, atributos de calidad y diseño interno de Reservas.
- F03 conserva 58/58 tareas marcadas y su rama publicada; esta checklist no sustituye su revisión humana pendiente.
