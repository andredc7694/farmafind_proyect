# Implementation Plan: F06 — Asistente IA informativo

**Branch**: `feat/f06-asistente-ia` | **Date**: 2026-11-16 | **Spec**: [spec.md](spec.md)

## Summary

Añadir `asistente-ia` al monolito modular. Un orquestador clasifica consultas públicas,
aplica límites clínicos y ejecuta como máximo herramientas de solo lectura sobre F03.
`MockAIProvider` será determinista y la única implementación activa. La SPA incorpora un
recorrido mínimo en español. No hay proveedor externo, credenciales, persistencia de
prompts, nueva base, AWS ni autoridad de escritura.

## Technical Context

**Runtime**: Node.js 24.17.0, npm 11.13.0, TypeScript; React/Vite/JSX
**Dependencies**: Express 5.2.1 y capacidades existentes; cero paquetes IA nuevos
**Storage**: sin tablas F06; F03 conserva PostgreSQL oficial y Redis Cache-Aside
**Testing**: Vitest, Supertest, Testing Library; regresión PostgreSQL/Redis existente
**Platform**: Windows 10 local; futura compatibilidad Lightsail, sin recursos AWS
**Performance**: 100 consultas mock deterministas; límites antes de trabajo costoso
**Constraints**: entrada 500 caracteres, cuerpo 4 KiB, 30 solicitudes/minuto/origen,
máximo 3 herramientas, 20 resultados públicos y timeout proveedor de 1 segundo

## Constitution Check

| Gate | Diseño F06 | Estado antes de código |
|---|---|---|
| I, XVIII SDD/aprobación | spec, ADR/C4, contrato, plan y 52 tareas aprobados expresamente el 2026-11-16 | PASS |
| II, XIX IA | módulo añadido, informativo, sin diagnóstico/dosis/invención | PASS documental |
| VI Clean Architecture | dominio/aplicación dependen de puertos; Express/F03/mock son adaptadores | PASS documental |
| VII–IX datos/tenant/cache | solo proyección pública F03; sin acceso privado ni nueva caché | PASS documental |
| XIII pruebas | unitarias, HTTP, frontend, seguridad, carga determinista y regresión | PASS documental |
| XV continuidad | IA-RF01 y AC-IA01/02 nuevos; ADR histórica intacta | PASS documental |
| XVII una feature | solo F06 activa | PASS |
| XX privacidad | texto efímero, métricas minimizadas, fixtures ficticios | PASS documental |

No se solicita excepción constitucional. El usuario aprobó expresamente spec, ADR/C4,
contrato, plan y 52 tareas el 2026-11-16; la aceptación final continúa separada.

## Architecture

```text
frontend/src/assistant/
  AssistantView.jsx
  assistant-client.js
backend/src/modules/asistente-ia/
  domain/{intent,clinical-policy,grounded-response}.ts
  application/{ports,query-assistant}.ts
  infrastructure/{mock-ai-provider,public-knowledge-tools,metrics}.ts
  presentation/{assistant-router,rate-limit}.ts
backend/tests/assistant/
frontend/tests/assistant/
```

### Request flow

1. Express limita JSON a 4 KiB y valida contrato exacto `{consulta}` de 1–500 caracteres.
2. Rate limit en memoria por clave técnica derivada del origen: 30/minuto. No persiste IP.
3. La política clínica determinista se ejecuta antes de proveedor o herramientas.
4. `MockAIProvider.classify` devuelve una intención estructurada validada.
5. `QueryAssistant` permite solo las herramientas declaradas y hasta tres invocaciones.
6. `PublicKnowledgeTools` adapta F03; devuelve exclusivamente DTO públicos y máximo 20 resultados.
7. El caso de uso construye la respuesta desde esos resultados y añade aviso referencial.
8. Métricas guardan categoría, intención, duración, resultado y conteo; nunca consulta o respuesta.

### Provider boundary

`AIProvider` recibe texto efímero y devuelve intención estructurada. El mock utiliza reglas
locales y no red. No existe selección por variable de un proveedor real: añadirla exige una
nueva especificación, revisión de privacidad/costo y autorización. Un timeout/salida inválida
se convierte en fallback determinista de ayuda o indisponibilidad, nunca en contenido libre.

### Public tool boundary

- `SearchCatalog`: adapta `SearchPublicOffers` con término y filtros autorizados.
- `CompareOffers`: usa el mismo contrato público y ordenación F03; no interpreta equivalencia terapéutica.
- `GetPharmacyDetails`: solo nombre/dirección pública desde `PublicOfferRepository.pharmacy`.

El módulo no importa repositorios F01/F02/F04/F05 ni emite SQL. La composición inyecta los
puertos F03 existentes. Redis permanece dentro de F03 y su caída conserva fallback PostgreSQL.

## API and UI

`POST /api/v1/asistente/consultar` devuelve intención, respuesta, aviso, fuentes públicas,
correlación y `provider: mock`. Respuestas: 200, 400, 413, 422, 429 y 503. No devuelve
prompt interno, stack, sesión, cantidades privadas ni herramientas no ejecutadas.

La SPA ofrece textarea, enviar, respuesta, fuentes y estados clínico/límite/error. No
almacena historial ni implementa el rediseño profesional.

## Test Strategy

- **Unitarias**: intención, clínica conservadora, grounding, ausencia de datos, mock 100x,
  límites de herramientas, timeout y salida inválida.
- **HTTP/seguridad**: contrato, 413, 429 previo a proveedor, prompt injection, PII, errores
  minimizados y ausencia de rutas de escritura.
- **Frontend**: consulta, fuentes, aviso, límite clínico y errores.
- **Integración**: herramientas contra adaptadores públicos F03; Redis caído conserva fallback.
- **Regresión**: `check`, build, suite base y pruebas F03/F05 afectadas.
- **Carga acotada**: 100 consultas concurrentes al mock, métricas p95/p99 locales sin SLO productivo.

## ADR/C4 and traceability

La ADR propuesta y las vistas C4 están en `adr/` y `c4/`. `evidence-traceability.md`
vinculará 24 FR, 8 SC y los 16 criterios docentes. Su aprobación no modifica Constitution
ni ADR-01–ADR-12.

## Risks

| Riesgo | Control |
|---|---|
| Clasificación clínica incompleta | política conservadora previa al proveedor y batería negativa |
| Alucinación | plantillas fundamentadas exclusivamente en resultados de herramientas |
| Prompt injection | intención estructurada, allowlist y ausencia de ejecución libre |
| PII en logs | métricas sin contenido y pruebas de inspección |
| Rate limit reiniciable | válido para entorno local; distribuido requiere decisión posterior |
| Acoplamiento a F03 | puerto `PublicKnowledgeTools` y DTO públicos estables |

## Approval boundary

El plan y sus artefactos fueron aprobados expresamente el 2026-11-16 conforme a
Constitution XVIII. Esa aprobación autoriza implementación, pero no equivale a aceptación final.
