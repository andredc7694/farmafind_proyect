# Requirements Quality Checklist: F00 — Bootstrap de FarmaFind

**Purpose**: Evaluar completitud, claridad, coherencia, cobertura y trazabilidad de la
especificación y planificación F00, sin comprobar una implementación ni alterar sus requisitos.
**Created**: 2026-11-10
**Feature**: [spec.md](../spec.md), [plan.md](../plan.md)
**Depth / Audience / Timing**: Revisión documental integral, de rigor estándar, para el
revisor humano antes de aprobar el plan y autorizar fases posteriores.

**Note**: Checklist personalizado generado mediante speckit-checklist; el encargo solicita
expresamente una evaluación asistida. No es un plan de pruebas ni una lista de tareas.
**Review Ownership**: Las casillas pertenecen al revisor humano. Todos los elementos
nuevos se dejan sin marcar. La evaluación preliminar escrita por el agente no sustituye
la decisión del revisor ni autoriza que otra fase marque las casillas automáticamente.
**Marker Semantics**: Una futura marca de revisión significa calidad de requisitos
satisfecha, nunca código terminado, prueba pasada o aceptación de F00 completada.

Se distinguen dos ejes: **Satisfecho documentalmente** / **Necesita revisión** describen
calidad de lo escrito; **Pendiente de ejecución** describe ausencia de evidencia runtime.
Un criterio documental satisfecho puede y suele conservar verificaciones pendientes.
En esta revisión no se ejecutaron comprobaciones de aplicaciones ni se generaron reportes
de pruebas. No hay preguntas adicionales de alcance: el encargo define temas y límites.

## Requirement Completeness

- [ ] CHK001 ¿Están identificados los 20 requisitos, sus comprobaciones de aceptación y los siete criterios de éxito sin omisiones ni renumeración histórica? [Completitud, Spec §Functional Requirements y §Measurable Outcomes; Evidencia §Los 20 requisitos F00 y §Criterios de éxito] — **Evaluación: Satisfecho documentalmente.**
- [ ] CHK002 ¿Es explícita la correspondencia entre cada requisito, su escenario de usuario y su criterio de éxito, evitando que el revisor deba inferir el cruce completo? [Trazabilidad, Gap, Spec §User Scenarios & Testing, §Functional Requirements y §Measurable Outcomes; Evidencia §Los 20 requisitos F00] — **Evaluación: Necesita revisión; H01.**
- [ ] CHK003 ¿Están delimitadas la entrega documental actual, el bootstrap técnico futuro y las funcionalidades de negocio excluidas, sin convertir planificación en implementación? [Completitud, Spec §Scope Boundaries/F00-FR-019; Plan §Summary y §Límites de dependencia y ampliación] — **Evaluación: Satisfecho documentalmente.**
- [ ] CHK004 ¿Están descritos los tres componentes técnicos y el alcance independiente de Notificaciones sin adelantar envío de mensajes o procesamiento de eventos? [Completitud, Spec §F00-FR-004/005/012; Plan §Project Structure; OpenAPI §info.description] — **Evaluación: Satisfecho documentalmente.**

## Requirement Clarity

- [ ] CHK005 ¿Está inequívocamente definido Windows 10 como entorno principal de desarrollo, con las referencias observadas de herramientas y sin exigir migración de SO? [Claridad, Plan §Target Platform; Investigación §R01; Configuración §introducción] — **Evaluación: Satisfecho documentalmente.**
- [ ] CHK006 ¿Está escrita la diferencia entre el alcance de verify:local y el de verify:bootstrap, sin interpretar un éxito parcial como aceptación completa? [Claridad, Configuración §Scripts npm propuestos y §Salidas y seguridad; Validación §Ámbitos y evidencia] — **Evaluación: Satisfecho documentalmente.**
- [ ] CHK007 ¿Define la documentación el resultado observable de pantalla y salud técnica, distinguiéndolo de una compilación satisfactoria, disponibilidad HTTP estática o proceso activo? [Claridad, Spec §F00-FR-013/018 y F00-SC-002; Validación §Aserciones observables] — **Evaluación: Satisfecho documentalmente.**
- [ ] CHK008 ¿Están definidos los estados pendientes de navegador por plataforma sin atribuir soporte oficial de Playwright a Windows 10? [Claridad, Investigación §R01/R06/R08; Validación §Grupo completo; Evidencia §Resultado local frente a aceptación completa] — **Evaluación: Satisfecho documentalmente.**

## Requirement Consistency

- [ ] CHK009 ¿Son consistentes la ratificación de la Constitución, la aprobación de la especificación y la condición de propuesta del plan, sin inferir autorización de código? [Consistencia, Constitución §Governance y metadatos; Spec §Status/Approved; Plan §Estados de decisión] — **Evaluación: Satisfecho documentalmente.**
- [ ] CHK010 ¿Reflejan las notas de seguimiento de todos los documentos el estado actual de la armonización, en vez de presentar como pendientes ajustes ya incorporados? [Consistencia, Conflict, Plan §Coherencia de documentos complementarios; Investigación §R08; Quickstart §introducción; Evidencia §Continuidad histórica y cierre documental] — **Evaluación: Necesita revisión; H02.**
- [ ] CHK011 ¿Son coherentes las restricciones de stack y las dependencias hacia abstracciones internas entre la especificación, el plan y las propuestas físicas? [Consistencia, Constitución IV–VI; Spec §F00-FR-002/003; Plan §Technical Context y §Structure Decision] — **Evaluación: Satisfecho documentalmente.**
- [ ] CHK012 ¿Se mantienen exactamente los siete módulos originales, con FarmaFind AI separada como ampliación futura y Notificaciones como servicio independiente? [Consistencia, Constitución II/III/X; Spec §F00-FR-004/005; Plan §Source Code y §Límites de dependencia y ampliación] — **Evaluación: Satisfecho documentalmente.**

## Acceptance Criteria Quality

- [ ] CHK013 ¿Los siete criterios de éxito expresan resultados verificables y límites de evidencia, sin que escribir documentos se considere cumplimiento runtime? [Medibilidad, Spec §Measurable Outcomes; Evidencia §Criterios de éxito] — **Evaluación: Satisfecho documentalmente.**
- [ ] CHK014 ¿Están cuantificados los límites de arranque, respuesta, aserción y limpieza como propuestas técnicas, sin confundirlos con los atributos de calidad del producto? [Medibilidad, Plan §Performance Goals; Validación §Tiempos y reportes; Constitución §escenarios AC01–AC09] — **Evaluación: Satisfecho documentalmente.**
- [ ] CHK015 ¿Está especificada la reproducibilidad con dos preparaciones limpias independientes de una misma revisión, permitiendo la misma persona y exigiendo registros propios completos? [Medibilidad, Spec §F00-FR-001/F00-SC-001 y segunda aclaración; Quickstart §Preparaciones limpias A y B; Validación §Tiempos y reportes] — **Evaluación: Satisfecho documentalmente.**
- [ ] CHK016 ¿Se conserva expresamente la obligatoriedad de UI y demás comprobaciones de ambas preparaciones, incluso cuando la plataforma impida completarlas todavía? [Consistencia, Spec §F00-FR-013/F00-SC-001/002/007; Configuración §Salidas y seguridad; Evidencia §Criterios de éxito] — **Evaluación: Satisfecho documentalmente.**

## Scenario Coverage

- [ ] CHK017 ¿Están documentados los recorridos principales de preparación, configuración, reconocimiento de límites y revisión humana con sus resultados esperados? [Cobertura, Spec §User Stories 1–4] — **Evaluación: Satisfecho documentalmente.**
- [ ] CHK018 ¿Están diferenciados el recorrido alternativo local Windows 10 y el recorrido completo posterior, sin reemplazar el segundo por el primero? [Cobertura, Plan §Estrategia de validación y dos preparaciones; Quickstart §Dos ámbitos de verificación; Validación §Orquestación y separación] — **Evaluación: Satisfecho documentalmente.**
- [ ] CHK019 ¿Se describe qué evidencia permanece pendiente cuando no hay plataforma o navegador compatibles, sin bloquear injustificadamente el grupo local? [Cobertura de excepción, Investigación §R08; Configuración §Salidas y seguridad; Validación §Grupo completo] — **Evaluación: Satisfecho documentalmente.**
- [ ] CHK020 ¿Están documentadas la recuperación tras parada controlada, la conservación del fallo previo y la necesidad de una revisión común al repetir preparaciones? [Cobertura de recuperación, Validación §Orquestación y separación/§Tiempos y reportes; Quickstart §Preparaciones limpias A y B] — **Evaluación: Satisfecho documentalmente.**

## Edge Case Coverage

- [ ] CHK021 ¿Los requisitos de colisión de puertos distinguen rechazo, identidad del proceso y protección de procesos ajenos, sin cambios de puerto silenciosos? [Cobertura de límites, Spec §Edge Cases; Configuración §Configuración por componente; Validación §Negativos mínimos] — **Evaluación: Satisfecho documentalmente.**
- [ ] CHK022 ¿Se definen ausencia, invalidez y precedencia de configuración sin exponer valores privados ni habilitar integraciones futuras accidentalmente? [Cobertura de errores, Spec §User Story 2/F00-FR-007/008; Configuración §Configuración por componente] — **Evaluación: Satisfecho documentalmente.**
- [ ] CHK023 ¿Se distingue copia limpia de simple repetición de controles y se documentan rutas con espacios, herramientas ausentes y ausencia de servicios externos? [Cobertura de límites, Spec §Edge Cases; Quickstart §Prerrequisitos y §Preparaciones limpias A y B] — **Evaluación: Satisfecho documentalmente.**
- [ ] CHK024 ¿Están especificadas la interrupción, la limpieza acotada de procesos propios y la prohibición de ocultar errores o tratar un cierre incompleto como éxito? [Cobertura de recuperación, Configuración §Salidas y seguridad; Validación §Orquestación y separación/§Tiempos y reportes] — **Evaluación: Satisfecho documentalmente.**

## Non-Functional Requirements

- [ ] CHK025 ¿Están documentadas minimización, configuración pública/privada, ejemplos ficticios y exclusión de secretos o datos personales en registros y evidencias? [Seguridad y privacidad, Constitución XX; Spec §F00-FR-007/008/020; Configuración §Configuración por componente y §Salidas y seguridad] — **Evaluación: Satisfecho documentalmente.**
- [ ] CHK026 ¿Está descrita la obligación futura de PostgreSQL/RLS y autorización por farmacia sin presentar preparación documental como aislamiento de datos implementado? [Seguridad y límites, Constitución VII/VIII; Spec §F00-FR-009/010; Plan §Límites de dependencia y ampliación] — **Evaluación: Satisfecho documentalmente.**
- [ ] CHK027 ¿Se conservan Redis Cache-Aside, Unit of Work y Outbox como decisiones posteriores, separadas de la salud técnica sin dependencias? [Consistencia arquitectónica, Constitución IX/X; Spec §F00-FR-011/012; Evidencia §Continuidad histórica y cierre documental] — **Evaluación: Satisfecho documentalmente.**
- [ ] CHK028 ¿Quedan explícitos Docker y AWS como obligaciones arquitectónicas posteriores, sin recursos creados ni exigencia de Ubuntu para F00? [Restricciones, Constitución XI/XII; Spec §F00-FR-015; Plan §Summary; Configuración §Preparación para etapas posteriores] — **Evaluación: Satisfecho documentalmente.**

## Dependencies & Assumptions

- [ ] CHK029 ¿La documentación diferencia versiones observadas, dependencias propuestas y compatibilidad por declaraciones, sin afirmar instalación, seguridad o validación runtime por consultar fuentes? [Dependencias, Investigación §R01; Plan §Technical Context y §Riesgos y autorizaciones] — **Evaluación: Satisfecho documentalmente.**
- [ ] CHK030 ¿Está diferenciada la preparación autorizada con posibles descargas de las comprobaciones locales que no admiten descargas ni proveedores externos? [Dependencias, Investigación §R02/R06; Quickstart §Prerrequisitos; Configuración §Scripts npm propuestos] — **Evaluación: Satisfecho documentalmente.**
- [ ] CHK031 ¿Está declarado el entorno compatible de navegador como dependencia pendiente de disponibilidad y autorización, sin asumir un equipo o runner ya existentes? [Supuestos, Plan §Riesgos y autorizaciones; Quickstart §Pruebas de navegador pendientes; Evidencia E-F00-05] — **Evaluación: Satisfecho documentalmente.**
- [ ] CHK032 ¿Se distinguen preparación de comandos reutilizables y trabajo posterior de CI/CD, carga y negocio, sin atribuir cumplimiento por solo nombrar herramientas? [Límites, Spec §F00-FR-014; Plan §Calidad y CI/CD posterior; Evidencia §Los 16 criterios docentes] — **Evaluación: Satisfecho documentalmente.**

## Ambiguities & Conflicts

- [ ] CHK033 ¿Están preservados los 16 títulos docentes con contribución y exclusión de F00, sin ponderaciones, calificaciones o evidencias inventadas? [Trazabilidad, Spec §Traceability to the 16 Evaluation Criteria; Evidencia §Los 16 criterios docentes; Constitución XIV] — **Evaluación: Satisfecho documentalmente.**
- [ ] CHK034 ¿Está formalmente definida y compartida la combinación de scope, local, overall y acceptance para resultados parciales, errores reales, prerrequisitos pendientes y cierre global? [Claridad, Ambiguity, Modelo técnico §Registro de verificación; Configuración §Salidas y seguridad; Validación §Tiempos y reportes; Evidencia §Resultado local frente a aceptación completa] — **Evaluación: Necesita revisión; H03.**
- [ ] CHK035 ¿Se distinguen la relación operativa aprobada entre repositorios y los pendientes de regularización de RC04/ADR, manteniendo intactos los IDs históricos? [Consistencia, Spec §Clarifications/D01 y §Pending Human Decisions; Constitución XV y TODO(DOCUMENTATION_LAYOUT); Plan §Constitution Check] — **Evaluación: Satisfecho documentalmente.**
- [ ] CHK036 ¿Está inequívoca la frontera entre aprobación de documentos, revisión humana de este checklist y evidencia obligatoria aún pendiente, sin habilitar automáticamente otras fases? [Gobernanza, Constitución I/XVIII; Spec §Approved; Plan §Status; Evidencia §Continuidad histórica y cierre documental] — **Evaluación: Satisfecho documentalmente.**

## Notes

- **Resultado preliminar solicitado:** 36 criterios de calidad; 33 satisfechos
  documentalmente y 3 que necesitan revisión. Las 36 casillas permanecen sin marcar
  para el revisor. Esos números no son porcentaje de implementación ni de aceptación.
- speckit-implement puede leer el estado de estas casillas como gate, pero no debe
  modificarlas. No se invocó esa habilidad ni tasks/converge en esta revisión.
- checklists/requirements.md tiene un ciclo separado, mantenido por specify/clarify;
  no se crea ni se modifica como parte de este checklist personalizado.
- Todos los criterios tienen referencia documental; no se necesitan preguntas de
  alcance adicionales. Los hallazgos se registran sin corregir los documentos fuente.

### Hallazgos que necesitan revisión humana

| Hallazgo | Ítem | Evidencia documental | Revisión recomendada, sin aplicar cambios |
|---|---|---|---|
| H01 — Cruce de trazabilidad disperso | CHK002 | Cada FR tiene comprobación propia y la matriz de evidencia cubre 20 FR y 7 SC, pero no hay una correspondencia única y explícita FR ↔ escenario de User Story ↔ SC. La relación debe inferirse entre secciones. | Revisar si se formaliza ese cruce para facilitar auditoría. Es una mejora de auditabilidad, no ausencia de los requisitos ni autorización para cambiarlos. |
| H02 — Notas de armonización desactualizadas | CHK010 | Plan §Coherencia de documentos complementarios todavía dice “Se identifican ajustes documentales necesarios”; Investigación R08 dice “Su armonización documental queda pendiente”; Quickstart indica ajustes sin aplicar. Evidencia §cierre documenta que los tres complementarios ya se armonizaron. | Distinguir expresamente esas notas como antecedentes o actualizar su seguimiento cuando se autorice. No se detecta por ello reducción de criterios operativos; sí un estado documental ambiguo. |
| H03 — Estados de reporte no formalizados en una tabla común | CHK034 | El modelo enumera overall pending/passed/failed; los contratos añaden scope/local/acceptance y distinguen no ejecutado de fallo real. No hay una tabla única de combinaciones válidas, obligatoriedad y agregación entre control, ejecución y pareja A/B. | Acordar un contrato de reporte conceptual común que preserve local passed con aceptación pendiente y haga inequívoco cómo se conservan fallos reales junto a pendientes. No se afirma que hoy exista un falso positivo implementado. |

Ningún hallazgo autoriza modificar los requisitos aprobados o rebajar la aceptación.
La recomendación es revisión humana del plan y de los hallazgos antes de autorizar
trabajo posterior. Esta generación no certifica que el plan haya recibido aprobación.

### Ejecuciones pendientes — información, no pruebas de esta checklist

Esta tabla mantiene visible el segundo eje solicitado. No contiene casillas de pruebas,
instrucciones de QA, comandos nuevos ni evidencia de una ejecución realizada.

| Área | Estado documental | Estado de ejecución que permanece pendiente |
|---|---|---|
| Configuración, compilación, contratos HTTP y procesos locales Windows 10 | Requisitos y límites definidos en CHK005/006/017/021–024/030. | Sin implementación o ejecuciones acreditadas; E-F00-02/03/04 y parte local de E-F00-06 pendientes. |
| Pantalla real y negativos Playwright, separación con UI | Obligatoriedad y dependencia documentadas en CHK007/008/016/019/031. | E-F00-05 y parte completa de E-F00-06 pendientes de entorno oficialmente compatible y ejecución. Windows 10 no se declara soportado oficialmente para Playwright. |
| Preparaciones limpias A/B y reproducibilidad completa | Exigencia y registros definidos en CHK015/016/020/023. | E-F00-07/08 y cierre de F00-SC-001/002/007 pendientes; dos reportes parciales no completan aceptación. |
| Seguridad, límites arquitectónicos y revisión del bootstrap real | Reglas presentes en CHK011/012/025–028/035. | Comprobación sobre una implementación futura y evidencias reales pendientes; este examen solo revisa la redacción. |
| Integraciones y criterios globales del producto | Posteriores a F00 y expresamente delimitados. | RLS real, Redis, Outbox, IA, Docker, AWS, carga, CI/CD remoto y negocio no se declaran realizados ni se adelantan a esta feature. |

### Fuentes de esta revisión

- [Constitución ratificada v1.1.0](../../../.specify/memory/constitution.md).
- [Especificación aprobada y aclarada](../spec.md), [plan corregido](../plan.md),
  [investigación](../research.md) y [guía de preparación A/B](../quickstart.md).
- [Modelo técnico](../data-model.md), [OpenAPI técnico](../contracts/bootstrap.openapi.yaml),
  [contrato de configuración](../contracts/local-configuration.md),
  [contrato de validación](../contracts/validation.md) y
  [trazabilidad de evidencia](../evidence-traceability.md).

Solo se crea este checklist. Las fuentes, la Constitución y el plan permanecen intactos;
no hay código, instalaciones, infraestructura, commits o cambios en main.

## Seguimiento de correcciones documentales — 2026-11-10

Las evaluaciones y notas anteriores describen la generación inicial de esta checklist.
El encargo posterior autorizó corregir los tres hallazgos en los documentos fuente.
Se conserva ese diagnóstico como antecedente, incluidas las 36 casillas sin marcar;
el siguiente registro no constituye aprobación humana ni evidencia de ejecución.

| Hallazgo / criterio exacto | Corrección documental incorporada | Estado de revisión |
|---|---|---|
| H01 / CHK002 | La matriz de [trazabilidad](../evidence-traceability.md) relaciona cada uno de los 20 requisitos con los escenarios existentes, mediante alias USn.m, y con los criterios F00-SC existentes. Conserva las comprobaciones propias de cada requisito y no modifica spec.md. | Corrección incorporada; pendiente de revisión humana. |
| H02 / CHK010 | [Plan](../plan.md), [investigación](../research.md), [guía](../quickstart.md) y [trazabilidad](../evidence-traceability.md) distinguen los encargos anteriores de la armonización ya realizada. Se retiran las afirmaciones vigentes de ajustes pendientes que ya fueron incorporados. | Corrección incorporada; pendiente de revisión humana. |
| H03 / CHK034 | El [contrato común de estados](../data-model.md#contrato-común-de-estados-y-agregación) define scope, local, overall y acceptance por control, ejecución y par A/B. Los contratos de [configuración](../contracts/local-configuration.md) y [validación](../contracts/validation.md), el plan, la guía, la investigación y la trazabilidad comparten esas reglas. | Corrección incorporada; pendiente de revisión humana. |

Windows 10 permanece como entorno principal. Playwright sigue siendo obligatorio para
la aceptación completa y pendiente de ejecución en un entorno oficialmente compatible.
La aceptación técnica requiere dos preparaciones completas independientes A/B con
evidencia verificable; ni esta corrección ni dos resultados solo locales la acreditan.
Los 20 requisitos, las aclaraciones, los siete criterios de éxito, la trazabilidad de los
16 criterios docentes y la Constitución ratificada se conservan. No se ejecutaron pruebas
de aplicación ni se generaron código, dependencias, contenedores o infraestructura.
La aprobación del plan completo y de estas correcciones corresponde al revisor humano.

## Registro posterior de aprobación documental — 2026-11-10

El usuario aprobó expresamente el plan corregido y sus documentos complementarios,
con las condiciones registradas en [plan.md](../plan.md). La invocación posterior expresa
de speckit-tasks autoriza únicamente generar tareas documentales de F00. Este registro
conserva los diagnósticos y seguimientos anteriores como antecedentes, sin marcar las
36 casillas. No acredita implementación, pruebas, aceptación completa o regularización
de RC04/ADR. Playwright y las dos preparaciones completas siguen pendientes.
