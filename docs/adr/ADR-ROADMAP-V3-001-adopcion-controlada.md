# ADR-ROADMAP-V3-001 — Adopción controlada del Documento Maestro v3.0

**Estado:** aprobada expresamente el 2026-11-17 junto con la enmienda constitucional v1.2.0.
**Fecha:** 2026-11-17.
**Fuente:** `docs/referencias/FarmaFind_Documento_Maestro_v3_0_Consolidado.docx`, Parte A, A1–A12; SHA-256 `CD93097E4378056FDB81E55D41265900947CE66806F58C49A303779C7540E997`.

## Contexto

El responsable aprobó adoptar v3.0 como referencia funcional y arquitectónica principal futura. La Parte B del nuevo documento conserva textualmente el v2.0; sus decisiones históricas, los incrementos F00–F06 y sus aceptaciones TEST/DEMO no se sustituyen. La Constitution v1.2.0 continúa siendo la norma de mayor jerarquía y ya incorpora la numeración nueva. La matriz detallada está en [roadmap-v3-adoption.md](../roadmap-v3-adoption.md).

## Decisión ratificada

1. Usar la Parte A v3.0 como fuente principal para especificar **futuros** incrementos compatibles con la Constitution. Mantener v2.0 como antecedente íntegro, consultable y trazable.
2. Conservar F00–F06. Tratar F06.1 como ampliación nueva; reservar F07 para geolocalización y F08 para frontend profesional. Reetiquetar únicamente en la matriz de trazabilidad el F07 AWS histórico como `F07-LEGACY-AWS` → F09 AWS manual y el F08 histórico de escalabilidad como `F08-LEGACY-SCALE` → F10. Ninguna ruta, rama, commit, ADR o aceptación histórica se renombra.
3. La secuencia nueva F06.1 → F07 → F08 → F09 → F10 rige para el desarrollo futuro según la Constitution v1.2.0; no altera la numeración de artefactos históricos.
4. IA31-03 queda **permitido normativamente como información educativa acotada**: descripciones de clases y opciones de uso habitual asociadas a molestias comunes, con fuentes verificadas y revisión profesional. No permite diagnóstico, prescripción, dosis, tratamiento individual ni usar datos personales para decidir qué debe tomar una persona. Su especificación, plan, contenido y ejecución aún requieren controles y aprobaciones separados.
5. Para F09, conservar la arquitectura AWS prevista y aplicar el control más estricto de A8: preparación técnica documental; ejecución manual por el responsable y autorización individual previa por recurso y costo. Esta ADR no autoriza despliegue, credenciales, facturación ni proveedores.
6. Los prefijos secuenciales de carpetas Spec Kit no equivalen al número funcional: `specs/008-f07-aws-deploy/` conserva el borrador histórico del antiguo F07 AWS como antecedente de F09 y documenta su equivalencia en `LEGACY-NUMBERING.md`; `specs/009-f061-asistente-conversacional/` es el borrador actual F06.1. Evitar nuevas rutas ambiguas.

## Consecuencias y restricciones

- No se altera la aceptación histórica F00–F06 ni se afirma que los nuevos incrementos estén aprobados, implementados o listos para producción.
- Las especificaciones nuevas deben pasar por aprobación de spec y plan según la Constitution. GLO-01 y BOOT-01 continúan limitados a TEST efímero.
- Proveedores de IA, mapas, fuentes farmacéuticas, tratamientos de datos y costos siguen pendientes de decisiones específicas. No se presupone licencia de reutilización de fichas regulatorias.
- `docs/referencias/` está excluido por `.gitignore`: esta ADR registra la fuente y su hash, pero no publica los DOCX. Una copia compartible requiere revisión de derechos y privacidad.
- El resumen «Docker local» de A3 y las propuestas de reservas heredadas en Parte B no alteran los planes y reglas F00/F04 aprobados.

## Ratificación y pendientes

1. La aprobación expresa del responsable consta en el mensaje «FARMAFIND — APROBACIÓN HUMANA EXPRESA DEL DOCUMENTO MAESTRO V3.0» de esta conversación, 2026-11-17; se aplicó a la Constitution v1.2.0 y se registra en [la enmienda](../constitutional-amendment-v3-1.2.0.md).
2. F06.1 requiere aprobación propia de especificación y plan, fuentes farmacéuticas revisadas, pruebas y decisión independiente antes de activar cualquier proveedor externo.
3. Debe decidirse si se publicará una copia revisada del v3.0 para que terceros comprueben la fuente; el documento local permanece protegido.

Esta ADR no aprueba automáticamente la especificación F06.1, su plan ni la implementación.
