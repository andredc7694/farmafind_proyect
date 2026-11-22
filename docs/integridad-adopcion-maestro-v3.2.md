# Etapa 0.2 — Integridad y alcance de la adopción documental v3.2

**Fecha:** 2026-11-21. **Rama comprobada:** `feat/f025-incorporacion-farmacias`, HEAD `df5831e`. La adopción documental está registrada en [ADR-ROADMAP-V3-002](adr/ADR-ROADMAP-V3-002-adopcion-documental-v3.2.md); Constitution 1.4.0 no está ratificada.

## Archivos y verificación del DOCX

| Copia local en `docs/referencias/` | Estado | SHA-256 |
|---|---|---|
| `FarmaFind_Documento_Maestro_v3_2_Integral_Analisis_Arquitectura_AWS_Manual.docx` | Original recibido, no editado. | `39DCFDBE676E8FAC4F512BAA8F49C9A235A0E0887AB40AE2DE6E893A5919414E` |
| `FarmaFind_Documento_Maestro_v3_2_Original_2026-11-21.docx` | Respaldo creado antes de la edición; idéntico al original. | `39DCFDBE676E8FAC4F512BAA8F49C9A235A0E0887AB40AE2DE6E893A5919414E` |
| `FarmaFind_Documento_Maestro_v3_2_Adopcion_Documental_2026-11-21.docx` | Edición documental corregida para especificaciones futuras. | `DEAE3087BDB7E595266AC649DA9EA604916712ADF4E5664814B4FD80D84CC8A3` |

Se abrió y analizó `word/document.xml` de ambas copias como XML válido. Cada DOCX contiene **19 entradas** ZIP; las otras **18 entradas** son idénticas en contenido. Ambos conservan **60 tablas y 664 filas**. La edición tiene **2462 párrafos frente a 2461** por una nota de vigencia añadida en §0. Desde el encabezado `ANEXO H. Documento Maestro v3.1 completo` hasta el final, el XML es **idéntico byte por byte** al original; por tanto, los anexos v3.1/v2.0 no se reescribieron. No se ha comprobado apertura visual en Word/LibreOffice, solo integridad ZIP/XML y estructura.

**Cambios del cuerpo principal:** título y estado de la edición; §0 nota de vigencia y subordinación constitucional; §3.2 reemplazo de la única mención nueva a «24 h» por F04-TIME-01 (1–8 h, 4 por defecto, desde CONFIRMADA, vencimiento fijo sin ampliación); §16 MEJ-014 aclaración de que la preferencia cabe dentro de ese vencimiento y no garantiza cita. Las tres menciones de 24 horas del anexo v2.0 permanecen intactas como antecedentes; la nota §0 indica que no son vigentes. La [conciliación](conciliacion-maestro-v3.2.md) conserva los textos y ubicaciones exactos.

## Trazabilidad y límites

La [matriz consolidada](trazabilidad-maestro-v3.2.md) contiene **19/19 filas MEJ-001–MEJ-019**, cada una con actor, HU, RF, AC propuesto, módulo, prueba y evidencia aún necesaria. El DOCX conserva las referencias agregadas HU01–HU28, RF01–RF47, AC01–AC17 y MEJ-001–019, y las series históricas RC01–RC18, DA01–DA16 y ADR-01–ADR-12 sin renumerarlas. En el texto del DOCX, algunas series históricas aparecen como **rangos** (por ejemplo RC01–RC11 y DA01–DA09), no como definiciones individuales nuevas; esta revisión no inventa el contenido de cada identificador. ADR-P13–ADR-P20 siguen propuestas y DEC-001 mantiene objetivo US$0 para servicios externos TEST/DEMO. Los 16 criterios docentes siguen sujetos a evidencias reales, sin puntuación inferida.

El [roadmap](roadmap-implementacion-v3.2.md) queda adoptado documentalmente en el orden 0 adopción, 1 cierre F02.5, 2 F02.1, 3 F01.1, 4 F04.1, 5 F08.1, 6 pruebas integrales, 7 F09/F10 solo con autorizaciones futuras. Conserva React/Vite/JSX, Express/TypeScript, Clean Architecture, PostgreSQL RLS, Redis Cache-Aside, Unit of Work, Outbox, Notificaciones independientes, OpenAPI y las puertas de Spec Kit. F09 exige autorización manual por recurso/costo y GitHub Actions sin despliegue automático.

## Constitution y decisiones pendientes

HEAD `df5831e` contiene Constitution **1.2.0**. El árbol local preexistente contiene **1.3.0**, SHA-256 `601F93AC45C4015C89C137A8D4899D86EE8F1E2D07EEDB14DF8A5F44AA5131C4`, coincidente con `specs/012-f025-incorporacion-farmacias/approval.md`, pero aún no integrado en Git. La Constitution aplicable a la rama de trabajo es esa 1.3.0 aprobada localmente; su XV continúa nombrando v3.0 como fuente principal. La edición v3.2 es **referencia documental de trabajo subordinada**, sin precedencia constitucional plena hasta que se apruebe y aplique por separado el [borrador 1.4.0](propuesta-adopcion-constitucional-v3.2.md).

Siguen requiriendo decisión propia: ratificación exacta de Constitution 1.4.0 y conciliación de 1.3.0 en Git; F025-RF23 y aceptación humana de F02.5; alias/recuperación/vinculación y contraseña temporal de trabajadores; política TOTP y recuperación del factor; licencias/cuotas/privacidad de mapas, geocodificación, correo y fuentes farmacológicas; cualquier IA externa; y cada recurso/costo AWS F09. BOOT-01/GLO-01 no salen de TEST efímero. La ampliación v3.2 no se implementó ni se aceptó por esta adopción.

## Estado del repositorio y alcance de comprobación

Antes de esta etapa ya existían modificaciones locales en Constitution, frontend/backend/pruebas/F02.5 y la eliminación local del DOCX v3.0 rastreado por Git. Se preservaron sin restaurar ni editar; la copia histórica v3.0 sigue disponible en HEAD, pero su eliminación local requiere conciliación independiente antes de publicar. `docs/referencias/` está ignorado por Git, por lo que el DOCX corregido y su respaldo permanecen **solo locales** hasta decidir un mecanismo autorizado de distribución. La etapa 0.2 modificó únicamente documentos de revisión/roadmap/trazabilidad, creó esta ADR e informe y produjo las dos copias DOCX. No se ejecutaron migraciones, servicios, contenedores, pruebas funcionales, operaciones sobre bases, AWS, commits, push ni cambios de rama.
