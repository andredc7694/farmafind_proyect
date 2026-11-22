# Borrador de enmienda constitucional 1.4.0 para v3.2

**Estado: BORRADOR CONSTITUCIONAL NO RATIFICADO.** Fecha de preparación: 2026-11-21. No se editó `.specify/memory/constitution.md` ni ninguna ADR previamente aprobada. La [ADR-ROADMAP-V3-002](adr/ADR-ROADMAP-V3-002-adopcion-documental-v3.2.md) registra únicamente la adopción documental ya autorizada; el texto normativo siguiente requiere **aprobación humana independiente** antes de aplicarse.

## Motivo y versión base

La edición documental corregida del maestro v3.2 ya se adoptó para preparar incrementos futuros, subordinada a la Constitution y decisiones ratificadas. Constitution XV todavía nombra v3.0 como referencia principal y v3.1 como fuente específica de F02.5. Esa **sustitución de precedencia normativa** requiere enmienda separada. La corrección de 24 horas ya se resolvió funcionalmente por F04-TIME-01 y se incorporó al DOCX corregido; la futura Constitution debe consignarlo explícitamente.

HEAD contiene Constitution **1.2.0**. El árbol local contiene **1.3.0** con SHA-256 `601F93AC45C4015C89C137A8D4899D86EE8F1E2D07EEDB14DF8A5F44AA5131C4`, exactamente el hash registrado en `specs/012-f025-incorporacion-farmacias/approval.md` para la aprobación humana de F02.5. Esto respalda la aprobación documental de 1.3.0, **pero no su integración en Git**. La versión candidata sería **1.4.0** solo si se toma 1.3.0 como base aprobada y se resuelve su estado Git; de lo contrario debe conciliarse primero la base, sin saltar ni reescribir una enmienda.

## Texto normativo mínimo propuesto para Constitution XV

**Sustituir únicamente** la frase que empieza «La Parte A del Documento Maestro v3.0 consolidado DEBE ser la referencia...» y termina «... su texto también consta en la Parte B del v3.0» por:

> El cuerpo nuevo del Documento Maestro v3.2, secciones 0–18, DEBE ser la referencia funcional y arquitectónica principal para **incrementos futuros**, únicamente en lo compatible con esta Constitución, decisiones humanas expresas y especificaciones aprobadas. El Documento Maestro v3.0 y su ADR de adopción permanecen como precedentes; la sección A4 bis de v3.1 conserva el alcance F02.5 aprobado solo para TEST/DEMO; v2.0 y los anexos históricos no se reescriben. Los identificadores HU01–HU06, RF01–RF13, AC01–AC09, RC01–RC11, DA01–DA09 y ADR-01–ADR-12 siguen vigentes. HU07–HU28, RF14–RF47, AC10–AC17, RC12–RC18, DA10–DA16, ADR-P13–ADR-P20 y MEJ-001–MEJ-019 se conservan como identificadores trazables; cualquier ampliación nueva que describa v3.2 requiere su propia especificación y decisiones aprobadas, sin invalidar las aprobaciones históricas que ya correspondan a esos identificadores. Ninguna mención de v3.2 demuestra por sí sola implementación ni aceptación. Las etiquetas F07-LEGACY-AWS y F08-LEGACY-SCALE permanecen.

**Actualizar además** la frase posterior de XV «El Documento Maestro v3.1, sección A4 bis, aporta el alcance propuesto de F02.5 y no sustituye por sí mismo la precedencia general del v3.0 ni modifica obligaciones históricas» por:

> El Documento Maestro v3.1, sección A4 bis, conserva la fuente específica del alcance F02.5 aprobado para TEST/DEMO. Su incorporación histórica no modifica por sí misma las obligaciones ni las aceptaciones existentes.

**Sustituir el bloque de trazabilidad** en «Inconsistencias y decisiones que DEBEN permanecer visibles» que comienza «La numeración de los capítulos 10 y 33 del v2.0...» y termina «... una funcionalidad a la vez» por:

> La numeración de los capítulos 10 y 33 del v2.0 y la secuencia de la Parte A A3/A10 de v3.0 se conservan como antecedentes. La secuencia funcional aprobada F06.1 → F07 → F08 → F02.5 → F09 → F10 permanece; v3.2 §12 propone subincrementos F02.1, F01.1, F04.1 y F08.1 sin aprobar su implementación. F07-LEGACY-AWS y F08-LEGACY-SCALE DEBEN desambiguarse en toda nueva trazabilidad. Cada nueva funcionalidad conserva aprobación SDD y la regla de una funcionalidad activa por vez.

**Añadir después de la regla histórica de 24 horas de la sección «Restricciones y continuidad documental»**, sin borrar la frase antecedente:

> La propuesta histórica de 24 horas para CONFIRMADA fue sustituida expresamente por la decisión humana F04-TIME-01 del 2026-11-13: cada farmacia configura de 1 a 8 horas, el valor predeterminado es 4 horas, el plazo inicia al confirmar y el vencimiento exacto queda fijado por reserva. La preferencia estimada de recogida MEJ-014 NO DEBE ampliar ese vencimiento ni prometer una franja garantizada.

**Metadatos propuestos tras aprobación y conciliación del árbol Git:** `Version: 1.4.0`, `Ratified: 2026-11-10`, `Last Amended: [fecha de aprobación efectiva]`. La fecha no se anticipa. La versión MINOR se justifica por la nueva referencia normativa, conforme a Governance; no se alteran principios de RLS, AWS, IA ni tecnologías.

## Alcance adicional propuesto para una futura revisión de ADR-ROADMAP-V3-002

**Estado:** borrador **no aprobado como ampliación normativa**. ADR-ROADMAP-V3-002 ya registra la adopción **documental**; este apartado explica el alcance que necesitaría aprobación separada para declarar precedencia constitucional plena. No reemplaza ADR-ROADMAP-V3-001, ADR-F025-001 ni ADR-F04-SEC-001.

- **Contexto:** el maestro v3.2 integra MEJ-001–019, HU07–28, RF14–47 y anexa v3.1/v2.0; su §3.2 repite 24 h incompatibles con F04-TIME-01. El estado real de F02.5 es implementación TEST/DEMO en curso.
- **Decisión normativa pendiente:** otorgar a las secciones nuevas 0–18 precedencia como fuente principal futura, siempre en lo compatible con la Constitution y decisiones ratificadas. La corrección editorial §3.2, la preservación de anexos y el orden documental del roadmap ya se registraron en etapa 0.2; cada incremento seguirá exigiendo su spec/plan aprobados antes de código.
- **Límites:** DEC-001 es objetivo US$0 de servicios externos TEST/DEMO, incluidas nuevas APIs, no una tarifa garantizada; PostgreSQL RLS, Redis Cache-Aside, Unit of Work, Outbox y Clean Architecture permanecen. Gemini/correo externo/SMS/WhatsApp Business apagados, AWS F09 exclusivamente manual y por aprobación de recurso/costo. GLO-01/BOOT-01 solo TEST efímero; F025-RF23 bloqueada. La ADR no autoriza proveedores, migraciones persistentes, despliegues, cuentas privilegiadas reales ni aceptación F02.5.
- **Consecuencia:** nuevos documentos Spec Kit deben trazar MEJ→Actor→HU→RF→AC→prueba y 16 criterios docentes; las ADR-P13–P20 continúan propuestas, no ratificadas automáticamente.
- **Aprobación requerida:** responsable del proyecto debe aprobar explícitamente la enmienda 1.4.0 y cualquier ampliación normativa de la ADR o indicar ajustes. Registrar fecha, revisión exacta, motivo y hashes antes de aplicar cambios constitucionales. Ningún silencio equivale a aprobación.

## Decisiones expresadas frente a decisiones aún abiertas

| Ya expresado y preservado | Pendiente de resolver antes del código afectado |
|---|---|
| Clientes se registran por aplicación; propietarios solicitan farmacia con aprobación; trabajadores solo dentro de farmacias autorizadas; admins generales solo por procedimiento técnico, sin UI pública. | Identificador/alias del trabajador frente al correo F01; vínculo de cuenta existente y aceptación; recuperación sin canal entregable, contraseña temporal y cambio inicial; TOTP/admin y recuperación de factor; revocación coordinada de sesiones; auditoría exacta de cada operación. No se crea permiso nuevo en esta etapa. |
| F04-TIME-01: 1–8 h, default 4, vencimiento fijo. | Solo la corrección editorial del maestro v3.2 §3.2 y la enmienda de precedencia/clarificación; no hay decisión funcional nueva de reservas. |
| F02.5 DEC-01–03, capacidades TEST de inventario/reservas y ADR-F04-SEC-001 aprobadas para base aislada. | Cierre de T054/T057/T063, criterios restantes y revisión humana; F025-RF23 necesita decisión aparte sobre suspensión, actor y consecuencias. |
| F09 manual, autorización individual por recurso/costo; US$0 objetivo TEST/DEMO para servicios externos, mock IA y servicios locales. | Condiciones del proveedor de mapas/geocoder, correo real, corpus farmacológico revisado y eventual LLM antes de activarlos; cotización y permisos AWS solo cuando se inicie F09. |

La [conciliación](conciliacion-maestro-v3.2.md) identifica los pasajes del DOCX corregido. Esta propuesta constitucional no altera el archivo original ni sus anexos.
