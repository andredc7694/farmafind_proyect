# ADR-ROADMAP-V3-002 — Adopción documental controlada del Maestro v3.2

**Estado:** aprobada únicamente para adopción documental por el responsable del proyecto en el mensaje «FARMAFIND — ETAPA 0.2: ADOPCIÓN FORMAL Y CONTROLADA DEL DOCUMENTO MAESTRO V3.2», 2026-11-21. **No es una enmienda constitucional ni autoriza implementación.**

## Contexto y fuentes

El Maestro v3.2 incorpora MEJ-001–MEJ-019 y conserva anexos v3.1/v2.0. Su cuerpo §3.2 repetía una propuesta de recogida de 24 horas que contradice F04-TIME-01, decisión humana posterior: 1–8 horas configurables, 4 por defecto, desde la confirmación y vencimiento fijo por reserva. Constitution XV del árbol local 1.3.0 aún nombra v3.0 como referencia principal; HEAD `df5831e` conserva 1.2.0. La aprobación documental de esta ADR no cambia esa precedencia normativa.

| Archivo | Función | SHA-256 |
|---|---|---|
| `docs/referencias/FarmaFind_Documento_Maestro_v3_2_Integral_Analisis_Arquitectura_AWS_Manual.docx` | Original recibido, intacto. | `39DCFDBE676E8FAC4F512BAA8F49C9A235A0E0887AB40AE2DE6E893A5919414E` |
| `docs/referencias/FarmaFind_Documento_Maestro_v3_2_Original_2026-11-21.docx` | Respaldo versionado idéntico. | `39DCFDBE676E8FAC4F512BAA8F49C9A235A0E0887AB40AE2DE6E893A5919414E` |
| `docs/referencias/FarmaFind_Documento_Maestro_v3_2_Adopcion_Documental_2026-11-21.docx` | Edición corregida para nuevas especificaciones. | `DEAE3087BDB7E595266AC649DA9EA604916712ADF4E5664814B4FD80D84CC8A3` |

`docs/referencias/` está excluido de Git; los hashes hacen identificable la copia local, pero el ADR no publica el contenido del DOCX.

## Decisión documental

1. Usar la **edición documental corregida** de v3.2 como fuente de trabajo para preparar futuros incrementos. Aplicarla siempre subordinada a la Constitution vigente, ADR ratificadas, decisiones humanas específicas y especificaciones ya aprobadas. Hasta ratificar la enmienda 1.4.0, no atribuirle precedencia constitucional plena sobre v3.0. Conservar v3.0/v3.1/v2.0 como precedentes históricos; esta ADR complementa y no reemplaza ADR-ROADMAP-V3-001.
2. Aplicar F04-TIME-01 en el cuerpo §3.2 y en MEJ-014. La preferencia estimada de recogida se limita al horario y al vencimiento real de la reserva; no amplía plazo ni garantiza cita. Las menciones de 24 horas del anexo v2.0 permanecen intactas, acompañadas de una nota de vigencia en §0.
3. Preservar HU01–HU28, RF01–RF47, AC01–AC17, RC01–RC18, DA01–DA16, ADR-01–ADR-12, ADR-P13–ADR-P20 como propuestas, DEC-001 y MEJ-001–MEJ-019 sin renumerar. La [matriz](../trazabilidad-maestro-v3.2.md) enlaza cada MEJ con actor, HU, RF, AC propuesto, módulo, prueba y evidencia pendiente. La adopción de identificadores no demuestra implementación ni aceptación.
4. Adoptar **solo documentalmente** el [roadmap](../roadmap-implementacion-v3.2.md): etapa 0 adopción → etapa 1 cierre F02.5 → F02.1 → F01.1 → F04.1 → F08.1 → pruebas integrales → F09/F10 futuros. Cada incremento exige Spec Kit y aprobación humana de especificación y plan antes de código. F02.5 sigue activa y no aceptada.
5. Mantener DEC-001 como objetivo de US$0 en servicios externos TEST/DEMO. No activar Gemini, correo/SMS/WhatsApp externos, mapas pagados ni AWS. F09 exige estimación y aprobación individual de recursos/costos, despliegue manual, presupuestos, respaldo, verificación y apagado; GitHub Actions no desplegará automáticamente.

## Límites y consecuencias

Permanecen React/Vite/JSX, Express/TypeScript, monolito modular, Clean Architecture, PostgreSQL/RLS, permisos y membresías por farmacia, Redis Cache-Aside, Unit of Work, Transactional Outbox, Notificaciones independientes y contratos OpenAPI. GLO-01/BOOT-01 siguen restringidos a TEST efímero; el administrador general no obtiene acceso implícito a datos privados. FarmaFind AI sigue MOCK por defecto y su contenido farmacológico real conserva la revisión profesional exigida.

Esta ADR **no ratifica Constitution 1.4.0**, no aprueba permisos nuevos ni el diseño final de F01.1/F02.1/F04.1/F08.1, no modifica F02.5, no permite operaciones privilegiadas persistentes, migraciones, proveedores externos, costos, despliegues o cambios en `main`.

La [propuesta de enmienda 1.4.0](../propuesta-adopcion-constitucional-v3.2.md) sigue pendiente de aprobación humana independiente. Los detalles de trabajadores, TOTP/recuperación, F025-RF23, licencias de mapas/correo, fuentes farmacéuticas y cualquier recurso AWS requieren sus decisiones específicas. La [integridad del paquete](../integridad-adopcion-maestro-v3.2.md) registra la comprobación sin afirmar pruebas funcionales nuevas.
