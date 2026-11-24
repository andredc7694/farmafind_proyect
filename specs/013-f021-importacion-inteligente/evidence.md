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
