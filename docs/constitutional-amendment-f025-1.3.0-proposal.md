# Propuesta de enmienda constitucional 1.3.0 â€” secuencia de F02.5

**Estado:** propuesta aprobada expresamente por el responsable y aplicada a la Constitution 1.3.0 el 2026-11-19; este archivo conserva el texto presentado para revisiÃ³n.
**Fecha de preparaciÃ³n:** 2026-11-19.
**Constitution anterior:** 1.2.0, ratificada el 2026-11-10 y enmendada el 2026-11-17. **Vigente tras aprobaciÃ³n:** 1.3.0.

## Motivo y fuentes

La Constitution, principio XV, y `docs/adr/ADR-ROADMAP-V3-001-adopcion-controlada.md`, decisiÃ³n 3, fijan F06.1 â†’ F07 â†’ F08 â†’ F09 â†’ F10 para el desarrollo futuro. El responsable solicitÃ³ diseÃ±ar F02.5 despuÃ©s de F08 y antes de F09, y aprobÃ³ DEC-01, DEC-02 y DEC-03 para su alcance TEST/DEMO. `docs/referencias/FarmaFind_Documento_Maestro_v3_1_F025_Consolidado.docx`, secciÃ³n A4 bis, propone F02.5, pero su incorporaciÃ³n al repositorio no lo ratifica ni modifica la Constitution. La especificaciÃ³n y el plan propuestos estÃ¡n en `specs/012-f025-incorporacion-farmacias/`.

## Texto normativo presentado y aplicado

**Principio afectado:** XV, Ãºnicamente la frase que contiene el roadmap. Sustituir:

> Los capÃ­tulos 25â€“36 del v2.0 conservan las decisiones compatibles sobre AWS y multitenencia; la Parte A del v3.0 establece el roadmap futuro F06.1 â†’ F07 geolocalizaciÃ³n â†’ F08 frontend profesional â†’ F09 AWS manual â†’ F10 escalabilidad y evidencias.

Por:

> Los capÃ­tulos 25â€“36 del v2.0 conservan las decisiones compatibles sobre AWS y multitenencia. La secuencia futura aprobada es F06.1 â†’ F07 geolocalizaciÃ³n â†’ F08 frontend profesional â†’ F02.5 incorporaciÃ³n y administraciÃ³n de farmacias â†’ F09 AWS manual â†’ F10 escalabilidad y evidencias. F02.5 es un incremento independiente, incorporado cronolÃ³gicamente despuÃ©s de F08; su identificador funcional no renumera ni altera los incrementos histÃ³ricos. El Documento Maestro v3.1, secciÃ³n A4 bis, aporta el alcance propuesto de F02.5 y no sustituye por sÃ­ mismo la precedencia general del v3.0 ni modifica obligaciones histÃ³ricas. La implementaciÃ³n de F02.5 requiere aprobaciÃ³n expresa de su especificaciÃ³n y plan, y sus operaciones privilegiadas se limitan a bases TEST/DEMO aisladas segÃºn DEC-01â€“03.

**Metadatos aplicados:** `Version: 1.3.0`; `Ratified: 2026-11-10`; `Last Amended: 2026-11-19`. La versiÃ³n MINOR responde a la ampliaciÃ³n normativa de la secuencia, conforme a las reglas de versionado de la Constitution.

**ADR afectada:** [ADR-F025-001](adr/ADR-F025-001-incorporacion-farmacias-propuesta.md) registra la inserciÃ³n F02.5 y la excepciÃ³n limitada DEC-02; `ADR-ROADMAP-V3-001` se conserva Ã­ntegra como antecedente, sin reescribir su decisiÃ³n original.

## Impacto y compatibilidad

- F00â€“F08 y F06.1 conservan identificadores, requisitos, evidencia y aceptaciones histÃ³ricas. F09 sigue reservado a AWS manual con autorizaciÃ³n individual de recursos y costos; F10 mantiene escalabilidad y evidencias.
- Los siete mÃ³dulos, Clean Architecture, PostgreSQL RLS, Redis, Outbox, lÃ­mites de IA y protecciÃ³n de `main` permanecen sin cambios.
- DEC-01 no confiere acceso general a inventarios ni reservas privados. DEC-02 permite una sola membresÃ­a `DUENO` al solicitante de una farmacia nueva Ãºnicamente en TEST/DEMO, con transacciÃ³n, idempotencia y auditorÃ­a. DEC-03 mantiene datos ficticios y RUC/adjuntos opcionales solo en TEST/DEMO. La frase histÃ³rica del capÃ­tulo 27 sobre membresÃ­as de terceros sigue como antecedente; la excepciÃ³n nueva debe quedar trazada, no atribuida al maestro.
- `F025-RF23` (suspensiÃ³n/desactivaciÃ³n) permanece bloqueado hasta aprobar actor, procedimiento y efectos. No se autoriza provisiÃ³n privilegiada persistente/productiva, AWS ni proveedores externos.
- El plan F02.5 deberÃ¡ aprobarse expresamente antes de generar cÃ³digo, migraciones o pruebas ejecutables, conforme al principio XVIII. Esta propuesta no acredita implementaciÃ³n, validaciÃ³n ni aceptaciÃ³n de F02.5.

## AprobaciÃ³n registrada

El responsable respondiÃ³ Â«APRUEBOÂ» el 2026-11-19 a la solicitud concreta de aprobar este texto y la revisiÃ³n de `spec.md` y `plan.md` F02.5, seguida de Â«daleÂ» para proceder. La Constitution 1.3.0 quedÃ³ aplicada y [approval.md](../specs/012-f025-incorporacion-farmacias/approval.md) registra las revisiones aprobadas. Ninguna de estas aprobaciones equivale a aceptaciÃ³n tÃ©cnica o funcional de F02.5.
