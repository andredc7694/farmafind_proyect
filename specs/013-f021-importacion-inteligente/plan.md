# Implementation Plan: F02.1 — Importación inteligente

**Branch**: `feat/f025-incorporacion-farmacias` (rama temporal existente; el ruleset de `main` exige PR) | **Date**: 2026-11-22 | **Spec**: [spec.md](spec.md)
**Status**: Plan aprobado expresamente por el responsable el 2026-11-22; implementación F02.1 en curso. Ver [approval.md](approval.md). Esta aprobación no constituye aceptación de resultados.

## Summary

Extender el importador F02 sin sustituirlo: analizar hojas y encabezados CSV/XLSX, proponer mapeos conservadores, mostrar errores múltiples y corregibles, guardar perfiles por farmacia y conservar la confirmación atómica existente. MEJ-002 se limita a importación; el resto queda pendiente. El diseño preserva F01 RLS, F03 proyección pública, F04 stock comprometido y los contratos existentes. [research.md](research.md) registra la investigación y alternativas.

## Technical Context

**Language/Version**: Node.js 24.17.0, npm 11.13.0, TypeScript 5.9.3; React 19.2.7/JSX y Vite 7.3.8 según manifests y base F00.
**Primary Dependencies**: reutilizar Express 5.2.1, `@excel.js/exceljs@0.15.0`, `csv-parse@7.0.3`, `busboy@1.6.0`, `pg@8.23.1`; ninguna dependencia nueva aprobada por este plan.
**Storage**: PostgreSQL oficial; migración aditiva F02.1 propuesta para perfiles y múltiples incidencias, con RLS y propiedad de farmacia. Archivo original en memoria acotada, sin persistirlo.
**Testing**: unitarias de parser/detector/conciliación; contratos HTTP/API; PostgreSQL TEST efímero con RLS, concurrencia y rollback; E2E en navegador compatible; regresión F01/F02/F03/F04.
**Target Platform**: desarrollo Windows 10; E2E Playwright en entorno oficialmente compatible. Sin AWS ni Gemini.
**Project Type**: frontend React y API Express dentro del monolito modular.
**Performance Goals**: conservar límites F02 (5 MiB, 5000 filas, 50 columnas y vista previa de 30 minutos); medir tiempo y memoria con archivos límite antes de aceptación, sin inventar umbral nuevo.
**Constraints**: cero stock modificado en análisis/vista previa; importación íntegra o ninguna fila; farmacia y permisos revalidados en confirmación; no tocar `farmafind_f01_test`.
**Scale/Scope**: 4 historias, 14 FR, 7 SC; una farmacia activa por operación y pruebas Alfa/Beta.

## Constitution Check

| Principios | Comprobación de diseño | Estado |
|---|---|---|
| I, XVII–XVIII: SDD, funcionalidad única y puertas humanas | F02.5 suspendida sin aceptación; spec y plan F02.1 aprobados expresamente el 2026-11-22. | Pasa para implementación aprobada. |
| XVI: Git | Constitution 2.0.0 ratificada; `main` solo si reglas GitHub lo permiten. Ruleset actual exige PR, por lo que se mantiene rama existente. | Pasa sin eludir protección. |
| II, IV–VI: módulos, stack, Clean Architecture | Extensión en capas de Inventario; React conserva frontend; F01/F03/F04 por contratos existentes. | Pasa. |
| VII–VIII, XX: datos y aislamiento | PostgreSQL, RLS, contexto transaccional, datos ficticios; perfiles/filas privados y errores sin PII. | Diseño pendiente de prueba real. |
| IX–XI: Redis, Unit of Work, Outbox | Reutilizar confirmación F02 y invalidación F03 tras commit; no alterar Outbox F04. | Diseño pendiente de regresión. |
| XII–XV, XIX: AWS, trazabilidad, IA | Ningún recurso AWS/IA; MEJ-001/002 y 16 criterios docentes solo trazados, sin calificar cumplimiento. | Pasa. |

Revisión posdiseño: los contratos y entidades de [data-model.md](data-model.md) mantienen las puertas anteriores. Cualquier cambio a RLS, reglas de negocio o contrato incompatible requiere nueva revisión humana.

## Design

### Análisis y mapeo

El parser actual rechaza XLSX con más de una hoja y asume encabezado en primera fila. Introducir una etapa de **análisis sin persistencia** que inspeccione hojas/filas dentro de límites existentes, calcule candidatos de encabezado y sinónimos españoles por campo, y devuelva puntuación/ambigüedad explicable. Nunca seleccionar automáticamente dos columnas para un campo ni inferir equivalencia clínica. El usuario confirma o corrige hoja, fila y columnas; se conserva el flujo de mapeo manual actual como compatible. Una nueva inspección del archivo puede repetir la carga, sin guardar bytes brutos en servidor. Usar hash del archivo para vincular análisis y vista previa y prevenir sustitución silenciosa.

### Conciliación, errores y perfiles

Separar `errorCode` legado de una colección de incidencias con campo, fila/columna física real, razón y acción; mantener `errorCode` para compatibilidad F02 y añadir colección opcional al contrato. CSV con filas vacías debe conservar número de línea de origen. Corregir el caso precio/cantidad vacíos con dos incidencias. Definir catálogo cerrado de códigos sin eco de datos privados. Persistir incidencias minimizadas para consulta de vista previa; no copiar valores brutos sensibles. Guardar perfil de importación vinculado a `farmacia_id`, con huella de encabezados y versión; aplicar solo cuando el esquema del archivo sea compatible. Guardar perfil requiere acción explícita y capacidad existente `inventory.import.confirm`, separada de la acción que confirma stock; no se crea un permiso nuevo implícito.

### Confirmación y seguridad

Reutilizar `ConfirmImport`, `InventoryUnitOfWork`, bloqueo de importación y actualización de inventario de F02; revalidar que cero incidencias pendientes, referencia exacta, sesión/membresía/capacidad y compromisos siguen válidos. La migración nueva debe ser aditiva, con FORCE RLS, SELECT/INSERT/UPDATE limitados a membresía/capacidad y contexto transaccional; el administrador global no recibe lectura de perfiles privados. Al confirmar, movimientos y stock se confirman juntos; invalidación F03 solo después del commit. Un conflicto produce rollback de stock y resultado de rechazo idempotente, sin sobreasignar. No alterar la política de reservas F04 ni su ADR de seguridad.

### API y frontend

[contracts/importacion-f021.md](contracts/importacion-f021.md) define inspección, extensión compatible de vista previa, perfiles y errores. El router F02 mantiene sus rutas actuales; se añaden rutas acotadas con cookie F01, CSRF para mutaciones y 404/403 seguros. React `ImportPreview` incorpora selector de hoja/encabezado, mapeo propuesto editable, incidencias accesibles por fila y acción de guardar perfil. Los botones no sustituyen la autorización backend.

### Pruebas y aceptación

[quickstart.md](quickstart.md) define casos y comandos futuros. Probar archivos válidos, varias hojas, encabezados desplazados, sinónimos, ambigüedad, duplicados, precio y cantidad vacíos, cancelación, rollback, concurrencia, revocación, Alfa/Beta, SQL directo con rol runtime, Redis e integración con búsqueda/reservas. No ejecutar migraciones en base persistente. La aceptación requiere resultados reales de los 7 SC, revisión humana y verificación de la matriz de 16 criterios aplicables; la parte restante de MEJ-002 permanece abierta.

## Project Structure

### Documentation (this feature)

```text
specs/013-f021-importacion-inteligente/
  spec.md
  plan.md
  research.md
  data-model.md
  quickstart.md
  contracts/importacion-f021.md
  checklists/requirements.md
  tasks.md                    # generado tras este plan
```

### Source Code (planned; no code generated)

```text
backend/src/modules/inventario/domain/importacion.ts
backend/src/modules/inventario/application/{preview-import,confirm-import,ports}.ts
backend/src/modules/inventario/infrastructure/{file-parser,import-repository,tenant-unit-of-work}.ts
backend/src/modules/inventario/presentation/import-router.ts
backend/migrations/f02/        # migración aditiva numerada, tras revisión
frontend/src/inventory/{ImportPreview,inventory-client}.*
scripts/f02/ y pruebas existentes de F02/F03/F04
```

**Structure Decision**: extensión del módulo Inventario dentro del monolito; no se crea servicio separado ni se modifica el dominio de Reservas.

## Complexity Tracking

Sin excepciones constitucionales propuestas. Dos tablas privadas adicionales se justifican porque F02 solo persiste un código de error por fila y no tiene perfiles tenant; se validarán contra la alternativa de JSON minimizado durante la implementación aprobada.
