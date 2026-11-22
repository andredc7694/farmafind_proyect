# Etapa 0 — Conciliación normativa del Documento Maestro v3.2

**Fecha:** 2026-11-21. **Estado:** fe de erratas aplicada a una **copia documental adoptada**, conforme a [ADR-ROADMAP-V3-002](adr/ADR-ROADMAP-V3-002-adopcion-documental-v3.2.md). El original y los anexos históricos permanecen intactos. Esta nota no enmienda la Constitution ni las especificaciones aprobadas; la precedencia constitucional plena de v3.2 sigue pendiente de una enmienda 1.4.0 ratificada.

**Copias identificadas:** original y respaldo `FarmaFind_Documento_Maestro_v3_2_Original_2026-11-21.docx`, ambos SHA-256 `39DCFDBE676E8FAC4F512BAA8F49C9A235A0E0887AB40AE2DE6E893A5919414E`; edición `FarmaFind_Documento_Maestro_v3_2_Adopcion_Documental_2026-11-21.docx`, SHA-256 `DEAE3087BDB7E595266AC649DA9EA604916712ADF4E5664814B4FD80D84CC8A3`. Los tres están en `docs/referencias/`, carpeta excluida de Git.

## Fuentes y precedencia comprobadas

| Fuente | Estado comprobado | Efecto en esta conciliación |
|---|---|---|
| `.specify/memory/constitution.md` | El HEAD `df5831e` contiene **1.2.0**. El árbol de trabajo contiene **1.3.0**, SHA-256 `601F93AC45C4015C89C137A8D4899D86EE8F1E2D07EEDB14DF8A5F44AA5131C4`, idéntico al hash de la aprobación registrada en `specs/012-f025-incorporacion-farmacias/approval.md`. Sigue **sin integrar en Git**. | La conversación y `approval.md` registran aprobación humana de 1.3.0; el estado Git impide tratarla como versión integrada. No editarla ni ratificar v3.2 por inferencia. |
| `docs/adr/ADR-ROADMAP-V3-001-adopcion-controlada.md` | Aprobada para v3.0 y F09 AWS manual; conserva historia F07-LEGACY-AWS/F08-LEGACY-SCALE. | No reescribirla. Una adopción v3.2 requiere enmienda/ADR complementaria, no cambio silencioso de precedencia. |
| `docs/adr/ADR-F025-001-incorporacion-farmacias-propuesta.md` y DEC-01–03 | F02.5 aprobado solo TEST/DEMO; F025-RF23, activación persistente y aceptación final pendientes. | No convertir v3.2 en autorización productiva ni ampliar permisos globales. |
| `specs/002-f01-identidad-multitenant/authorization-decisions.md` | GLO-01/BOOT-01 aprobados para diseño/código y pruebas **solo en bases TEST efímeras**; EXC-01/ROL-01 limitan delegación local. | Administrador general no nace del registro público, no adquiere inventario privado por rol y no se provisiona en base persistente. |
| `specs/005-f04-reservas/spec.md` y `plan.md` | F04-TIME-01 aprobado el 2026-11-13: 1–8 horas, 4 por defecto, desde CONFIRMADA, vencimiento fijo por reserva. | Prevalece sobre la propuesta anterior de 24 horas. MEJ-014 solo añade preferencia estimada; no cambia plazos. |
| Maestro v3.2 original, SHA-256 `39DCFDBE676E8FAC4F512BAA8F49C9A235A0E0887AB40AE2DE6E893A5919414E` | El texto nuevo es §§0–18; contiene anexos v3.1 y v2.0. | La edición corregida se adopta documentalmente en etapa 0.2, subordinada a Constitution y decisiones aprobadas. El original permanece intacto. |

Se leyeron los análisis iniciales `docs/analisis-maestro-v3.2.md` y `docs/roadmap-implementacion-v3.2.md`, además de especificaciones/evidencias F01–F08/F06.1/F02.5, contratos OpenAPI, modelo de datos, ADR y el anexo histórico. No se revalidó el repositorio histórico remoto ni se extrajo el RAR; v3.1 y v2.0 independientes no están hoy en `docs/referencias/`. El documento v3.2 contiene sus textos como anexos, sin que esta nota certifique identidad binaria con las copias originales.

## Errata exacta de reservas, sin alterar historia

La búsqueda de «24 h», «24 horas» y «veinticuatro» en el cuerpo y anexos v3.2 encontró:

| Ubicación v3.2 | Texto del original | Tratamiento en la edición adoptada |
|---|---|---|
| **§3.2, tabla de transiciones, CONFIRMADA → CANCELADA/EXPIRADA** (párrafo XML 95 del original) | «Liberación de compromiso una vez; vencimiento de recogida propuesto 24 h configurable» | «Liberación del compromiso una sola vez; plazo de recogida configurable entre 1 y 8 horas, predeterminado 4 horas, desde CONFIRMADA; vencimiento exacto fijo por reserva, sin ampliación automática por MEJ-014». |
| **Anexo v2.0 §7, RF09** (párrafo 1686) | «recogida 24 h configurable» | **No reescribir el histórico.** Añadir nota de vigencia en la portada/guía v3.2 que remita a F04-TIME-01. |
| **Anexo v2.0 §8, CONFIRMADA** (párrafo 1707) | «plazo inicial de recogida de 24 horas» | **No reescribir el histórico.** La misma nota de vigencia aclara que fue propuesta sustituida el 2026-11-13. |
| **Anexo v2.0 §22, prompt histórico** (párrafo 2070) | «recogida 24 h propuesta» | **No reescribir el prompt histórico.** Si se reutiliza, anteponer la misma advertencia de vigencia. |
| **Constitution, continuidad documental** (líneas 317–319 del árbol de trabajo) | «Las 24 horas ... son una propuesta inicial ... sujeta a validación» | Conservar por ahora: se presenta como propuesta, y F04-TIME-01 es su validación posterior. La futura enmienda v3.2 puede añadir una aclaración sin alterar reglas de F04. |

**Nota de vigencia incorporada a la edición corregida, v3.2 §0:** aclara que los textos de 24 horas del anexo v2.0 son antecedentes no vigentes y que F04-TIME-01 fija de 1 a 8 horas, 4 por defecto, desde la confirmación, con vencimiento fijo; MEJ-014 no lo amplía. La copia original conserva el texto antiguo.

**Lectura normativa de §3.2 que guía la edición adoptada:** «PENDIENTE dispone de plazo de respuesta configurable, inicialmente 20 minutos; puede pasar a CONFIRMADA solo después de comprobación física por personal autorizado, o a CANCELADA/EXPIRADA según el caso. Al confirmar, la farmacia fija para esa reserva un vencimiento de recogida de 1 a 8 horas, por defecto 4, contado desde la confirmación. El vencimiento registrado no cambia al modificar después la configuración. CONFIRMADA puede pasar a ENTREGADA solo antes de vencer; también puede pasar a CANCELADA o EXPIRADA con liberación única del compromiso. ENTREGADA, CANCELADA y EXPIRADA son terminales. La preferencia estimada MEJ-014 debe caber dentro de horario y vencimiento, sin modificar este último ni garantizar disponibilidad física». La edición cambia la celda contradictoria y el criterio MEJ-014, y añade la nota §0; no reescribe el resto de la tabla.

No se cambia la máquina de estados: PENDIENTE → CONFIRMADA/CANCELADA/EXPIRADA; CONFIRMADA → ENTREGADA/CANCELADA/EXPIRADA; ENTREGADA, CANCELADA y EXPIRADA son terminales. Creación, confirmación física, compromiso/liberación única, Outbox y autorización/RLS de F04 permanecen intactos.

## Otras diferencias y resolución propuesta

| Asunto | Fuente v3.2 | Norma/decisión vigente y resolución |
|---|---|---|
| Precedencia v3.2 | §0, §15: fuente principal futura tras adopción. | [ADR-ROADMAP-V3-002](adr/ADR-ROADMAP-V3-002-adopcion-documental-v3.2.md) autoriza su uso documental subordinado. Constitution XV sigue nombrando v3.0 como principal; cambiar la precedencia normativa exige ratificación independiente de [enmienda 1.4.0](propuesta-adopcion-constitucional-v3.2.md). |
| Frontend TypeScript eventual | §9.2 lo condiciona a ratificación. | Constitution IV exige React + Vite + JavaScript/JSX. No hay contradicción operativa mientras siga como hipótesis; ninguna fase v3.2 autoriza migrar a TS. |
| Cuenta de trabajador con alias y clave temporal | §§2.2, 6, MEJ-016; vinculación de cuenta existente. | F01 usa correo/contraseña y sesión; EXC-01/ROL-01 autorizan únicamente delegación local. Diseño de alias, recuperación, aceptación de vínculo, revocación y auditoría requiere spec/plan y decisiones de seguridad antes de código. No crear cuenta compartida ni correo ficticio entregable. |
| TOTP y verificación real | §6 RF40–41, MEJ-017. | Propuestas nuevas. En TEST, simulación local; correo externo y mecanismo de recuperación exigen aprobación independiente. TOTP admin no autoriza administradores persistentes. |
| Administradores globales | §2.3, RF37, MEJ-015. | Compatible con BOOT-01/GLO-01 **solo TEST efímero**. No panel de creación, permiso global genérico ni acceso a inventario/reservas de farmacias. |
| F02.5 frente a v3.2 | §12 y anexo v3.1. | F02.5 ya tiene spec/plan aprobados TEST, pero `tasks.md` declara 19/63 y aceptación humana pendiente. Su cierre antecede un nuevo incremento activo. Suspensión F025-RF23 sigue bloqueada. |
| IA/fuentes/mapas/correo | §§9–11, MEJ-006/010/012/017. | F06.1 mock y datos públicos; contenido farmacológico real requiere fuente autorizada/revisión profesional. Mapas/geocoder sujetos a condiciones; Gemini y correo externo desactivados. |
| Costos y AWS | DEC-001, §14, RF46–47. | Presupuesto objetivo US$0 para **servicios externos TEST/DEMO**, incluidas nuevas APIs; no equivale a gratuidad garantizada. Gemini de pago, mapas de pago, correo externo, SMS, WhatsApp Business y AWS siguen desactivados. F09 manual, con autorización previa individual de recurso, región, operación y costo; CI solo verifica/compila. |

## Conservación de identificadores y evidencia académica

Se preservan sin renumeración **HU01–HU28, RF01–RF47, AC01–AC17, RC01–RC18, DA01–DA16, ADR-01–ADR-12, ADR-P13–ADR-P20 (solo propuestas), MEJ-001–MEJ-019 y DEC-001**. Los IDs F025-RFxx son propios de F02.5 y no equivalen automáticamente a RFxx transversal v3.2. La [matriz propuesta](trazabilidad-maestro-v3.2.md) conserva las 19 mejoras y los 16 criterios docentes como obligaciones de trazabilidad; no asigna calificaciones ni resultados sin prueba.

**Estado de Git anterior a esta etapa:** rama `feat/f025-incorporacion-farmacias`, HEAD `df5831e`, 47 entradas preexistentes en `git status --porcelain`; incluyen Constitution modificada, código F02.5/F04 y la eliminación local de la copia v3.0. Se conservaron sin restauración ni edición. Ninguna conclusión sobre aceptación F02.5 surge de las evidencias técnicas parciales.
