# Implementation Plan: F06.1 — Asistente conversacional farmacéutico informativo

**Branch**: `feat/f06-1-asistente-conversacional` | **Date**: 2026-11-17 | **Spec**: [spec.md](spec.md)

**Status**: plan aprobado por el responsable el 2026-11-17 mediante «sí, apruebo todo» en respuesta a la solicitud explícita de aprobación del plan, incluidos 6 turnos y 15 minutos. La implementación F06.1 continúa fuera del alcance de este bloque documental.

## Summary

Ampliar F06 mediante un caso de uso conversacional separado, de contexto efímero y proveedor determinista. Responder sobre productos solo con contenido farmacéutico autorizado y revisado; las ofertas se obtienen exclusivamente por el puerto público F03. Mantener intacto `POST /api/v1/asistente/consultar`. La orientación educativa sobre molestias permanece deshabilitada para usuarios reales hasta que se aprueben corpus y pruebas clínicas.

## Technical Context

**Language/Version**: Node.js 24.17.0, TypeScript 5.9.3; React + Vite + JavaScript/JSX existentes.
**Primary Dependencies**: Express 5, Vitest y herramientas actuales; sin nuevo SDK ni proveedor externo en el incremento inicial.
**Storage**: contexto en memoria, sin tabla nueva; PostgreSQL oficial y Redis Cache-Aside siguen detrás de F03. Sin historial clínico persistente.
**Testing**: Vitest, Supertest, Testing Library, controles F03/F06, pruebas RLS/Redis afectadas y navegador en entorno compatible.
**Target Platform**: desarrollo Windows 10; despliegue futuro separado.
**Project Type**: módulo del monolito modular, API pública y SPA React.
**Performance Goals**: mantener los límites F06; medir latencia y consumo con mock, sin afirmar SLO de producción.
**Constraints**: máximo 500 caracteres por consulta, 4 KiB por cuerpo, 30 solicitudes/minuto/origen, hasta 3 herramientas y 20 ofertas; 6 turnos y 15 minutos de inactividad para contexto efímero, aprobados con este plan para alcance local.
**Scale/Scope**: una ampliación F06.1, sin inventario privado, transacciones ni proveedores externos activos.

## Constitution Check

| Puerta | Resultado documental |
| --- | --- |
| I, XVII, XVIII — SDD y una funcionalidad | Especificación aprobada el 2026-11-17; este plan espera aprobación propia antes de código. No se alteran F00–F06. |
| III, XIX — límites clínicos | Política conservadora antes de proveedor/herramientas; IA31-03 solo contenido educativo revisado, sin elección individual. |
| VI — Clean Architecture | Dominio y aplicación dependen de puertos; Express, mock, memoria y F03 son adaptadores. |
| VII–IX — datos, RLS y caché | Ningún acceso SQL directo ni privado; solo DTO públicos F03, que conserva RLS y Redis/fallback. |
| XIII, XIV — pruebas y rúbrica | Contratos, seguridad clínica, privacidad, regresión y evidencias verificables previstas; nada se declara ejecutado. |
| XV — historia | Documento Maestro v3.0 principal; v2.0 y F06 preservados; F07 AWS histórico etiquetado `F07-LEGACY-AWS`. |
| XX — datos y secretos | Contexto volátil, sin texto en logs, fixtures ficticios, proveedor externo desactivado. |

**Reevaluación tras diseño**: las mismas puertas siguen satisfechas documentalmente. No hay excepción constitucional nueva. El plan fue aprobado por el responsable; el corpus profesional y cualquier proveedor externo conservan puertas de aprobación independientes.

## Project Structure

### Documentation

```text
specs/009-f061-asistente-conversacional/
  spec.md
  plan.md
  research.md
  data-model.md
  quickstart.md
  contracts/conversation.openapi.yaml
  checklists/requirements.md
```

### Source Code — ubicación prevista, sin crear código ahora

```text
backend/src/modules/asistente-ia/
  domain/               # política clínica y citas
  application/          # caso de uso y puertos; sin Express/SQL
  infrastructure/       # mock, contexto volátil, catálogo revisado, adaptador público F03
  presentation/         # router y validación del contrato F06.1
backend/tests/assistant/
frontend/src/assistant/ # vista conversacional y cliente, sin rediseño F08
frontend/tests/assistant/
```

La separación dentro de `asistente-ia` reutiliza el módulo aprobado F06. La ruta y el contrato antiguos permanecen estables; F06.1 añade rutas `/api/v1/asistente/conversaciones` sin sustituir respuestas anteriores.

## Flujo propuesto

1. Validar JSON, tamaño, cuota y campos permitidos antes de proveedor o herramientas.
2. Clasificar límites clínicos de forma determinista. Rechazar solicitud personal o urgencia sin llamar a herramientas.
3. Cargar contexto efímero por identificador opaco; vincularlo al origen técnico y expirar o eliminar sin recuperar texto anterior. No usar cookie ni almacenamiento persistente del navegador para el contexto.
4. Permitir solo funciones estructuradas de fuente revisada y consultas F03 públicas de lectura. Descartar instrucciones incrustadas en contenido recuperado.
5. Componer respuesta desde afirmaciones con cita y fecha; abstenerse ante fuente faltante, caducada, contradictoria o sin revisión. Para ofertas, usar campos del DTO público de esa consulta.
6. Registrar únicamente métricas de categoría, duración y resultado; nunca prompt, respuesta, PII o identificador completo.
7. Ante error, devolver estado seguro y acceso a búsqueda F03 convencional. El mock sigue disponible sin red externa.

## Límites y decisiones del plan aprobado

| Asunto | Propuesta | Condición |
| --- | --- | --- |
| Contexto local | 6 turnos, 15 minutos de inactividad, eliminación inmediata; memoria por proceso con límite de entradas y limpieza por expiración. | Aprobado con este plan para alcance local; no equivale a sesión autenticada ni historial sanitario. |
| Consumo | Mantener límites F06: 500 caracteres, 4 KiB, 30/min/origen, 3 herramientas, 20 resultados. | No reducir protección existente; pruebas de 413/429 y cero herramientas al rechazar. |
| Proveedor | `MockAIProvider` existente como único activo; interfaz para adaptadores posteriores, incluido Gemini como candidato. | Ningún SDK, clave, red externa o facturación ahora; aprobación separada para selección y activación. |
| Contenido farmacéutico | Catálogo de fichas revisadas con fuente, fecha, licencia y aprobación profesional; sin contenido real hasta verificar permisos. | DIGEMID y otras fuentes oficiales son candidatas, no corpus autorizado automáticamente. |
| Privacidad | Sin persistencia de prompts ni envío a terceros; contexto en memoria y borrado explícito. | Política/consentimiento y evaluación de terceros antes de cualquier proveedor real. |

## Contratos y datos

[Contrato OpenAPI propuesto](contracts/conversation.openapi.yaml) y [modelo de datos](data-model.md). El identificador de conversación es una capacidad opaca y temporal, no autenticación ni autorización por farmacia. Las consultas de inventario privado nunca se enrutan a este módulo.

## Estrategia de pruebas y evidencia

- Unitarias: seguimiento contextual, límite/expiración/borrado, fuente y abstención, política clínica, inyección, proveedor inválido, fallback y métricas minimizadas.
- HTTP/contrato: 200/400/413/422/429/503, campos adicionales, ausencia de contenido privado, no mutación, compatibilidad del endpoint F06.
- Integración: F03 de solo lectura, cero ofertas, Redis disponible/caído con fallback PostgreSQL y aislamiento RLS Alfa/Beta en TEST.
- UI: cinco historias, mensajes de error y borrado, citas accesibles, español; navegador compatible y pruebas manuales si el entorno no lo permite.
- Aceptación: batería de 30 diálogos, todas las solicitudes clínicas negativas, grounding 100 %, corpus aprobado por profesional y regresión F03/F06. Registrar comandos, versiones, resultados y omisiones en evidencia futura; no se atribuyen resultados ahora.

## Riesgos y puertas de implementación

| Riesgo | Control / bloqueo |
| --- | --- |
| Fuente con licencia ambigua o caducada | No incorporarla; obtener permiso y aprobación profesional documentados. |
| Clasificación clínica incompleta | Rechazo conservador previo; corpus de ataques y casos vulnerables. |
| Memoria local no compartida | Alcance TEST/DEMO de un proceso; diseño distribuido requiere plan futuro. |
| Identificador opaco reutilizado o filtrado | Alta entropía, vínculo al origen, TTL, no URL ni logs, borrado y límite por origen. |
| Proveedor externo | No activo; evaluación de términos, privacidad, costos, consentimiento y aprobación humana independiente. |
| Implementación fuera del bloque documental actual | Las tareas se pueden generar y analizar ahora; código solo cuando el alcance de implementación quede expresamente autorizado. |

## Complexity Tracking

No se solicita excepción a la Constitution ni una nueva dependencia de ejecución. La conversación efímera añade una responsabilidad limitada dentro del módulo existente, sin base nueva.
