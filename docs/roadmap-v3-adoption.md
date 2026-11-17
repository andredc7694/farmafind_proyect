# Adopción documental controlada del Documento Maestro v3.0

**Fecha de revisión y aprobación:** 2026-11-17. **Estado:** adoptado expresamente como referencia funcional y arquitectónica principal para incrementos futuros y recogido en la Constitution v1.2.0. No constituye aprobación de especificaciones nuevas, proveedores, despliegues ni contenidos clínicos concretos.

## Integridad y precedencia

- Fuente nueva: `docs/referencias/FarmaFind_Documento_Maestro_v3_0_Consolidado.docx`, SHA-256 `CD93097E4378056FDB81E55D41265900947CE66806F58C49A303779C7540E997`. El DOCX se abrió como archivo Office válido; se leyeron sus 19 entradas ZIP y 1 258 párrafos no vacíos. La Parte A contiene las secciones A1–A12 y la Parte B, el antecedente v2.0.
- Fuente histórica preservada sin cambios: `docs/referencias/FarmaFind_Documento_Maestro_Definitivo_AWS_Multitenant_SDD.docx`, SHA-256 `761E59CF403C0D153C8FCBBE535F48F991BDD3789E8F2ECA0E20DD76CF3FAF05`. El texto no vacío de la Parte B del v3.0 coincide línea a línea con los 927 párrafos no vacíos extraídos del v2.0. Esta comparación textual no reemplaza una comparación de formato o contenido multimedia.
- Ambos DOCX están bajo `docs/referencias/`, ruta excluida por `.gitignore`; esta nota versionable registra sus huellas y ubicación local, pero el repositorio remoto no contendrá los archivos fuente salvo decisión posterior de publicación segura. No forzar su inclusión sin revisar derechos y privacidad.
- Precedencia: Constitution v1.2.0 ratificada → decisiones humanas específicas y enmiendas aprobadas → v3.0 Parte A en lo compatible → v2.0 como antecedente histórico. La Parte B preserva el contexto; sus etiquetas F07/F08 se desambiguan mediante la matriz siguiente.

## Equivalencias y regla de identificadores

| Identificador histórico | Identificador vigente para nuevos incrementos | Tratamiento |
| --- | --- | --- |
| F00–F06 | F00–F06 | Preservar specs, tareas, evidencia y aceptaciones TEST/DEMO en su alcance original. |
| Sin equivalente | F06.1 — IA conversacional farmacéutica | Nueva ampliación de F06, con especificación y aprobación propias. |
| Sin equivalente | F07 — Geolocalización de farmacias | Nuevo incremento; no confundir con `F07-LEGACY-AWS`. |
| Sin equivalente | F08 — Frontend profesional completo | Nuevo incremento; no confundir con `F08-LEGACY-SCALE`. |
| F07 — AWS deploy | F09 — Despliegue manual AWS | Conservar referencias históricas como `F07-LEGACY-AWS`; no renombrar rama, commit ni spec existente. |
| F08 — Escalabilidad/evidencias | F10 — Escalabilidad y evidencias finales | Conservar referencias históricas como `F08-LEGACY-SCALE`. |

Los prefijos secuenciales de carpeta de Spec Kit (`008-`, `009-`, etc.) son identificadores de directorio y **no equivalen** a F08/F09. `specs/008-f07-aws-deploy/` ya existe localmente sin seguimiento de Git al efectuar esta revisión; se conserva intacto y se interpreta como documentación del antiguo F07 AWS, no como la nueva geolocalización. `specs/009-f061-asistente-conversacional/` es el borrador activo F06.1. No crear ni renombrar rutas nuevas F07–F10 hasta iniciar cada incremento con su aprobación SDD y una convención sin colisiones.

## Compatibilidad normativa y puertas pendientes

| Asunto | Parte A v3.0 | Constitution v1.2.0 / antecedente v2.0 | Estado y acción |
| --- | --- | --- | --- |
| Información sobre molestias | A2 y A5, IA31-03 proponen describir clases farmacológicas para síntomas generales. | Maestro v2.0, cap. 9, prohíbe recomendar tratamientos; Constitution III/XIX enmendada permite solo la excepción educativa acotada. | **Norma aprobada, implementación pendiente.** Exige fuentes verificadas, revisión profesional, especificación/plan propios y pruebas antes de exponer contenido a usuarios. |
| Nueva secuencia F06.1 → F07 → F08 → F09 → F10 | A3 y A10 cambian prioridades y nombres de incrementos futuros. | Constitution XV y continuidad documental enmendadas preservan v2.0 y los IDs anteriores. | **Aprobada para incrementos futuros**; no renombrar historia ni confundir prefijos de carpetas con IDs funcionales. |
| AWS manual F09 | A8 exige ejecución manual por el responsable, aprobación por recurso y sin deploy automático. | Constitution XI/XII enmendada conserva la arquitectura AWS y exige autorización específica previa. | **Aprobado como regla**, sin autorización para crear recursos. F09 requerirá ADR/plan y permisos individuales. |
| Proveedor IA, fuentes farmacéuticas y mapas | A5/A6 enumeran opciones y verificaciones de licencia, privacidad, costo y consentimiento. | Constitution III, XIX, XX y XII exigen control de datos, límites clínicos y aprobación de costos. | Propuestas, **no seleccionadas**. Requieren decisiones específicas, revisión profesional/licencias y aprobación de gasto/privacidad antes de activación. |
| Aceptaciones y datos TEST | A2/A4 preservan F00–F06 y GLO-01/BOOT-01 solo en TEST efímero. | Aprobaciones históricas y límites vigentes de F01. | Compatible. No extender aceptación TEST/DEMO a producción ni a F06.1–F10. Verificar hashes y pruebas reales antes de nuevos cierres. |
| Docker en F00 y plazos heredados | A3 resume Docker local; la Parte B conserva propuestas antiguas de reservas. | Plan F00 aprobado difería Docker en su arranque; F04 aprobó 1–8 h, predeterminado 4 h desde confirmación. | Leer estos pasajes como resumen/antecedente, **no como cambio retroactivo** de F00 o F04. Una actualización funcional requeriría nueva especificación y aprobación. |

## Pasos mínimos de formalización

1. La [ADR de adopción](adr/ADR-ROADMAP-V3-001-adopcion-controlada.md) y el [registro de enmienda 1.2.0](constitutional-amendment-v3-1.2.0.md) documentan la aprobación expresa del 2026-11-17, sin reescribir ADR-01–ADR-12 ni decisiones históricas.
2. Antes de activar IA31-03, verificar fuentes y revisión profesional; la excepción normativa ya está aprobada, pero no sus contenidos ni su implementación.
3. Aclarar y aprobar la especificación F06.1 antes de elaborar su plan; ninguna aprobación de v3.0 equivale a aprobación de esa spec.
4. Crear nuevas specs F07/F08/F09/F10 únicamente al iniciar cada incremento conforme a Constitution XVII y los puntos de control SDD, usando identificadores sin colisión.
5. Mantener sin despliegue AWS, proveedores de IA pagos, migraciones persistentes ni cambios a `main` hasta autorizaciones específicas.
6. Resolver cómo conservar una copia accesible y aprobada de v3.0 para revisores del repositorio, pues `docs/referencias/` permanece fuera de Git; no publicar automáticamente los DOCX privados.
