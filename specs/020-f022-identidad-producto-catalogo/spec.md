# Feature Specification: F02.2 — Identidad del producto (laboratorio y marca) y propuestas de productos nuevos

**Feature Branch**: `feat/f022-identidad-producto-catalogo`
**Created**: 2026-11-25
**Status**: Spec aprobada el 2026-11-25 (D-01..D-05 = A, ver [approval.md](approval.md)). Plan aprobado el 2026-11-25; tasks pendientes de aprobación.
**Origen**: verificación T046 de F02.5. Con un archivo de 1100 filas salieron 517 productos pendientes y 583 «duplicados» que en realidad son el mismo producto de distintos laboratorios. Andre eligió la opción A (2026-11-25).
**Dependencia**: se implementa después de integrar la enmienda F02.1 (importación en un paso), hoy en `feat/f025-cierre-verificacion`.

## Problema (lenguaje sencillo)
El catálogo identifica un producto solo por nombre, concentración, presentación y condición de venta. No distingue laboratorio ni marca, así que productos distintos se toman por repetidos. Además nadie puede agregar los productos que faltan.

## Qué se construye
1. **Identidad del producto**: nombre genérico + concentración + presentación + forma farmacéutica + condición de venta + **laboratorio** + **marca** (marca vacía = genérico). Ver D-01.
2. **Duplicado real** (bloquea el archivo, indicando fila y causa):
   - dos filas con la **misma identidad completa** (mismo producto, concentración, presentación, forma, condición, laboratorio y marca); o
   - dos filas con el **mismo código** del archivo (si el archivo trae código).
   El mismo producto de otro laboratorio u otra marca **no** es duplicado.
3. **Productos nuevos**: la farmacia **propone** y un revisor de plataforma **aprueba**; solo lo aprobado entra al catálogo compartido.

## Historias de usuario
- **US1 (P1)** Importo mi archivo y los productos de laboratorios distintos aparecen como productos distintos; solo veo como duplicado lo que de verdad se repite.
- **US2 (P1)** En la búsqueda pública y en mis reservas veo laboratorio y marca, para no confundir productos.
- **US3 (P1)** Desde la vista previa propongo de una vez los «pendientes de catálogo» y veo el estado de cada propuesta.
- **US4 (P1)** Como revisor apruebo, rechazo (con motivo) o marco como «ya existe» cada propuesta, de una en una o por lote revisado.
- **US5 (P1)** Ninguna farmacia ve propuestas, inventario ni archivos de otra.

## Permisos y roles propuestos
| Quién | Puede | No puede |
|---|---|---|
| Propietario (capacidad nueva `catalog.propose`, incluida al activar la farmacia; delegable a trabajadores) | Proponer productos y ver el estado de **sus** propuestas | Escribir en el catálogo; ver propuestas de otras farmacias |
| Trabajador con `catalog.propose` delegada | Lo mismo, solo en su farmacia | Delegar; aprobar |
| Revisor de plataforma (capacidad nueva `CATALOG_REVIEW`, con segundo factor) | Ver la ficha propuesta y aprobar, rechazar o vincular a uno existente | Ver inventario, precios o archivos de la farmacia; aprobar propuestas de una farmacia donde sea miembro |
| Público y clientes | Ver productos aprobados | Ver propuestas |

Estados: `PROPUESTA → APROBADA | RECHAZADA (con motivo) | YA_EXISTE (vinculada)`. El catálogo solo lo escribe una función de base de datos que comprueba la capacidad y deja auditoría; la aplicación no tiene permiso de escritura directa.

## Requisitos
- **F022-FR-001**: El catálogo DEBE incluir laboratorio, marca y forma farmacéutica y usarlos en la identidad y en la conciliación de importación.
- **F022-FR-002**: La migración DEBE conservar productos, inventarios, reservas e importaciones existentes. Es aditiva en datos (columnas y tabla nuevas) y **reemplaza una sola restricción de unicidad** por otra que incluye laboratorio, marca y forma (sin ese cambio no pueden existir dos laboratorios del mismo producto).
- **F022-FR-003**: La regla de duplicado real es la de «Qué se construye» 2; cada aviso indica fila, fila repetida y causa (identidad o código).
- **F022-FR-004**: El detector DEBE reconocer columnas de código, laboratorio, marca y forma, con las reglas deterministas de F02.1.
- **F022-FR-005**: La conciliación nunca equipara productos de distinto laboratorio, marca, forma, concentración o presentación; lo no exacto queda pendiente.
- **F022-FR-006**: Búsqueda pública, comparables, reservas e historial DEBEN mostrar laboratorio y marca sin cambiar su comportamiento.
- **F022-FR-007**: Propuestas con RLS y `FORCE RLS` por farmacia; lectura del revisor solo con `CATALOG_REVIEW` y sin datos privados; **sin BYPASSRLS** ni permisos globales implícitos; las políticas existentes no se relajan.
- **F022-FR-008**: Cada decisión queda auditada (quién, cuándo, motivo); aprobar es idempotente y no duplica el catálogo ante concurrencia.
- **F022-FR-009**: Tras aprobar, una vista previa nueva concilia el producto; nada se carga al inventario sin la confirmación de la farmacia.
- **F022-FR-010**: Pruebas de aislamiento Alfa/Beta (propuestas, vista previa, revisor, conexión reutilizada) y regresión de F02–F04, F08.1 y F02.1.
- **F022-FR-011**: US$0; sin servicios externos ni IA; sin tocar producción ni `farmafind_f01_test`.

## Criterios de éxito
- **SC-001**: con el archivo ficticio de referencia (1100 filas, 517 combinaciones genéricas, varios laboratorios) los «duplicados» se reducen solo a los realmente repetidos (misma identidad o mismo código).
- **SC-002**: cero accesos cruzados Alfa/Beta a propuestas; el revisor nunca lee inventario.
- **SC-003**: el 100 % de los productos existentes y sus inventarios y reservas sobreviven a la migración.
- **SC-004**: proponer → aprobar → reimportar → confirmar funciona de punta a punta en TEST.

## Decisiones abiertas (recomendación primero)
- **D-01 · Forma farmacéutica en la identidad**: **A** incluirla (evita juntar tableta e inyectable con el mismo envase); B no incluirla.
- **D-02 · Mismo código con datos distintos**: **A** error que bloquea («mismo código, datos distintos»); B solo aviso.
- **D-03 · Productos ya existentes sin laboratorio**: **A** quedan «sin laboratorio» y solo coinciden con filas que tampoco lo indiquen (nunca equivalencia automática); B coinciden con cualquier laboratorio.
- **D-04 · Propuesta en lote**: **A** «Proponer todos los pendientes», con decisión por producto y aprobación por lote revisado; B de uno en uno.
- **D-05 · Quién revisa**: **A** capacidad `CATALOG_REVIEW` separada de la de aprobar farmacias (puede ser la misma persona); B el mismo revisor de farmacias sin capacidad nueva.

## Fuera de alcance
Registro sanitario o validación legal de productos, imágenes, precios sugeridos, fusión masiva de duplicados históricos, producción y F09.

## Riesgos
Cambia la identidad que usan búsqueda, reservas e importación (regresión amplia); las capacidades nuevas son un cambio de autorización (matriz de pruebas obligatoria).
