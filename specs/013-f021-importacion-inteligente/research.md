# Investigación técnica F02.1 — 2026-11-22

## Estado comprobado

- F02 usa `@excel.js/exceljs@0.15.0`, `csv-parse@7.0.3` y `busboy@1.6.0`; `file-parser.ts` limita 5 MiB, 5000 filas, 50 columnas y expansión XLSX, pero rechaza libros con más de una hoja y trata la primera fila como encabezado.
- `ImportPreview.jsx` exige mapeo manual inicial y muestra un único `errorCode` por fila. `reconcileImportRows` reemplaza errores de precio y cantidad por `VALOR_INVALIDO`; el número de fila presupone encabezado en línea 1.
- `PreviewImport` crea una vista previa en PostgreSQL antes de confirmar, sin escribir inventario. `ConfirmImport` bloquea el registro, revalida estado/autorización, aplica filas bajo Unit of Work y llama al invalidador de búsqueda después del commit. F02 RLS y F04 mantienen compromisos de stock.
- El maestro v3.2 exige MEJ-001/HU11/RF22–24 y MEJ-002/HU12/RF25/AC12–13. Por decisión humana, F02.1 cubre de MEJ-002 solo errores de importación.

## Muestras ficticias y compatibilidad verificada

Las pruebas `f021-file-analysis.test.ts`, `f021-mapping.test.ts` y `f021-incidents.test.ts` usan únicamente datos inventados: CSV con preámbulo y encabezado desplazado, CSV con campo entrecomillado multilínea, XLSX con hoja de notas y hoja de inventario, dos hojas igualmente plausibles, archivo demasiado grande, hoja de 51 columnas, fórmula en hoja no seleccionada y fila con precio/cantidad vacíos. La prueba F02 existente conserva CSV/XLSX de una hoja con mapeo explícito. No se emplearon inventarios reales ni equivalencias clínicas implícitas.

## Decisiones propuestas

| Tema | Decisión | Motivo y alternativa |
|---|---|---|
| Detección de hoja y encabezado | Inspección determinista acotada que devuelve candidatos y exige confirmación si hay empate. | Evita elegir una hoja equivocada; alternativa de primera hoja falla archivos heterogéneos. No se añade IA. |
| Sinónimos | Diccionario versionado en español, solo correspondencias exactas normalizadas; ambigüedad queda sin resolver. | Heurística libre puede mapear campos clínicos erróneamente. |
| Archivo entre inspección y preview | Reenvío del archivo y huella para verificar que la selección corresponde al mismo contenido; no guardar bytes originales. | Sesión de carga persistente aumenta retención y riesgo; alternativa de frontend solamente no es autoridad. |
| Errores | Colección de incidencias por fila/campo; mantener `errorCode` legado para consumidores existentes. | Un código único no expresa precio y cantidad vacíos simultáneamente. |
| Perfil tenant | Tabla propia con farmacia, versión de esquema y huella de encabezados; acceso con capacidad y RLS. | Un perfil global comparte datos privados; JSON sin índice/owner debilita aislamiento. |
| Confirmación | Reutilizar transacción y bloqueos F02, revalidando referencias y compromisos. | Reescribir confirmación arriesga F04. |
| Proyección pública | Invalidar F03 solo después del commit confirmado. | Mantiene Cache-Aside y evita publicar datos de preview. |
| Límites | Conservar 5 MiB/5000 filas/50 columnas y controles XLSX actuales; inspección no los relaja. | Abrir límites sin medición permite abuso. |

## Pendientes de validación, no bloqueantes para redactar el plan

1. Probar con archivos ficticios representativos las variantes de encabezados y sinónimos antes de cerrar el diccionario. No se usarán datos reales.
2. Verificar en PostgreSQL TEST la política RLS exacta de perfiles e incidencias y el impacto de migración aditiva antes de aplicarla fuera de TEST.
3. Medir memoria y tiempo de inspección en archivos límite; si excede presupuesto local, volver a revisión sin subir límites automáticamente.
4. El contrato detallado y las tablas son propuestas técnicas sujetas a aprobación humana del plan.
