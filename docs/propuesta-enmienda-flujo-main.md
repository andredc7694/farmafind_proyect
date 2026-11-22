# Propuesta de enmienda: flujo de trabajo en `main`

**Estado:** propuesta para aprobación humana; no modifica ni sustituye la Constitution 1.3.0 vigente.
**Fecha:** 2026-11-22 (America/Lima).
**Origen:** solicitud del responsable del proyecto «Integrar los avances existentes en main y adoptar main como rama de trabajo».
**Versión candidata:** 2.0.0, porque sustituir la prohibición de commits directos por una autorización condicionada redefine de forma incompatible la sección XVI; la regla de versionado de la Constitution exige MAJOR para ello.

## Motivo y alcance

El responsable desea trabajar los próximos incrementos directamente en `main`, con commits descriptivos y push normal. La sección XVI vigente prohíbe cualquier commit o push directo y exige rama, pull request y revisión humana. El paso 1 y el paso 5 del procedimiento de la sección XVIII, así como la regla final que menciona cada pull request, presuponen ese mismo flujo. Esta propuesta solo cambia el procedimiento de Git; no ratifica F02.5, no altera las aprobaciones de especificación y plan, ni relaja RLS, pruebas, seguridad o límites de AWS.

La fuente de esta propuesta es la decisión expresa del responsable en esta conversación. Afecta las secciones XVI, XVIII y la regla final de enmiendas; no cambia los requisitos ni ADR históricos de producto. La transición comenzaría únicamente después de la ratificación humana de 2.0.0 y de verificar que las protecciones efectivas de GitHub admiten el nuevo flujo. La compatibilidad con seguridad se demostraría en cada incremento mediante controles de Git, pruebas y evidencia de aprobación SDD; no se presume por la sola aprobación de esta propuesta.

## Texto propuesto para ratificación

**Sustituir la sección XVI por:**

> ### XVI. Protección de main
>
> Para incrementos con especificación y plan aprobados, el equipo PUEDE trabajar y registrar commits descriptivos directamente en `main`, siempre que respete el alcance autorizado, ejecute los controles aplicables, revise secretos y datos privados y confirme que las protecciones del repositorio permiten el push normal. Ningún commit equivale a aceptación funcional. Está prohibido el force-push, eludir protecciones o integrar cambios con controles obligatorios fallidos. Si GitHub exige rama, pull request, revisión o controles adicionales, estos DEBEN cumplirse. Las enmiendas de la Constitution, los cambios de arquitectura o seguridad que requieran aprobación humana y cualquier otro cambio sujeto a una puerta específica DEBEN obtener esa aprobación antes de integrarse. Una rama temporal PUEDE utilizarse cuando exista una necesidad técnica concreta, sin crearla automáticamente para cada funcionalidad.

**Ajustar el paso 1 de la sección XVIII a:**

> 1. Seleccionar una funcionalidad y la rama de trabajo autorizada (`main` o una rama temporal justificada). Identificar HU, RF, AC, RC, DA, ADR y criterios de rúbrica aplicables, con fuentes y conflictos pendientes.

**Ajustar el paso 5 de la sección XVIII a:**

> 5. Ejecutar verificaciones, reunir evidencias y someter el cierre funcional a revisión humana. Presentar pull request cuando lo exijan las protecciones, la decisión del responsable o el alcance del cambio. Los commits directos en `main` no cierran por sí solos tareas de aceptación humana; los pendientes DEBEN quedar expresos. Los recursos AWS facturables requieren además la autorización del principio XII.

**Ajustar la regla final de enmiendas a:**

> Cada plan y cambio destinado a `main`, sea por pull request o por commit directo autorizado, DEBE revisar principios aplicables, continuidad documental, aprobaciones y evidencias. Un incumplimiento DEBE corregirse antes de integrar; si exige cambiar una regla, DEBE tramitarse como enmienda humana y no como excepción tácita.

## Puertas conservadas

- Aprobación humana de especificación y plan antes de generar código.
- Aceptación funcional humana cuando los criterios la exijan, con tareas pendientes visibles.
- Protección multi-tenant y PostgreSQL RLS, verificación y control de secretos.
- Protecciones efectivas de GitHub, aunque exijan PR o revisiones.
- Prohibición de force-push, despliegues AWS o recursos facturables sin autorización.

El PR #2 se rige por la Constitution actual: necesita revisión humana antes del merge. Esta propuesta no autoriza fusionarlo ni empezar a trabajar directamente en `main` hasta su ratificación expresa y la actualización formal de la Constitution.

## Autorización de integración y estado del PR #2

El responsable autorizó expresamente, en su mensaje «Integración definitiva de avances en main y cambio controlado del flujo Git» del 2026-11-22, revisar y validar el PR #2 y realizar su merge **si** se cumplen las reglas y aprobaciones obligatorias. Esta autorización no es una aceptación funcional de F02.5 ni declara completadas T046, T057 o T063. El requisito F025-RF23 continúa aplazado.

La consulta de GitHub del 2026-11-22 confirmó que el PR #2 seguía abierto, con base `main`, origen `feat/f025-incorporacion-farmacias`, 35 commits, 758 archivos y estado de merge sin conflictos. No había revisiones registradas ni checks de GitHub. El ruleset activo `Proteccion-main` exige pull request y no fija un número mínimo de aprobaciones, pero la sección XVI de la Constitution sí exige revisión humana. Por tanto, el PR queda pendiente de esa revisión específica; la autorización general de integración no la sustituye.
