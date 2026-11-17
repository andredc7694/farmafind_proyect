# ADR-F06-001 — Asistente informativo basado en herramientas públicas

**Estado:** Aprobada expresamente junto con F06 el 2026-11-16.
**Fecha:** 2026-11-16.
**Decisión nueva:** complementa, no reemplaza, ADR-01–ADR-12 históricos.

## Contexto

El Maestro exige un asistente informativo, sin autoridad clínica ni acceso libre a datos.
Debe funcionar sin proveedor pagado y permitir una integración futura controlada.

## Decisión propuesta

Crear `asistente-ia` como módulo del monolito con Clean Architecture. Un orquestador valida
intención y llama exclusivamente puertos de herramientas públicas F03. `AIProvider` será
un puerto; `MockAIProvider` será la única implementación operativa de F06. La salida se
construye con resultados de herramientas, avisos y reglas clínicas. Ningún proveedor real,
clave, red externa, persistencia de prompts ni herramienta de escritura forma parte de F06.

## Consecuencias

- Pruebas deterministas, sin costo ni dependencia externa.
- Grounding verificable y superficie de datos limitada a F03.
- Un proveedor futuro requiere nueva especificación, revisión de privacidad/costo,
  autorización humana y una implementación del puerto sin debilitar políticas.
- El endpoint público exige rate limit, límites de tamaño, timeout, correlación y métricas
  sin contenido.

## Alternativas descartadas

- LLM externo en F06: requiere credenciales, costo, privacidad y autorización inexistentes.
- Acceso SQL por el modelo: viola mínimo privilegio y herramientas acotadas.
- Respuestas libres sin herramientas: no permiten demostrar veracidad.
- Módulo o microservicio adicional: contradice el monolito modular aprobado.

## Aprobación requerida

Esta ADR permanece propuesta hasta que el usuario apruebe conjuntamente la revisión de
spec, plan y C4 F06. No modifica la Constitution ni los documentos históricos.
