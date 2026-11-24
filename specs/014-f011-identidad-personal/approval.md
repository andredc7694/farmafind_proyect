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

## Aprobación de las tareas — 2026-11-23

**Fecha:** 2026-11-23 (America/Lima). **Responsable:** Andre. **Fuente:** mensaje «apruebo pero antes de eso dime donde se estan almacenando los commits…» de esta conversación.

**Alcance aprobado:** [tasks.md](tasks.md) (58 tareas, T001–T058) como lista de trabajo de F01.1. **Condición del responsable:** antes de empezar la implementación debe aclararse dónde se guardan los commits (ver respuesta en la conversación). La implementación no arranca hasta esa aclaración.

**No autoriza:** AWS, correo real, datos reales, bases persistentes, ni la integración a `main` (Puerta 2).

**Condición resuelta — 2026-11-23:** el responsable respondió con el flujo de ramas definitivo («Sí, confirmo el primer push… Continúa con el lote 1 (T001–T016)»). La aprobación de las tareas queda vigente sin condiciones pendientes y la implementación del lote 1 queda autorizada.

## Decisión de seguridad: ruta heredada de concesión directa (Puerta 6) — 2026-11-23

**Fecha:** 2026-11-23 (America/Lima). **Responsable:** Andre. **Fuente:** mensaje «A» de esta conversación, respuesta a la parada del lote 2.

**Decisión: opción A.** Se retira la concesión directa de membresía por `userId` (`POST /pharmacies/{id}/memberships`): la ruta se conserva únicamente para responder `410 Gone` (sin conceder nada) porque el contrato F01 histórico (carpeta 002, no se modifica) la documenta; la vinculación de cuentas existentes pasa solo por invitación aceptada (F011-FR-004). La revocación (`PATCH`) y el listado se conservan. Las pruebas de F01 que esperaban el 201 se actualizan; la interfaz deja de ofrecer «Conceder rol TRABAJADOR».

**No responde** la pregunta sobre el PR de F02.1 (Puerta 2), que sigue sin autorizar.
