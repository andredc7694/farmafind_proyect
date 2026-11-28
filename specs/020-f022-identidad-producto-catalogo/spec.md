# Feature Specification: F02.2 — Identidad del producto (laboratorio, marca y forma farmacéutica) y propuestas de productos nuevos

**Feature Branch**: `feat/f022-identidad-producto-catalogo` (actualizada con `main` `b0557d5` el 2026-11-27, por merge, sin force push)
**Created**: 2026-11-25 · **Actualizada**: 2026-11-27
**Status**: Spec aprobada el 2026-11-25 (D-01..D-05 = A). **Actualización 2026-11-27 pendiente de aprobación de Andre** (decisiones nuevas D-06 a D-12). El plan y las tareas del 2026-11-25 quedan **desactualizados**: se rehacen, con el SQL y sus hashes, después de aprobar esta spec. Nada se programa ni se aplica antes.
**Prioridad**: prioritaria desde la aceptación de F02.5 (2026-11-27, observación a).

## Origen
- T046 de F02.5 (2026-11-25): un archivo de 1100 filas dejó 583 filas excluidas como «duplicadas» que, según Andre, son el mismo producto de distintos laboratorios.
- T057 de F02.5 (2026-11-27): en la DEMO, las **cinco** importaciones confirmadas excluyeron en total **2806 filas** (Andre mencionó 2766; la suma real es 2806). Detalle en `specs/012-f025-incorporacion-farmacias/evidence.md`:

| Farmacia | Filas del archivo | Importadas | Fila duplicada | Referencia no conciliada | Excluidas |
|---|---|---|---|---|---|
| HUAMANFAR | 1100 | 517 | 583 | 0 | 583 |
| STUART-FAR | 1020 | 497 | 516 | 7 | 523 |
| RHFARMA | 1060 | 510 | 544 | 6 | 550 |
| FARMAPIO | 1130 | 515 | 609 | 6 | 615 |
| FARMAPOINT | 1040 | 505 | 528 | 7 | 535 |
| **Total** | 5350 | 2544 | **2780** | **26** | **2806** |

- «Mismo producto con distinto laboratorio» es la explicación de Andre: la base no guarda el laboratorio de las filas excluidas. Las 26 «no conciliadas» son productos que no están en el catálogo.

## Estado real de `main` que esta spec tiene en cuenta (2026-11-27)
- **Catálogo** `f02.medicamento`: identidad única `(nombre, concentracion, presentacion, clasificacion)`; `principio_activo` añadido por F03. La DEMO tiene **518 productos sin laboratorio**, cargados desde el archivo ficticio de Andre tomando la **primera fila** de cada combinación (`scripts/f025/load-demo-catalog.mjs`). Las cinco farmacias importaron sobre esos mismos 518 productos compartidos (2545 filas de inventario).
- **Importación** (F02.1): una fila es «duplicada» si repite nombre, concentración, presentación y condición de venta; la primera gana. Solo se guardan las filas importadas y el código del error, no el texto de las excluidas.
- **Reservas** (F04): cada reserva apunta a su fila de inventario **y** a su producto (clave compuesta). Por eso el inventario **no se puede mover** de un producto a otro sin romper reservas.
- **Búsqueda** F03.1/F03.2: funciones `f03.search_public_offers_terms` (versiones `f03/003` y `f07/010`), limpieza `f03.normalize_search_text` (inmutable) y contrato de búsqueda 0.3.0. F07.1/F07.2: ubicación verificada y horario público (no cambian).
- **Asistente F06.2**: deduce la forma farmacéutica de la presentación (`dosage-form.ts`, 16 formas); con «caja x 30» la forma queda desconocida y no hay alternativas. Contrato de conversación 2.0.0.
- **Migraciones ocupadas**: `f01` hasta 016, `f02` hasta 006, `f03` hasta 003, `f025` hasta 017, `f07` hasta 010. Los nombres `f025/016` y `f03/003` del plan anterior **ya no están libres**; el plan nuevo usará los siguientes números libres (previstos: `f02/007`, `f02/008`, `f01/017`, `f025/018`, `f03/004`, `f07/011`).

## Problema (lenguaje sencillo)
El catálogo identifica un producto solo por nombre, concentración, presentación y condición de venta. No distingue laboratorio, marca ni forma, así que productos distintos se toman por repetidos y se pierden filas al importar. Además nadie puede agregar los productos que faltan, y el asistente no puede ofrecer alternativas cuando la presentación no dice la forma.

## Qué se construye
1. **Identidad del producto**: nombre + concentración + presentación + **forma farmacéutica** + condición de venta + **laboratorio** + **marca** (marca vacía = genérico). (D-01)
2. **Forma farmacéutica** con lista cerrada (la misma del asistente F06.2: tableta, cápsula, jarabe, suspensión, solución, gotas, crema, gel, ungüento, inyectable, supositorio, óvulo, sobre, parche, spray, inhalador) o «sin forma». Cómo se obtiene: D-06.
3. **Duplicado real** (bloquea la fila, indicando fila y causa): misma identidad completa, o mismo código del archivo (D-02). El mismo producto de otro laboratorio, marca o forma **no** es duplicado.
4. **Productos nuevos**: la farmacia **propone** y un revisor de plataforma **aprueba** (D-04, D-05); las propuestas de un producto ya aprobado se vinculan solas (D-09).
5. **Reimportar sin perder ni duplicar**: las farmacias vuelven a importar su archivo; lo ya importado se conserva y el inventario «sin laboratorio» queda reemplazado por el producto con laboratorio, sin duplicarse en la búsqueda (D-07, D-08).
6. **Mostrar** laboratorio, marca y forma en búsqueda, comparables, reservas, historial y tarjetas del asistente; el asistente usa la forma del catálogo para sus alternativas.

## Historias de usuario
- **US1 (P1)** Importo mi archivo y los productos de laboratorios distintos aparecen como productos distintos; solo veo como duplicado lo que de verdad se repite.
- **US2 (P1)** Vuelvo a importar mi archivo completo y entran las filas que antes se excluyeron, sin perder lo que ya tenía y sin que mis productos salgan dos veces en la búsqueda.
- **US3 (P1)** Desde la vista previa propongo de una vez los «pendientes de catálogo» (con su forma, si la sé) y veo el estado de cada propuesta.
- **US4 (P1)** Como revisor apruebo, rechazo (con motivo) o marco como «ya existe» cada propuesta, de una en una o por lote revisado con muestra.
- **US5 (P1)** En la búsqueda, mis reservas y el asistente veo laboratorio, marca y forma; el asistente ofrece alternativas con la misma forma aunque la presentación diga «caja x 30».
- **US6 (P1)** Ninguna farmacia ve propuestas, inventario ni archivos de otra.

## Permisos y roles (sin cambios respecto a lo aprobado)
| Quién | Puede | No puede |
|---|---|---|
| Propietario (capacidad nueva `catalog.propose`, al activar la farmacia; delegable) | Proponer productos y ver el estado de **sus** propuestas | Escribir en el catálogo; ver propuestas ajenas |
| Trabajador con `catalog.propose` delegada | Lo mismo, solo en su farmacia | Delegar; aprobar |
| Revisor de plataforma (`CATALOG_REVIEW`, con segundo factor) | Ver la ficha propuesta y aprobar, rechazar o vincular | Ver inventario, precios o archivos; decidir sobre una farmacia donde sea miembro |
| Público y clientes | Ver productos aprobados | Ver propuestas |

Estados: `PROPUESTA → APROBADA | RECHAZADA (con motivo) | YA_EXISTE (vinculada)`. El catálogo solo lo escribe una función de base de datos que comprueba la capacidad y deja auditoría.

## Requisitos
- **F022-FR-001**: El catálogo DEBE incluir laboratorio, marca y forma farmacéutica y usarlos en la identidad y la conciliación de importación.
- **F022-FR-002**: La migración DEBE conservar productos, inventarios, movimientos, reservas e importaciones existentes. Solo añade columnas (vacías en los 518 productos actuales) y tablas nuevas, y **reemplaza una restricción de unicidad** por otra que incluye forma, laboratorio y marca. No reescribe filas existentes (D-07).
- **F022-FR-003**: Duplicado real según «Qué se construye» 3; cada aviso indica fila, fila repetida y causa (identidad o código).
- **F022-FR-004**: El detector DEBE reconocer columnas opcionales de código, laboratorio, marca y forma, con las reglas deterministas de F02.1; si una columna es dudosa, se pregunta.
- **F022-FR-005**: La conciliación nunca equipara productos de distinto laboratorio, marca, forma, concentración o presentación; lo no exacto queda pendiente.
- **F022-FR-006**: Forma farmacéutica según D-06; un valor fuera de la lista no bloquea la fila: queda «sin forma» con aviso.
- **F022-FR-007**: Reimportación según D-08: lo importado antes se conserva (precio, unidades, historial y reservas); ninguna farmacia queda con el mismo producto publicado dos veces; la vista previa anuncia cuántos productos «sin laboratorio» se reemplazarán y la farmacia lo confirma.
- **F022-FR-008**: Búsqueda pública (contrato de búsqueda 0.4.0), comparables, sugerencias, reservas, historial/CSV, inventario y tarjetas del asistente (conversación 2.1.0) DEBEN mostrar laboratorio, marca y forma sin cambiar su comportamiento; versión nueva de la caché.
- **F022-FR-009**: El asistente DEBE usar la forma del catálogo para las alternativas («mismo principio activo, concentración y forma») y, si el catálogo no la tiene, la deducción de la presentación de F06.2. La regla de D-04 de F06.2 no se relaja.
- **F022-FR-010**: Propuestas con RLS y `FORCE RLS` por farmacia; revisor solo con `CATALOG_REVIEW` y sin datos privados; **sin BYPASSRLS** ni permisos globales implícitos; las políticas existentes no se relajan.
- **F022-FR-011**: Cada decisión queda auditada (quién, cuándo, motivo; las vinculaciones automáticas de D-09 también); aprobar es idempotente y no duplica el catálogo ante concurrencia.
- **F022-FR-012**: Tras aprobar, una vista previa nueva concilia el producto; nada entra al inventario sin la confirmación de la farmacia.
- **F022-FR-013**: Pruebas de aislamiento Alfa/Beta y regresión de F02–F04, F03.1/F03.2, F06.2, F07.1/F07.2, F08.1 y F02.1. Las pruebas con base de datos usan bases TEST efímeras del clúster de pruebas; las de navegador, la copia temporal **3001/5174** con `scripts/copy/start-copy.mjs`. Nada usa los puertos 3000/5173 de la DEMO sin pedírselo antes a Andre.
- **F022-FR-014**: US$0; sin servicios externos ni IA; sin tocar producción ni `farmafind_f01_test`. La DEMO recibe las migraciones solo cuando Andre la reinicie, con copia de seguridad previa.

## Criterios de éxito
- **SC-001**: con los archivos de la DEMO, al reimportar quedan como duplicadas solo las filas realmente repetidas (misma identidad o mismo código). Objetivo: que las 2780 filas «duplicadas» de hoy entren como productos distintos si de verdad difieren en laboratorio, marca o forma.
- **SC-002**: cero accesos cruzados Alfa/Beta a propuestas; el revisor nunca lee inventario.
- **SC-003**: el 100 % de los productos, inventarios, movimientos, reservas e importaciones existentes sobreviven a la migración (conteos y claves iguales).
- **SC-004**: proponer → aprobar → reimportar → confirmar funciona de punta a punta en TEST; tras confirmar, cada producto de la farmacia aparece **una sola vez** en la búsqueda.
- **SC-005**: el asistente ofrece alternativas de un producto cuya presentación es «caja x 30» cuando el catálogo tiene su forma.

## Decisiones
### Ya aprobadas el 2026-11-25 (se mantienen)
- **D-01 = A** forma farmacéutica en la identidad. **D-02 = A** mismo código con datos distintos bloquea. **D-03 = A** productos sin laboratorio solo coinciden con filas sin laboratorio. **D-04 = A** propuesta en lote con aprobación por lote revisado (muestra del 5 %, mínimo 10, máximo 30). **D-05 = A** capacidad `CATALOG_REVIEW` separada.

### Nuevas, para aprobar (recomendación primero)
- **D-06 · Cómo se obtiene la forma al importar**
  - **A)** Si el archivo trae columna de forma, se usa (texto llevado a la lista; si no coincide, «sin forma» con aviso). Si no, se deduce de la presentación y el nombre con la regla de F06.2 (exactamente una forma reconocible). Si no se puede, queda «sin forma». En «Proponer los pendientes» la farmacia puede elegir la forma por grupo o por fila, o dejarla «sin forma». Un producto «sin forma» se publica, pero no entra en las alternativas del asistente.
  - B) La forma es obligatoria para proponer (más trabajo para las farmacias; con «caja x N» habría que elegirla en cientos de filas).
- **D-07 · Los 518 productos actuales sin laboratorio**
  - **A)** Se conservan tal cual: laboratorio, marca y forma vacíos. **No hay migración de datos**, solo columnas nuevas; nada se reescribe. Siguen sirviendo a quien importe sin columna de laboratorio.
  - B) Deducir y guardar su forma con una actualización de datos (reescribe filas existentes; con «caja x N» casi todas quedarían igual de vacías).
- **D-08 · Reimportar sin duplicar**
  - **A)** Al confirmar una importación cuyas filas tienen laboratorio, la fila de inventario de **esa farmacia** en el producto «sin laboratorio» equivalente (mismo nombre, concentración, presentación y condición) queda **reemplazada**: pasa a 0 unidades con un movimiento «reemplazado por producto con laboratorio». No se borra: conserva su historial y sus reservas, y deja de publicarse. La vista previa lo anuncia («Se reemplazarán N productos sin laboratorio») y la farmacia confirma. Si tiene unidades comprometidas en reservas abiertas, no se reemplaza y se avisa para reintentar después.
  - B) Dejar los dos (el mismo producto saldría dos veces en la búsqueda).
  - C) Mover el inventario al producto nuevo (no es posible: las reservas apuntan al producto).
- **D-09 · Propuestas repetidas entre farmacias**
  - **A)** Si la identidad exacta ya está aprobada en el catálogo, la propuesta se vincula sola (`YA_EXISTE`, auditada como automática) y no llega al revisor. Así el revisor revisa cada producto una sola vez aunque lo vendan las cinco farmacias.
  - B) Todas pasan por el revisor.
- **D-10 · Opción C de F03.2 (texto limpio guardado en el catálogo)**
  - **A)** Dejarla para después. Razones: la búsqueda tarda hoy ≤ 16–19 ms con 5180 ofertas (medido en F03.2), así que no hay ganancia visible. Exigiría una columna de `f02` calculada con una función de `f03` (las migraciones de `f02` corren antes que las de `f03`), lo que acopla módulos. Y cambiar la limpieza obligaría a recalcular el catálogo. No es sencilla junto con estos cambios.
  - B) Incluirla en `f03/004`.
- **D-11 · Cómo llegan a la DEMO los productos con laboratorio**
  - **A)** Por el flujo real, a mano en el navegador: cada farmacia reimporta su archivo, propone los pendientes, el revisor aprueba por lotes con muestra, la farmacia reimporta y confirma. Con D-09, el revisor ve cada producto una vez. No hay carga por script ni cambio directo de datos.
  - B) Carga offline TEST de productos con laboratorio desde los archivos, como la del catálogo actual (rápido, pero salta la revisión; requeriría tu aprobación aparte y copia de seguridad).
- **D-12 · Búsqueda por laboratorio y marca**
  - **A)** La marca cuenta como nombre al buscar («Panadol» encuentra Panadol). El laboratorio se muestra y suma coincidencia, pero no basta solo («genfar» sin nombre de producto pide escribir el nombre, como hoy con la presentación).
  - B) Permitir buscar solo por laboratorio.

## Datos existentes y copia de seguridad
- La única operación sobre datos existentes es el cambio de la restricción de unicidad (y las columnas nuevas vacías). Con D-07 A y D-11 A **no hay migración de datos**; los cambios de inventario (D-08) los hace cada farmacia al confirmar su importación, con su vista previa.
- La DEMO recibe las migraciones cuando Andre la reinicie con `demo-run.ps1` (aplica las migraciones al arrancar). Antes: copia de seguridad `pg_dump` de su base con nombre y tamaño; si falla, no se sigue. Después: foto en solo lectura con conteos iguales (productos, inventario, movimientos, reservas, importaciones, usuarios, membresías).
- Antes, la migración se prueba sobre una **copia** de una base TEST con datos parecidos (conteos y claves antes y después).

## Fuera de alcance
Registro sanitario o validación legal, imágenes, precios sugeridos, fusión masiva de productos históricos, retirar del catálogo los productos «sin laboratorio» (quedan sin ofertas cuando todas las farmacias reimporten), opción C de F03.2 (si D-10 = A), producción y F09.

## Riesgos
- Cambia la identidad que usan búsqueda, reservas, importación y asistente: regresión amplia.
- Capacidades nuevas = cambio de autorización: matriz de pruebas obligatoria.
- D-08 cambia inventario de forma masiva al confirmar: debe ser atómico, visible en la vista previa y reversible solo con una nueva importación.
- Volumen: la DEMO tendría unas 5350 filas a proponer; con D-09 el revisor ve cada producto distinto una vez, en lotes de hasta 1000.
- Las fórmulas de búsqueda y caché cambian de versión (contrato de búsqueda 0.4.0, conversación 2.1.0).
