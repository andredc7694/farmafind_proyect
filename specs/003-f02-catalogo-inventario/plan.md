# Implementation Plan: F02 — Catálogo e inventario por farmacia

**Branch**: `feat/f02-catalogo-inventario` | **Date**: 2026-11-12 | **Spec**: [spec.md](spec.md)

**Status**: Plan técnico aprobado por el usuario el 2026-11-12. Incremento F02 TEST/DEMO verificado y revisado globalmente por el usuario el 2026-11-12; no autoriza GLO-01, BOOT-01 ni operación productiva.

**Input**: Especificación F02 aprobada el 2026-11-12 con CAT-01, INV-01 y FIX-01. Se reutiliza F01 desde `e1a9e8f`, sin cambiar sus pendientes T050/T051/T062/T067.

## Summary

F02 activa **Medicamentos** para consulta interna del catálogo común e **Inventario** para precio, cantidad, revisión manual, importación .xlsx/.csv, conciliación, confirmación atómica e historial por farmacia. No activa CRUD de Farmacias, búsqueda pública/Redis, reservas, Outbox, Notificaciones, IA ni rediseño visual. La API reutiliza sesiones, CSRF y contexto tenant F01; PostgreSQL conserva datos oficiales y RLS protege cada tabla privada. Un fixture aislado permite pruebas con responsables ficticios, sin otorgar permisos en la base persistente ni ejecutar BOOT-01/GLO-01.

## Technical Context

**Language/Version**: Node.js 24.17.0, Express 5.2.1, TypeScript 5.9.3; React 19.2.7, Vite 7.3.8, JavaScript/JSX; npm 11.13.0 según manifiestos actuales.

**Primary Dependencies**: reutilizar `pg`, Express, React, Vitest y Supertest; `csv-parse@7.0.3`, `@excel.js/exceljs@0.15.0` y `busboy@1.6.0` quedaron fijadas para archivos. `jsdom@31.0.0` y `@testing-library/react@16.3.3` son solo de prueba. `npm audit` reportó 0 vulnerabilidades en el árbol instalado; la validación adversarial de archivos continúa pendiente.

**Storage**: PostgreSQL y migraciones F02 adicionales; catálogo común separado de filas privadas por `farmacia_id`. Archivos de entrada solo temporales; vista previa mínima y digest en base. Sin Redis en F02.

**Testing**: unitarias de validación, conciliación, precio/cantidad y estados; HTTP positivo/negativo; PostgreSQL real para RLS, pool, concurrencia y rollback; archivos malformados y secretos. Playwright obligatorio para aceptación en entorno oficialmente compatible, no acreditado en Windows 10.

**Target Platform**: desarrollo local Windows 10. Destino AWS de la Constitution, sin infraestructura F02 ahora.

**Project Type**: web React y API REST dentro del monolito modular existente.

**Performance Goals**: no se inventa objetivo de latencia/carga. El plan aprobado fija límites iniciales para proteger recursos: archivo hasta 5 MiB, 5 000 filas y vista previa de 30 minutos; su aplicación y prueba siguen pendientes.

**Constraints**: no alterar `farmafind_f01_test`; no guardar secretos, archivo bruto ni datos reales; no conceder roles globales ni ejecutar BOOT-01. Atomicidad por archivo, cantidad física ≥ comprometida, fecha de revisión veraz, contexto transaccional y RLS obligatorios.

**Scale/Scope**: cuatro historias, 20 F02-FR, siete F02-SC. Datos ficticios mínimos de dos farmacias y responsables A/B; no se afirma escala productiva medida.

## Constitution Check

*GATE antes de investigar y tras diseñar. Pasa documentalmente para diseño; implementación y aceptación siguen cerradas.*

| Principios | Decisión y comprobación prevista | Gate |
|---|---|---|
| I, XVI–XVIII: SDD, rama, aprobación | Spec aprobada; plan en rama F02; tareas y código solo después de revisión humana del plan. | Pasa para diseño. |
| II–VI: siete módulos, stack, Clean Architecture | Medicamentos e Inventario con capas propias; F01 se usa por contrato; Farmacias conserva alta/estado; Notificaciones sigue independiente. | Pasa. |
| VII–VIII: PostgreSQL y RLS tenant | Migraciones, políticas por operación, rol no privilegiado, actor/membresía verificados y contexto local por transacción; pruebas A/B SQL directas. | Diseño; evidencia pendiente. |
| IX–XI: Redis, UoW/Outbox, AWS | Redis solo búsqueda F03; Outbox/UoW de reservas F04/F05; destino AWS conservado sin recursos. F02 requiere transacción propia para importación atómica. | Pasa. |
| XII–XV, XIX–XX: costos, pruebas, historia, privacidad | Sin gastos ni datos reales; HU05/RF10/AC04 trazados; archivos sin retención bruta; 16 criterios sin resultados inventados. | Diseño; aceptación pendiente. |

**Post-design:** [data-model.md](data-model.md), [inventory.openapi.yaml](contracts/inventory.openapi.yaml), [quickstart.md](quickstart.md) y [research.md](research.md) preservan estos gates. F01 aún no tiene alta privilegiada real ni vía aprobada para conceder permisos de inventario en la base persistente; FIX-01 cubre solo pruebas aisladas. No se puede presentar F02 como operativa para actores reales mientras persista esa dependencia.

## Phase 0: Research

[research.md](research.md) documenta la secuencia F02 actualizada, el reuso seguro de F01, RLS, fixture, parser de archivos y pruebas. Las tres decisiones funcionales de la especificación están resueltas. La elección final del paquete XLSX queda condicionada a auditoría y validación local antes de instalar o programar el parser; un resultado inseguro detiene ese subbloque y requiere revisar el plan, sin eliminar el formato .xlsx exigido.

## Phase 1: Design and Contracts

### Arquitectura y autorizaciones

`backend/src/modules/medicamentos/` tendrá dominio de referencia normalizada, consulta, puerto de catálogo, adaptador PostgreSQL y presentación interna. La mutación operativa del catálogo queda ausente por CAT-01. `backend/src/modules/inventario/` tendrá dominio de cantidades, precio, revisión e importación; casos de consulta, cambio manual, vista previa, confirmación e historial; puertos de repositorio, parser y transacción; adaptadores y controladores. El dominio no depende de Express ni PostgreSQL y los módulos se comunican por contratos públicos.

La composición reutilizará la sesión y el patrón transaccional de `PgIdentityUnitOfWork` mediante puerto acotado, sin copiar secretos ni crear otra fuente de identidad. Capacidades propuestas: `inventory.read`, `inventory.write`, `inventory.import.preview`, `inventory.import.confirm` e `inventory.history`. Estos nombres requieren revisión con el plan; no se crea ruta para concederlas. El dueño o administrador propio necesita la capacidad respectiva y membresía activa; el trabajador queda denegado. RLS corroborará ámbito y capacidad con función SQL acotada, siguiendo el patrón F01. Si usa privilegios de definidor, tendrá propietario separado, `search_path` fijo, grants mínimos y verificación de sesión vigente; se probará contra SQL directo y contexto falsificado.

### Transacciones, importación y concurrencia

El catálogo es global y no contiene stock. Una operación privada usa una conexión durante toda la transacción: verificar sesión, membresía y capacidad → fijar actor/farmacia localmente → consultar o bloquear filas → validar invariantes → escribir inventario y movimientos → commit/rollback → liberar conexión. `farmacia_id` de ruta solo solicita contexto. La confirmación vuelve a verificar autoridad y estado, toma bloqueos en orden determinista por medicamento, comprueba versión/compromisos y aplica el archivo entero o nada. FK, unicidad y RLS se traducen sin confirmar existencia ajena.

El archivo se valida por contenido y tamaño; fórmulas y vínculos externos no se evalúan y se limita consumo de memoria/descompresión. Se descarta el original tras crear la vista previa. Solo persisten digest, filas normalizadas, mapeo e incidencias minimizadas; la vista previa caduca según límite aprobado. La retención posterior de historial requiere política antes de desplegar con datos reales. La vista previa no altera stock ni fecha de revisión.

### Contrato e interfaz

[inventory.openapi.yaml](contracts/inventory.openapi.yaml) define consulta interna, cambio manual, historial, vista previa y confirmación. Reutiliza cookie F01 y CSRF en mutaciones. Respuestas ajenas no distinguen recursos inexistentes de no autorizados. React añade flujo funcional mínimo en español: farmacia activa F01, referencias, formulario manual, mapeo/vista previa, errores y confirmación. Los botones visibles no son autoridad. No se ejecuta el rediseño visual profesional.

En Express, las rutas fijas como `/inventario/movimientos` deben registrarse antes de la ruta parametrizada `/inventario/{medicamentoId}`; ambas tendrán pruebas de contrato para evitar que `movimientos` se trate como identificador de medicamento.

### Datos y validación

[data-model.md](data-model.md) define entidades, claves y transiciones. [quickstart.md](quickstart.md) describe las verificaciones futuras, siempre en base aislada. La suite cubrirá A/B, ausencia de contexto, revocación, trabajador sin permiso, cambio secuencial/concurrente, `farmacia_id` manipulado, rollback por fila inválida, compromisos y reintento sin duplicación. La aceptación requiere los siete SC, AC04 aplicable y revisión humana; los pendientes de F01/F00 permanecen separados.

## Project Structure

### Documentation (this feature)

```text
specs/003-f02-catalogo-inventario/
  spec.md
  plan.md
  research.md
  data-model.md
  quickstart.md
  contracts/inventory.openapi.yaml
  checklists/requirements.md
  tasks.md                         # posterior, aún no generado
```

### Source Code (repository root; diseño futuro)

```text
backend/src/modules/medicamentos/{domain,application,infrastructure,presentation}/
backend/src/modules/inventario/{domain,application,infrastructure,presentation}/
backend/migrations/f02/
backend/tests/inventory/
frontend/src/inventory/
frontend/tests/inventory/
scripts/f02/                     # fixture y verificación solo de pruebas
```

**Structure Decision:** conserva `backend/`, `frontend/` y npm workspaces F00/F01. Estas rutas son propuestas, no archivos ya creados. Los siete módulos históricos mantienen límites independientes y FarmaFind AI sigue ampliación futura.

## Risks and gates before implementation

| Riesgo | Control propuesto | Puerta |
|---|---|---|
| Parser XLSX vulnerable o incompatible | Auditar árbol, licencia, instalación y archivos malformados. | Si falla, detener XLSX y revisar alternativa; no omitirlo. |
| Privilegio inexistente en base persistente | FIX-01 solo en base aislada; no modificar persistente ni ejecutar BOOT-01/GLO-01. | Prueba local posible; habilitación real bloqueada. |
| Fuga entre tenants o conexiones | RLS por operación, función acotada, `SET LOCAL`, rol limitado y batería A/B SQL/API. | Fallo impide versionar o aceptar. |
| Archivo parcial o concurrente | Bloqueos ordenados, versión, rollback e idempotencia. | Fallo impide aceptar. |
| Navegador | Playwright en entorno oficialmente compatible, separado de Chrome manual. | Tres recorridos F02 pasaron en Linux oficial; revisión humana global F02 registrada. |
| Nombre de cookie documentado distinto de F01 runtime | `identity.openapi.yaml` F01 declara `ff_session`, mientras el código usa `ff-session-local` en local y `__Host-ff-session` en modo seguro. F02 reutilizará el middleware real F01; antes de implementar contratos se corregirá la discrepancia documental mediante revisión autorizada, sin cambiar autenticación por conveniencia. | No crear un segundo mecanismo de sesión. |

## Traceability to the 16 teaching criteria

La matriz completa permanece en la Constitution. F02 aportará evidencia a 1 (HU05/RF10), 2–3 (modelo/arquitectura), 4 (SDD), 5 (unitaria/integración), 6 (E2E), 7 (UI mínima), 9 (índices/pool/RLS), 12 (CI cuando se integre), 14 (código/migraciones ficticias) y 15–16 (informe/demo posterior). Los criterios 8, 10, 11 y 13 corresponden a escalabilidad, AWS, Redis/búsqueda y carga; no se marcan cumplidos por este plan. No se asignan puntajes ni resultados de ejecución.

## Complexity Tracking

No se identifica excepción constitucional. CAT-01, INV-01 y FIX-01 preservan el núcleo aprobado y mantienen las puertas GLO-01/BOOT-01.
