# Data Model: F06 — Asistente IA informativo

F06 no persiste entidades. Los siguientes modelos viven durante una solicitud.

## AssistantQuery

| Campo | Regla |
|---|---|
| text | Español, normalizado, 1–500 caracteres |
| correlationId | UUID generado por servidor |
| originKey | clave efímera para rate limit; nunca se devuelve ni persiste |

## ValidatedIntent

| Campo | Regla |
|---|---|
| kind | `BUSQUEDA`, `COMPARACION`, `AYUDA`, `CLINICA_RECHAZADA` |
| term | término público opcional, 1–120 caracteres |
| order | `precio`, `revision` o valor público permitido por F03 |
| pharmacyId | UUID opcional; solo se resuelve mediante proyección pública |

## ToolInvocation

| Campo | Regla |
|---|---|
| tool | allowlist de tres nombres |
| arguments | estructura validada, sin SQL ni identificadores privados |
| result | DTO público F03, máximo 20 elementos |
| durationMs | entero no negativo para métrica técnica |

## GroundedAnswer

| Campo | Regla |
|---|---|
| intent | intención validada |
| answer | texto español construido solo con resultados o límite seguro |
| sources | fuentes públicas estructuradas usadas realmente |
| notice | disponibilidad/precio referenciales o límite clínico |
| provider | constante `mock` en F06 |
| correlationId | correlación sin contenido sensible |

## Transitions

`RECEIVED → RATE_LIMITED | INVALID | CLINICAL_BLOCKED | CLASSIFIED → TOOLS → ANSWERED`

Los estados son observabilidad efímera; no existe historial persistente F06.
