# Plan de implementación: F07 — Geolocalización de farmacias

**Rama real**: `feat/f07-geolocalizacion` | **Fecha**: 2026-11-18 | **Spec**: [spec.md](spec.md)

**Estado**: Plan aprobado por respuesta humana «sí» del 2026-11-18 para generar tareas F07; correcciones documentales de ciudad y privacidad autorizadas posteriormente por «apruebo» en esta conversación. No autoriza migraciones persistentes, proveedores pagados, recursos AWS ni concesión de capacidades fuera de TEST.

## Summary

F07 amplía las consultas públicas F03 con mapa, lista accesible, radios, distancia lineal y actualización revisada de ubicaciones de farmacia. Reutiliza la identidad F01, la proyección pública F03 y su oferta referencial. La ubicación personal solo vive durante la consulta. El mapa de terceros se carga tras una acción informada; sin mapa, la lista sigue operativa. La publicación de coordenadas requiere propuesta y revisión por personas distintas, ambas con capacidad explícita dentro de la misma farmacia.

## Technical Context

**Language/Version**: Frontend React + Vite + JavaScript/JSX; backend Node.js 24.17.0 + Express + TypeScript 5.9.3; npm 11.13.0 como referencia observada.

**Primary Dependencies**: Reutilizar Express, pg, React y pruebas existentes. Propuesta: Leaflet para mapa interactivo. Su licencia BSD-2-Clause es permisiva, pero es distinta de la licencia y política del proveedor de teselas. No se instala aún.

**Storage**: PostgreSQL oficial; extensión aditiva de `f03.farmacia_publica` y auditoría F07, sin duplicar farmacia ni oferta. Redis F03 sigue siendo caché descartable; no almacena ubicación personal. No se activa PostGIS en F07: cálculo geodésico existente con límites de candidatos y prueba de latencia.

**Testing**: Vitest, Supertest y pruebas PostgreSQL/RLS reales en base TEST efímera; pruebas E2E en entorno Playwright oficialmente compatible. Casos de licencia/privacidad revisados documentalmente antes de mostrar teselas.

**Target Platform**: desarrollo local Windows 10; navegador en origen seguro para geolocalización, con prueba manual por ciudad si el navegador no concede permiso.

**Project Type**: aplicación web con backend modular y servicio de Notificaciones independiente, sin nuevos procesos.

**Performance Goals**: propuesta de aceptación TEST/DEMO: p95 ≤ 2 s para consulta de proximidad con hasta 200 farmacias candidatas ficticias, medido sin tiempo de red del proveedor de teselas. El umbral se somete a aprobación del plan y no afirma escala productiva.

**Constraints**: sin pagos, AWS, geocodificación automática externa, rastreo continuo, cambio de permisos globales o escritura a la base persistente; el mapa no puede ser condición para completar una búsqueda.

**Scale/Scope**: cinco farmacias DEMO para aceptación funcional; hasta 200 candidatas por consulta como límite heredado F03, sujeto a medición. Un nuevo incremento sería necesario para escala mayor.

## Constitution Check

| Puerta | Verificación previa y posterior al diseño |
| --- | --- |
| I, XVII, XVIII — SDD y aprobación | Spec F07 aprobada con Q1/Q2 y plan aprobado para generar tareas por respuesta humana del 2026-11-18. F06.1 conserva sus pendientes separados. La ejecución de tareas requiere respetar los límites y bloqueos de este plan. |
| II–VI, XV — módulos y arquitectura | Ubicación de farmacia pertenece al módulo Farmacias; proximidad pública a Búsqueda. Se conservan siete módulos históricos, FarmaFind AI aparte, Clean Architecture y el proceso independiente de Notificaciones. |
| VII–X — datos y aislamiento | PostgreSQL fuente; RLS obligatoria, sin BYPASSRLS; contexto tenant local a transacción. Redis F03 mantiene Cache-Aside/fallback. No se altera Outbox ni Unit of Work de Reservas. |
| XI–XII, XVI — AWS y Git | Sin infraestructura ni costos; rama independiente, sin main. |
| XIX–XX — veracidad y datos | Oferta solo pública/referencial, sin datos personales reales ni historial de ubicación personal; se prohíbe presentar línea recta como ruta. |

**Resultado de la puerta**: Compatible como diseño TEST/DEMO. Dos condiciones de activación documentadas: teselas de terceros solo tras verificación final de términos/privacidad y permiso informado; capacidades de revisión solo tras procedimiento autorizado de concesión. No se presume que GLO-01 las otorgue.

## Phase 0 — Research

Véase [research.md](research.md). Decisiones propuestas: reutilizar proyección F03 con estado de verificación explícito; Leaflet como visor y OSM raster solo como candidato de uso local/pequeña escala, con atribución, límites y carga opcional. La política OSMF permite visualización humana normal pero no ofrece SLA ni autoriza precarga. Si la revisión de términos/privacidad o el volumen no lo permiten, el mapa permanece desactivado y debe seleccionarse otro proveedor sin degradar listado; F07 no se acepta hasta completar el mapa aprobado.

## Phase 1 — Design

### Flujo de datos y permisos

1. La vista de F07 solicita ubicación del dispositivo solo tras acción explícita, con una lectura puntual; ciudad/ubicación manual siguen disponibles. El estado se mantiene en memoria, se elimina al salir y no entra en URL, historial, logs de acceso/error, auditoría, caché ni analítica. Las consultas con coordenadas usan cuerpo POST, sin parámetros geográficos en la URL, con respuesta `Cache-Control: no-store`; tampoco se delegan a la ruta GET de F03. Se revisan registros de aplicación y proxy local para comprobar ausencia de coordenadas.
2. Una consulta pública acotada obtiene únicamente farmacias activas y ubicaciones con estado `PUBLICADA_VERIFICADA`; calcula distancia lineal, filtra radio, ordena y pagina de forma estable. La consulta GET por ciudad no acepta coordenadas. Las nuevas propuestas de ubicación requieren `ciudad` explícita de 2–120 caracteres. Las filas históricas sin ciudad permanecen con valor nulo y no se infiere ciudad de la dirección; conservan búsqueda textual F03 hasta una corrección autorizada. Las farmacias sin coordenada pueden listarse por su ciudad registrada con aviso, pero no aparecen en mapa/radio. La oferta procede de F03 y conserva fecha y aviso referencial.
3. La farmacia autorizada propone una ubicación con evidencia de fuente. Otro usuario distinto, con membresía activa en la misma farmacia y capacidad explícita de revisión, decide aprobar/rechazar. No existe autoaprobación, revisión cross-tenant ni permiso implícito por rol. El cambio publicable y la auditoría se confirman de forma transaccional.
4. F01 actualmente permite delegaciones acotadas; F07 propone capacidades separadas `GEO_LOCATION_PROPOSE` y `GEO_LOCATION_REVIEW`. No se añade ruta de concesión ni se reutiliza GLO-01. Los fixtures TEST pueden tener capacidades ficticias; para cualquier asignación persistente o productiva hace falta un procedimiento de concesión aprobado por separado.
5. RLS protege tablas de ubicación/auditoría y cada mutación usa transacción con contexto tenant verificado y limpieza segura al devolver la conexión. La proyección pública no ejecuta consultas privadas bajo el rol runtime ni filtra por `farmacia_id` suministrado sin comprobación. Las filas F03 anteriores pasan a estado pendiente, sin verificación automática; se conserva la búsqueda textual.
6. El visor no carga teselas ni envía coordenadas de la persona a terceros por defecto. Antes de cargarlo informa del proveedor y posible revelación aproximada del área visible. El enlace de indicaciones solo se abre por acción explícita y no incluye ubicación personal como origen. Las teselas llevan atribución y respetan caché/referer y prohibición de precarga.

### Interfaces

El [contrato propuesto](contracts/geolocation.openapi.yaml) define `GET /api/v1/geolocalizacion/farmacias?ciudad=…` solo para ciudad y `POST /api/v1/geolocalizacion/consultas` para coordenadas efímeras en el cuerpo; ambos son públicos, con controles contra abuso. La ruta GET rechaza latitud/longitud y parámetros desconocidos para impedir fuga por URL. También define propuesta de ubicación y revisión por farmacia autorizada. No sustituye `/api/v1/busquedas` de F03: se compone internamente con su oferta existente sin enviar coordenadas a su ruta HTTP. La ruta frontend propuesta es `/mapa`, con listado accesible como vista principal y mapa opcional. Los estados de error distinguen solicitud inválida, denegación, falta de resultados, base no disponible y proveedor de mapas no disponible.

### Migración y compatibilidad

- Migración aditiva TEST: agregar `ciudad` normalizada y metadatos de verificación a `f03.farmacia_publica` o tabla 1:1 de revisión, más auditoría de propuestas. `ciudad` es obligatoria para nuevas propuestas y puede permanecer nula en filas históricas; no se deriva automáticamente del texto libre. Sin `DROP`, `TRUNCATE` ni actualización automática de filas a verificadas.
- Revisar y versionar la función pública `f03.search_public_offers` y los contratos F03 donde hoy aparecen `latitud/longitud`; solo exponer posición aprobada, sin romper dirección/precio/disponibilidad existentes. Pruebas de regresión F03 obligatorias.
- Todo cambio de base persistente exige plan de respaldo, ventana y autorización específica; este plan no los concede.

### Verificación

Unitarias: validación, distancia, radio, ciudad explícita y orden estable. API/contratos: GET solo por ciudad, POST con coordenadas en cuerpo y `no-store`, rechazo de coordenadas en URL, filas históricas sin ciudad, filtros, límites de abuso y errores. Privacidad: inspeccionar registros de aplicación/proxy local, respuestas, historial/URL del navegador y caché para comprobar ausencia de coordenadas personales persistidas. PostgreSQL real: FORCE RLS, roles sin BYPASSRLS, contexto entre conexiones, propuestas/revisiones cruzadas y no autoaprobación. Frontend/E2E: permiso concedido/denegado, ciudad manual, mapa/lista, teclado, móvil/escritorio y fallo de teselas. Regresión: F01 autorización, F03 búsqueda/Redis/fallback, F02 oferta y F06 grounding; compilación/TypeScript y revisión de secretos. Registrar pruebas realmente ejecutadas, no marcar éxito anticipadamente. Guía: [quickstart.md](quickstart.md).

## Project Structure

### Documentation

```text
specs/010-f07-geolocalizacion/
├── spec.md
├── checklists/requirements.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
└── contracts/geolocation.openapi.yaml
```

### Source Code (propuesto, aún no creado)

```text
backend/src/modules/farmacias/{domain,application,infrastructure,presentation}/
backend/src/modules/busqueda/{domain,application,infrastructure,presentation}/
backend/migrations/f07/
backend/tests/geolocation/
frontend/src/geolocation/
frontend/tests/geolocation/
scripts/f07/
```

**Structure Decision**: Farmacias posee cambios de posición; Búsqueda compone proyección pública F03 y proximidad. F01 conserva identidad/autorización; no se añade un octavo módulo principal.

## Complexity Tracking

No se solicita excepción constitucional. La revisión separada de una ubicación añade controles de seguridad aprobados en Q2; se implementa solo cuando sus permisos y pruebas estén definidos.
