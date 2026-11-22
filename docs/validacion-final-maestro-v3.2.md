# Etapa 0.1 — Validación final documental de FarmaFind v3.2

**Fecha:** 2026-11-21. **Dictamen:** documentación lista para **revisión y aprobación humana**, sin adopción ni implementación automática. No se ejecutaron pruebas, servicios, migraciones, operaciones Git de escritura ni AWS.

## Resultado de la revisión

Se cotejaron el DOCX v3.2 (SHA-256 `39DCFDBE676E8FAC4F512BAA8F49C9A235A0E0887AB40AE2DE6E893A5919414E`), la Constitution local, sus enmiendas, ADR ratificadas, F04-TIME-01, GLO-01/BOOT-01, specs/contratos/modelos/evidencias F01–F08/F06.1/F02.5 y los análisis de etapa 0. La copia independiente v3.1/v2.0 no está actualmente en `docs/referencias/`; sus textos están en los anexos del v3.2. El RAR y el GitHub histórico remoto no se reexaminaron. Por tanto, la trazabilidad histórica independiente se basa en anexos y documentos locales, sin certificar igualdad binaria de copias ausentes.

La [fe de erratas y versión interpretativa corregida](conciliacion-maestro-v3.2.md) identifica **una** contradicción funcional en el cuerpo nuevo: v3.2 §3.2 dice 24 h para CONFIRMADA, mientras F04-TIME-01 fija 1–8 h, 4 por defecto desde confirmación, vencimiento inmutable. Sus tres menciones en el anexo v2.0 se conservan como historia con nota de vigencia propuesta. MEJ-014 solo ofrece una preferencia estimada dentro de horario y vencimiento. No se modificó la lógica F04 ni el DOCX.

## Cobertura y estados

| Elemento | Verificación documental | Estado |
|---|---|---|
| HU01–28, RF01–47, AC01–17, RC01–18, DA01–16 | Identificadores preservados; HU01–06/RF01–13/AC01–09/RC01–11/DA01–09 históricos no se renumeran. | Documentados; los códigos nuevos de v3.2 son propuestas, salvo decisiones específicas aprobadas previamente en sus specs. |
| ADR-01–12, ADR-P13–P20 | 12 históricas conservadas; ocho `ADR-P` siguen propuestas. ADR locales F01/F02.5/F04 y roadmap no se sustituyen. | Ninguna ADR-P ratificada por el DOCX. |
| MEJ-001–019 | [Matriz consolidada](trazabilidad-maestro-v3.2.md) con **19/19** filas, actor, HU, RF, AC propuesto, módulos, prueba y evidencia pendiente. | Cobertura documental completa; no prueba implementación. |
| DEC-001 | Objetivo US$0 para servicios externos TEST/DEMO, especialmente nuevas APIs; mocks/servicios locales. | Propuesta de costo del v3.2 compatible con prohibición vigente de gastos AWS sin permiso. No es garantía de tarifa cero. |
| 16 criterios docentes | Constitution XIV y maestro §17/anexo conservados, con evidencia exigida por incremento. | Sin puntajes ni nuevas pruebas ejecutadas en etapa 0.1. |
| F01–F08/F06.1 | Código y evidencias históricas consultados; F08 registra aceptación humana pendiente; F06.1 conserva límites de fuentes profesionales/mock. | Base reutilizable, no aceptación automática de ampliaciones v3.2. |
| F02.5 | `tasks.md` declara 19/63 marcadas; `evidence.md` contiene avances posteriores. T054/T057/T063 y cierre transversal siguen pendientes; F025-RF23 bloqueada. | Funcionalidad activa TEST/DEMO, **no aceptada**. Reconciliar tareas con evidencias antes de cerrar. |

## Compatibilidad constitucional del borrador 1.4.0

| Control vigente | Resultado del cotejo |
|---|---|
| I, XVII, XVIII: Spec Kit, una funcionalidad activa, aprobación de spec/plan | El [roadmap revisado](roadmap-implementacion-v3.2.md) conserva puertas SDD y exige cerrar/suspender F02.5 antes de otra función. La propuesta constitucional no autoriza código. |
| II–VI: siete módulos, AI complementaria, React/Vite/JSX, Express/TypeScript, Clean Architecture | Las 19 mejoras se asignan a módulos existentes y subincrementos; no se aprueba migración del frontend a TypeScript ni fragmentación del núcleo. |
| VII–X: PostgreSQL, RLS, Redis Cache-Aside, Unit of Work, Outbox, Notificaciones independientes | El borrador preserva fuente oficial, aislamiento por farmacia, fallback y atomicidad. Admin general no obtiene acceso privado por título. |
| XI–XII: AWS objetivo y permiso de gasto | F09 sigue manual; cada recurso, configuración y costo requiere autorización específica. CI puede verificar/compilar, jamás desplegar por sí mismo. |
| XIII–XIV, XIX–XX: pruebas/evidencia, límites clínicos, datos ficticios y secretos | Matriz exige pruebas verificables, datos ficticios y revisión profesional antes de contenido farmacológico real. Gemini/correo externos permanecen apagados. |
| XV–XVI: continuidad histórica y protección de main | La enmienda [propuesta](propuesta-adopcion-constitucional-v3.2.md) cambia solo precedencia futura, aclara F04 y conserva versiones, IDs/ADR y `main`. Requiere aprobación humana formal. |

**Estado de versión:** HEAD `df5831e` contiene Constitution 1.2.0; árbol local contiene 1.3.0 con hash idéntico al de `approval.md` F02.5, pero aún no está integrado. El borrador **1.4.0 no está ratificado**. Antes de aplicarlo, conciliar la base 1.3.0 y aprobar texto, versión, ADR y fecha efectiva. El documento v3.2 original permanece intacto y no se declara referencia principal vigente.

## Decisiones ya expresadas y decisiones que faltan

**Ya expresadas:** F04-TIME-01; DEC-01–03 F02.5 solo TEST/DEMO; delegaciones TEST por farmacia; EXC-01/ROL-01; GLO-01/BOOT-01 solo TEST efímero; admin general por provisión técnica sin UI pública; AWS F09 manual con autorización por recurso; no acceso global a inventario privado; IA mock y límites clínicos; datos ficticios.

**Para adoptar v3.2:** aprobación expresa de (1) precedencia de v3.2 corregido por la fe de erratas, sin reescribir anexos; (2) texto exacto y versión condicional de la [enmienda/ADR](propuesta-adopcion-constitucional-v3.2.md); y (3) orden del [roadmap](roadmap-implementacion-v3.2.md). Esto no aprueba specs/planes de subincrementos ni acepta F02.5.

**Para código posterior, en su momento:** alias frente a correo, vinculación y recuperación de trabajadores, contraseña temporal, TOTP y recuperación del factor, revocación/auditoría detalladas; procedimiento F025-RF23; condiciones/licencias de proveedores de mapas/correo y fuentes farmacológicas; cualquier LLM externo; recursos/costos AWS individuales. Ninguna de estas opciones se implementa ni adquiere permisos por esta etapa.

## Siguiente paso recomendado

Revisar y aprobar expresamente la fe de erratas, el borrador constitucional/ADR y el roadmap. Después registrar la adopción formal con revisión/hash/fecha, sin cambiar aceptaciones anteriores; continuar **solo con F02.5** y conciliar sus tareas/evidencias, completar demostración de cinco farmacias y pedir aceptación humana. Recién después abrir F02.1 mediante Spec Kit. Ninguna fase posterior se inicia por la sola existencia de este informe.
