# Evidencia de implementación F02.1 — 2026-11-22

## Alcance comprobado en este bloque

La especificación y el plan recibieron aprobación humana expresa el 2026-11-22, registrada en `approval.md`. Se implementó inspección read-only de CSV/XLSX, selección explícita de hoja y encabezado ligada a SHA-256 del archivo, sugerencias conservadoras de seis campos, líneas físicas de CSV, múltiples incidencias por fila, persistencia RLS de incidencias y perfiles privados, y rutas/controles React correspondientes. El importador F02 con mapeo explícito permanece disponible. No se modificó la base persistente `farmafind_f01_test`; las suites PostgreSQL crearon y eliminaron únicamente sus bases TEST efímeras.

| Comprobación realmente ejecutada | Resultado |
|---|---|
| `npx vitest run backend/tests/inventory/f021-file-analysis.test.ts backend/tests/inventory/f021-mapping.test.ts backend/tests/inventory/f021-incidents.test.ts backend/tests/inventory/f021-inspect.test.ts` | 4 archivos, 10 pruebas satisfactorias. |
| `npx vitest run backend/tests/inventory/f021-profile.test.ts` | 3 pruebas satisfactorias, incluida la compatibilidad de versión/hoja/encabezados. |
| `npx vitest run backend/tests/inventory/f021-confirm.test.ts frontend/tests/f021-import-errors.test.jsx` | 2 pruebas satisfactorias. |
| `npx vitest run frontend/tests/f021-import-flow.test.jsx` | 3 pruebas satisfactorias; selección explícita, perfil compatible e invalidación visual de la vista previa anterior. |
| Suite focal conjunta F02.1, 2026-11-22 | 8 archivos, 21 pruebas satisfactorias tras el control de encabezados ambiguos. |
| `node scripts/f02/check.mjs unit` | 5 archivos, 15 pruebas satisfactorias. |
| `node scripts/f02/check.mjs rls` | 15 pruebas PostgreSQL/HTTP satisfactorias, incluida selección desplazada, dos incidencias persistidas, status y perfil privado. |
| `backend/tests/inventory/f021-rls.test.ts` con `F01_TEST_DATABASE_URL` local ignorada y base efímera | 3 pruebas satisfactorias; FORCE RLS, rol sin BYPASSRLS, Alfa/Beta, reutilización de conexión e incidencias. |
| `npm run test:f03:unit` / `npm run test:f03:integration` / `npm run test:f03:rls` | 25 / 3 / 4 pruebas satisfactorias. Redis se inició solo para integración y volvió a detenerse. |
| `npm run test:f04:unit` / `npm run test:f04:api` | 18 / 6 pruebas satisfactorias. |
| `node scripts/f025/check-f04-rls.mjs` | 18 pruebas PostgreSQL F04 satisfactorias en clúster TEST marcado; F02.5 volvió a quedar detenida. |
| `npm run check` / `npm run build` | Arquitectura y TypeScript correctos; compilación completa de frontend, backend y Notificaciones satisfactoria tras el último cambio React. |
| `npm run verify:contracts` | 41 operaciones OpenAPI con rutas Express. |
| `node scripts/f021/run-browser-linux.mjs` sobre fixture F02 TEST marcado | 4/4 recorridos Playwright Linux: CSV con encabezado desplazado, corrección de precio/cantidad vacíos, XLSX mult hoja y resolución obligatoria de columnas ambiguas. Perfil guardado, confirmación, inventario propio y búsqueda pública actualizada visibles. El contenedor montó solo test, ejecutor, `package.json` y `node_modules` de lectura, nunca el repositorio completo ni `.cache`. |

La ejecución de navegador verificó que el fixture existente estaba marcado `F02_FIX01_TEST_ONLY` y que su base coincidía con el nombre efímero; aplicó `005_smart_import.sql` y las migraciones F03 aprobadas solo si faltaban en ese fixture. Se añadieron únicamente metadatos públicos ficticios a Alfa en el fixture; no se ejecutaron migraciones ni escrituras sobre `farmafind_f01_test`. Frontend y API se iniciaron temporalmente y el ejecutor los detuvo. PostgreSQL F01 y Redis F03, detenidos antes de la prueba, volvieron a detenerse sin borrar volúmenes.

La primera invocación directa de `npm run test:f04:rls` falló antes de ejecutar sus 13 casos porque ese test exige el clúster efímero F02.5 marcado, distinto del contenedor F01 que estaba activo. Se utilizó el ejecutor correcto `scripts/f025/check-f04-rls.mjs`: 18/18 satisfactorias. La primera prueba de interacción React falló por el envío de formulario en jsdom; se corrigió el estímulo de prueba y pasó. La primera prueba HTTP de perfil carecía de `express.json()` en la aplicación de prueba; se añadió y pasó. No se ocultaron esas incidencias.

Un primer intento de la suite focal y compilación quedó bloqueado antes de ejecutar pruebas por `spawn EPERM` de esbuild en el sandbox. La misma suite y compilación pasaron con ejecución local permitida. `docker info` confirmó motor Linux 29.9.3 antes de Playwright.

La primera repetición ampliada de Playwright falló en la segunda prueba porque reutilizaba un archivo inválido idéntico de una corrida previa en el fixture TEST; la vista previa no volvió a generarse. Se añadió un identificador ficticio aleatorio a esa muestra y la repetición completa pasó 3/3. No se modificaron expectativas ni reglas de negocio para ocultar el fallo.

**Estado de tareas:** 37/38 verificadas; solo T038 requiere aceptación humana expresa. T014/T020/T022/T025/T032 reutilizan pruebas de integración ya existentes, documentadas en `tasks.md`, para evitar suites duplicadas. Los siete criterios de éxito tienen evidencia técnica en TEST/DEMO, sin equivaler a aceptación humana ni aptitud productiva.

## Pendientes reales

- T038 sigue pendiente de aceptación humana. [traceability.md](traceability.md) registra la cobertura técnica y los límites TEST/DEMO sin asignar puntajes.
- Las pruebas aquí registradas no constituyen aceptación F02.1 ni aprobación de MEJ-002 completa; la parte no relacionada con importación permanece pendiente.
- F02.5 continúa suspendida y no aceptada. No se probó ni modificó su base manual persistente.

# Verificación previa a la aceptación T038 — 2026-11-23

Ejecutada por Claude Code (PowerShell, Windows 10, Node 24.17.0) tras la migración desde Codex. **No es aceptación**: T038 sigue pendiente de decisión humana.

## Cambio de código fuera de las tareas originales (aprobado por Andre el 2026-11-23)

La medición de límites pedida por `plan.md` («medir tiempo y memoria con archivos límite») reveló un defecto de rendimiento en `backend/src/modules/inventario/infrastructure/file-parser.ts`: `sheet.columnCount` se reevaluaba en cada celda y esa propiedad recorre toda la hoja. Un XLSX de 5000 filas × 50 columnas (1.54 MB, dentro de los límites) superó 6 minutos de CPU sin terminar y se detuvo manualmente; 1000×50 tardó 13 s y 2000×50 unos 84 s en un experimento aparte. Corrección: calcular `rowCount`/`columnCount` una sola vez en `readSheets` (F02.1) y `parseInventoryFile` (importador F02 anterior, mismo patrón). Sin cambio de comportamiento. Commit local `c4c5f4e` «fix(f02): evitar recálculo de columnCount en el parser». Tras el cambio, 12/12 pruebas de parser/preview/confirm y la suite completa siguientes pasaron.

## Pruebas ejecutadas (resultado real)

| Comprobación | Resultado |
|---|---|
| Suite focal F02.1 (8 archivos) | 21/21 satisfactorias |
| `npm run test:f02:unit` | 15/15 |
| `npm run test:f03:unit` | 25/25 |
| `npm run test:f03:integration` (Redis TEST local) | 3/3 |
| `npm run test:f04:unit` / `npm run test:f04:api` | 18/18 / 6/6 |
| `npm run check` / `npm run build` | correctos |
| `npm run verify:contracts` | 41 operaciones OpenAPI con ruta Express |
| `node scripts/f02/smoke.mjs` sobre el fixture TEST marcado | sesión, selector, catálogo y accesos Alfa/Beta verificados |

**No ejecutadas en este bloque:** `test:f02:rls`, `test:f03:rls`, `f021-rls` y `test:f04:rls` (ver «Pendientes»). Los resultados de RLS de `evidence.md` anterior (2026-11-22) no se repiten aquí.

## Medición de tiempo y memoria con archivos al límite

`node scripts/f021/measure-limits.mjs 3`: Node 24.17.0, Windows x64, mediana de 3 repeticiones, proceso hijo limpio por caso, en memoria (sin BD, Redis ni HTTP). Pipeline: inspección + selección + sugerencia de mapeo + conciliación. Pico = `maxRSS` del proceso. Límites F02: 5 MiB, 5000 filas, 50 columnas. Datos 100 % ficticios en `.cache/f021-perf` (ignorado).

| Caso | Tamaño | Resultado | Tiempo total | Pico RSS |
|---|---|---|---|---|
| CSV 5000 filas × 50 col | 5.13 MB | procesado; 6168 incidencias | 523 ms | 130 MiB |
| XLSX 5000 filas × 50 col | 1.54 MB | procesado; 6168 incidencias | 2761 ms | 366 MiB |
| XLSX 5 hojas × 1000 filas × 20 col | 0.39 MB | procesado | 2024 ms | 246 MiB |
| CSV 5001 filas | 0.73 MB | rechazado («excede límite») | 390 ms | 73 MiB |
| CSV 14.5 MB | 14.5 MB | rechazado («excede límites») | 1 ms | 62 MiB |

Limitaciones: no incluye persistencia PostgreSQL de miles de incidencias, confirmación ni HTTP; no se definió un umbral nuevo (el plan prohíbe inventarlo). Los 5 MiB exactos solo se alcanzan en CSV; un XLSX de 5000×50 pesa mucho menos comprimido.

## Pendientes de esta verificación

- Las suites `test:f02:rls`, `test:f03:rls` y `f021-rls` (y `test:f04:rls` en el clúster F02.5) **no se ejecutaron**: las tres primeras se conectan a `farmafind_f01_test` como canal administrativo para crear y borrar sus propias bases efímeras, y la instrucción vigente de Andre prohíbe cualquier operación sobre esa base. Se espera su decisión.
- Revisión manual en navegador y T038: pendiente de Andre. Observación para esa revisión: la interfaz no tiene un botón «Cancelar»; F021-FR-009 se cumple por abandono (no confirmar no persiste nada).

# Reejecución de suites RLS con fixture TEST marcado — 2026-11-23

Ejecutadas por Claude Code (PowerShell, Node 24.17.0) tras la aceptación de T038, en cumplimiento de la instrucción de Andre de «ejecutarlas con el fixture marcado como TEST, sin escrituras sobre `farmafind_f01_test`».

**Cambio de pruebas (aprobado por Andre el 2026-11-23):** las suites `rls-foundation`, `f021-rls` y `public-projection.rls` ya no admiten `farmafind_f01_test`: su protección ahora exige un fixture marcado `farmafind_f01_test_<12 hex>` y rechaza la base persistente. Los scripts `scripts/f02/check.mjs` y `scripts/f03/check.mjs` obtienen la URL administrativa de `scripts/f01/fixture-admin-url.mjs`, que valida el marcador `F02_FIX01_TEST_ONLY` en `.cache/f02-fixture/state.local.json`. Cada suite crea y elimina sus propias bases efímeras.

| Suite | Resultado |
|---|---|
| `npm run test:f02:rls` (rls-foundation) | 15/15 satisfactorias |
| `npm run test:f03:rls` | 4/4 satisfactorias |
| `f021-rls.test.ts` (con URL del fixture) | 3/3 satisfactorias |
| `node scripts/f025/check-f04-rls.mjs` (clúster F02.5 marcado; se detuvo al terminar) | 18/18 satisfactorias |

**Comprobación de la base persistente:** consulta de solo lectura antes y después: 3 usuarios, 3 sesiones, 0 farmacias, 0 membresías y la misma lista de bases; sin diferencias. Las suites no dejaron bases efímeras nuevas. Contenedores encendidos por Claude detenidos; sin borrar volúmenes.

No se repitió Playwright. Esto cierra el pendiente «Pendientes de esta verificación» de la sección del 2026-11-23 anterior para las cuatro suites RLS.

## Enmienda 2026-11-25 — resultados reales
- Causa de T046: «Preparar vista previa» sin análisis usaba el importador F02 (una sola hoja) y la interfaz convertía cualquier 400 en un mensaje genérico; además una fecha/fórmula en cualquier hoja rechazaba todo el archivo.
- Archivo real del usuario (leído localmente, no copiado al repositorio): **una sola hoja «Precios»** (1100 filas, 18 columnas), no tres; stock en la columna `stock_disponible`; `fecha_actualizacion` con 1100 fechas. Con el detector: hoja y seis columnas propuestas sin preguntas en ~0,3 s (`nombre_generico`, `concentracion`, `presentacion`, `condicion_venta`, `precio_regular_soles`, `stock_disponible`). Contra un catálogo vacío: 517 pendientes de catálogo y 583 filas duplicadas (mismo producto de distintos laboratorios: el catálogo no distingue laboratorio ni marca).
- Pruebas: inventario unit 39/39 (nuevas 8 en `f021-detector.test.ts`), F02 RLS 15/15, F021 RLS 3/3, F03 unit 33 / RLS 9, F04 api 25, frontend 210/210, E2E F02 3/3, F02.1 5/5, F08.1 7/7, check, build y contratos. Sin cambios de RLS, permisos ni migraciones.
- Pruebas ajustadas por cambio de requisito: la que exigía rechazar fórmulas en hojas no elegidas, y los recorridos que pulsaban «Analizar»/«Preparar vista previa».

## Avisos agrupados y catálogo de DEMO — 2026-11-25
- Vista previa con resumen, filtros, páginas de 50 y avisos agrupados (detalle de 20 en 20). Frontend 211/211, inventario unit 39/39, build y check.
- `load-demo-catalog.mjs` (guardas: clúster `farmafind-f025-test`, base marcada TEST, estado local; nunca producción ni `farmafind_f01_test`): 1100 filas → 517 productos distintos añadidos al catálogo en la base manual y en la técnica; copia local sin filas repetidas (`.cache/f025-docker/imports/farma-sin-duplicados.xlsx`, ignorada por Git).
- Flujo completo por HTTP en la base **técnica**: análisis 0,4 s, vista previa 517 filas 1,2 s (repetirla reutiliza la misma), confirmación 200 en 4,8 s, 0 errores.

## Pantallas del panel — 2026-11-25 (T048–T052)
- **Verificación previa:** la lista de inventario no estaba implementada. «Existencias propias» mostraba el identificador porque buscaba el nombre solo entre las 50 primeras referencias del catálogo, y el listado cortaba en 500 filas.
- **Cambios:** el listado, los movimientos y el historial unen el catálogo compartido (solo lectura); límite del inventario 5000. El historial añade autor y conteos; el detalle, los cambios aplicados. Sin migraciones, políticas ni permisos nuevos. La pestaña Historial aparece también con solo `inventory.history`.
- **Nombre del archivo:** no se guarda hoy. Guardarlo exige columna y permiso de inserción nuevos, y el nombre puede contener datos personales; queda sin implementar hasta que Andre decida.
- **Autor:** «Tú»; el nombre del trabajador solo para quien administra personal (mismo listado ya autorizado); en otro caso «Otra persona de tu farmacia».
- **Laboratorio:** no existe todavía como dato (spec 020).
- **Hallazgo del recorrido, corregido:** «Actualizados» contaba filas iguales; ahora solo cambios de precio o stock y se informa «Sin cambios».
- **Pruebas:** frontend e inventario sin RLS 256/256; F02 RLS 15/15; F021 RLS 3/3 + lecturas nuevas Alfa/Beta 3/3 (misma conexión reutilizada, rol sin BYPASSRLS); navegador F02 3/3, F02.1 5/5, F08.1 7/7, flujo integrado 4/4, accesibilidad 4/4; `check`, contratos (41 operaciones) y build correctos. En la primera corrida de navegador fallaron 1 caso F02 (tiempo agotado) y 1 F02.1 (la página no cargó); ambos pasaron al repetir y en la corrida final.
- **Recorrido en la base TEST técnica** con las 517 referencias derivadas del archivo de Andre: 517 productos con nombre (43 sin stock, 1 stock bajo), importación con 20 precios cambiados → 20 actualizados y 497 sin cambios, sin identificadores ni códigos en pantalla, sin desplazamiento horizontal a 390 px.
- **No ejecutado:** el ensayo F02.5 `browser-five.mjs` (solo se ajustaron sus dos selectores).

## Exclusión explícita e historial detallado — 2026-11-25 (T053–T056)
- **Sin migración**, sin cambios de RLS, políticas ni permisos. `POST …/confirmar` admite un cuerpo opcional `{excluir:{duplicadas,pendientes}}`; sin cuerpo se comporta como antes.
- **Guardas:** los conteos deben coincidir con la vista previa guardada; solo son excluibles `FILA_DUPLICADA` y `REFERENCIA_NO_CONCILIADA` (un precio o cantidad inválidos tienen prioridad sobre «duplicada» al clasificar); una decisión que no calza no cambia inventario ni vista previa.
- **Repetir el archivo:** con el mismo resultado responde «ya se confirmó»; si los productos pendientes entran al catálogo o el archivo se corrige, se puede importar. Un duplicado exacto del mismo archivo no se importará hasta que se distinga (spec 020) o se corrija el archivo.
- **Archivo original del usuario** en la base TEST técnica: 1100 filas, 517 listas, 583 por revisar; excluir y confirmar importó 517 en 5,5 s. **En 582 de las 583 filas repetidas el precio o el stock difiere** de la primera fila: son ofertas distintas que hoy no se pueden representar sin laboratorio (spec 020).
- **Pruebas:** frontend e inventario sin RLS 266/266; F02 RLS 15/15; F021 RLS 12/12 (6 de exclusión, 3 de lecturas, 3 previas); navegador F02 3/3, F02.1 6/6, F08.1 7/7, flujo integrado 4/4, accesibilidad 4/4. Una corrida de F02.1 falló porque el detalle tardó más de 5 s; con espera registrada y dos repeticiones pasó 6/6, y se amplió esa espera a 20 s.

## Búsqueda pública vacía tras confirmar (F021-SC-006) — 2026-11-25
- **Observado por Andre:** importación confirmada (517) y búsqueda «Aciclovir»/«ac» sin ofertas.
- **Causa (consultas de solo lectura en la DEMO):** F03 solo publica productos con principio activo; 517 de 518 referencias del catálogo TEST no lo tenían porque `load-demo-catalog.mjs` no lo cargaba. Proyección pública de la farmacia, estado, stock, caché y búsqueda parcial estaban bien.
- **Corrección:** solo el script TEST (toma `nombre_generico`/`principio_activo`; completa los vacíos, nunca reemplaza). Sin cambios de contratos, reglas F03, RLS ni permisos.
- **Verificado en la DEMO:** 475 ofertas publicables; «Aciclovir» devuelve 7 de la farmacia; la respuesta no incluye stock.
- **Límite conocido:** un producto del catálogo sin principio activo no aparece en la búsqueda y la vista previa no lo avisa. La spec 020 debe exigirlo al aprobar productos nuevos (pendiente de decisión).
