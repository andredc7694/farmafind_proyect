# Registro de enmienda constitucional 1.2.0 por Documento Maestro v3.0

**Estado:** aprobada expresamente por el responsable y aplicada a la Constitution v1.2.0 el 2026-11-17. Ratificación original de la Constitution: 2026-11-10.

La enmienda actualiza precedencia de fuentes, numeración **futura**, AWS manual y la excepción educativa acotada de F06.1. No cambia Clean Architecture, PostgreSQL RLS, Redis, reservas ni identificadores históricos. Este registro resume el texto ratificado; el texto normativo aplicable está en `.specify/memory/constitution.md`.

## 1. Principio XV: fuente principal y continuidad histórica

**Redacción vigente relevante:** «AWS, RLS y FarmaFind AI están documentados en el maestro v2.0» y «Los capítulos 25–36 prevalecen sobre recomendaciones anteriores de AWS y multitenencia; NO autorizan renumerar ni sustituir los requisitos o ADR históricos».

**Redacción aprobada en esencia y aplicada en XV:**

> El Documento Maestro v3.0 consolidado, Parte A, es la referencia funcional y arquitectónica principal para incrementos futuros en todo lo compatible con esta Constitution. Su Parte B y el Documento Maestro v2.0 original permanecen como antecedentes históricos íntegros. Los capítulos 25–36 del v2.0 conservan sus decisiones de arquitectura AWS, RLS y seguridad salvo decisión nueva, trazable y aprobada expresamente; no autorizan modificar o sustituir HU01–HU06, RF01–RF13, AC01–AC09, RC01–RC11, DA01–DA09 ni ADR-01–ADR-12. El roadmap futuro distingue F06.1, F07 geolocalización, F08 frontend, F09 AWS manual y F10 escalabilidad; las etiquetas F07/F08 anteriores continúan identificadas como antecedentes y no se renombran retroactivamente.

La frase propuesta no elimina la obligación de ADR complementaria ni la revisión de conflictos que ya exige XV.

## 2. Restricciones y continuidad documental: numeración

**Redacción vigente relevante:** «Los capítulos 10 y 33 proponen numeraciones F00–F08 diferentes; el 33 es la referencia actualizada para AWS/tenancy. Su secuencia DEBE ratificarse al planificar; NO se deben mezclar IDs, abrir features ni generar tareas en esta revisión constitucional».

**Redacción aprobada en esencia y aplicada en continuidad documental:**

> La Parte A, A3 y A10, del maestro v3.0 establece la numeración futura F06.1 → F07 geolocalización → F08 frontend profesional → F09 AWS manual → F10 escalabilidad. F00–F06 conservan sus IDs y aceptaciones originales. El antiguo F07 AWS se identifica en trazabilidad como F07-LEGACY-AWS y el antiguo F08 escalabilidad como F08-LEGACY-SCALE; esas etiquetas no renombran documentos, ramas, commits, evidencias ni ADR. Los prefijos secuenciales de directorios Spec Kit no son IDs funcionales. Cada nuevo incremento requiere su propia aprobación SDD antes de implementarse.

## 3. Principios XI/XII: despliegue manual obligatorio

La arquitectura AWS propuesta y la autorización previa siguen vigentes. La aprobación humana del 2026-11-17 exige que F09 sea manual y que cada recurso, configuración, costo y operación facturable reciba autorización específica. Los principios XI y XII se actualizaron sin retirar los controles existentes:

> En F09, GitHub Actions puede validar y producir artefactos, pero el despliegue AWS será manual y ejecutado por el responsable únicamente después de autorización humana específica de cada recurso y sus costos. Un plan, merge o pipeline satisfactorio no constituye esa autorización.

## 4. Ampliación clínica informativa aprobada para F06.1

Se aprobó una excepción normativa limitada respecto de la prohibición histórica del capítulo 9: F06.1 podrá describir, con finalidad exclusivamente educativa, clases de medicamentos y opciones de uso habitual asociadas a molestias comunes. Requiere fuentes farmacéuticas verificadas y revisión profesional antes de exponer contenido a usuarios reales. El principio XIX actualizado mantiene prohibidos diagnósticos, prescripciones, dosis personalizadas, selección de tratamientos individuales, afirmaciones clínicas sin respaldo, datos comerciales inventados y uso de información médica personal para decidir qué debe tomar alguien. La decisión **no aprueba la especificación F06.1 ni autoriza implementarla**.

## Evidencia de aprobación y pendientes

- Aprobación: mensaje del responsable en esta conversación titulado «FARMAFIND — APROBACIÓN HUMANA EXPRESA DEL DOCUMENTO MAESTRO V3.0», recibido el 2026-11-17.
- Sigue pendiente aprobar la especificación y el plan de F06.1, así como verificar fuentes, permisos de reutilización, revisión profesional y seguridad antes de uso real.
- Siguen pendientes la selección y autorización de proveedores de IA y mapas, y la autorización individual de recursos AWS. No se hizo ninguna de esas operaciones.

La Constitution v1.2.0 es la fuente de la norma resultante; este registro conserva el motivo, el texto discutido y su trazabilidad, sin reescribir la v2.0 ni las aceptaciones históricas.
