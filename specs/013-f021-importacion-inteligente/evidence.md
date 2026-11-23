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
