# Aprobaciones SDD F01.1 (014)

## Aprobación de la especificación — 2026-11-23

**Fecha:** 2026-11-23 (America/Lima). **Responsable:** propietario del proyecto FarmaFind (Andre). **Fuente:** mensaje «apruebo» de esta conversación, posterior al resumen de la spec y sus 3 decisiones abiertas.

**Alcance aprobado:** [spec.md](spec.md) de F01.1 (MEJ-015, MEJ-016, MEJ-017 y MEJ-019) como base para el paso *clarify*. Las 3 decisiones marcadas [NEEDS CLARIFICATION] siguen **abiertas** y se resuelven en *clarify* (Puerta 4).

**No autoriza:** plan, tareas ni código; AWS, correo real, datos reales o bases persistentes. Tampoco responde por sí solo la Puerta 2 (integración de F02.1) ni la decisión sobre las suites RLS, que se mantienen pendientes de respuesta expresa.

## Respuestas de *clarify* — 2026-11-23

**Fecha:** 2026-11-23 (America/Lima). **Responsable:** Andre. **Fuente:** mensaje «si esta bien como detallaste asi qeu empieza», que acepta las cinco recomendaciones (Q1 C, Q2 A, Q3 A, Q4 A, Q5 B) presentadas en la parada de *clarify*. **Alcance:** resolver las decisiones de la Puerta 4 y autorizar el paso a *plan*. Registradas en [spec.md](spec.md), sección Clarifications. No aprueba el plan ni las tareas.

## Aprobación del plan — 2026-11-23

**Fecha:** 2026-11-23 (America/Lima). **Responsable:** Andre. **Fuente:** mensaje «apruebo los planes» de esta conversación, posterior al resumen del plan.

**Alcance aprobado:** [plan.md](plan.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/](contracts/) y [quickstart.md](quickstart.md) de F01.1, tal como están redactados. Esto incluye la decisión **D-06 en su versión propuesta (A)**: mensajes de cuenta por simulador local en TEST, sin extender F05; el responsable no eligió otra opción. La alternativa B (evento en F05) queda para cuando se autorice un proveedor real de correo.

**No autoriza:** tareas ni código (falta aprobar `tasks.md`), AWS, correo real, datos reales, bases persistentes ni cambios a F05. Tampoco responde la Puerta 2 (integración de F02.1 a `main`) ni la decisión sobre las suites RLS, que siguen pendientes.
