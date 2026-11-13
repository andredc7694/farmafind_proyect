# F02 — Evidencia del incremento local

**Fecha:** 2026-11-12. **Rama:** `feat/f02-catalogo-inventario`. **Entorno:** Windows 10, Node.js 24.17.0, npm 11.13.0, PostgreSQL oficial 18.6 local en Docker Desktop y navegador Playwright en Linux oficial. Solo datos ficticios y base FIX-01 aislada. Esta evidencia sustenta la aprobación humana global del incremento F02 TEST/DEMO; no acredita despliegue ni operación productiva.

## Resultado observado

| Control | Comando o procedimiento | Resultado real | Límite |
|---|---|---|---|
| Dependencias | Instalación local registrada en `package-lock.json`; `npm.cmd audit --audit-level=high` | Auditoría npm: 0 vulnerabilidades | No acredita seguridad de un archivo XLSX adversarial no ensayado |
| Análisis estático y compilación | `npm.cmd run check`; `npm.cmd run build` | Pasaron; 60 archivos JavaScript inspeccionados y compilación TypeScript/frontend/Notificaciones satisfactoria | Solo código local |
| Dominio F02 | `npm.cmd run test:f02:unit` | 15 pruebas satisfactorias | Casos de dominio y parseo sintético |
| PostgreSQL F02 | `npm.cmd run test:f02:rls` | 14 pruebas satisfactorias con bases temporales: RLS, A/B, sesión/contexto, revocación, API/CSRF, cambio manual, importación, rollback y concurrencia; repetidas tras restablecer Docker Desktop | Depende de PostgreSQL local |
| Regresión F01 | `npm.cmd run test:f01:rls` con variable privada local | 45 pruebas satisfactorias | No supone aceptación final de F01 |
| Suite base | `npm.cmd run test:base` | 175 satisfactorias; 59 pruebas PostgreSQL omitidas deliberadamente sin conexión en esta suite; las suites F01/F02 PostgreSQL se ejecutaron aparte y suman 59 | No confundir omisiones de esta invocación con pruebas inexistentes |
| Navegador F02 | `docker run` con `mcr.microsoft.com/playwright:v1.65.0-noble` y `scripts/f02/run-browser-container.mjs` | 3 pruebas Playwright satisfactorias en Linux: revisión manual/importación/historial, archivo inválido y denegación A/B, rollback completo al fallar la segunda fila | Entorno de prueba oficial Linux, aplicación local Windows 10 y fixture sintético |
| HTTP integrado FIX-01 | `npm.cmd run verify:f02:demo` | Pasó tras el último refactor: sesión, selector, catálogo, inventario y denegación A/B. Hubo un intento fallido mientras Docker Desktop estaba detenido; se corrigió iniciando únicamente el motor y PostgreSQL locales | No sustituye navegador |
| Datos persistentes y fixture | `node scripts/f02/fixture.mjs verify` | Pasó tras restablecer PostgreSQL: base F01 persistente con los mismos recuentos antes/después; FIX-01 con 2 farmacias, 3 usuarios ficticios y 3 membresías. Inventario y movimientos con `ENABLE` y `FORCE ROW LEVEL SECURITY` | Fixture exclusivo TEST/DEMO |
| Git y secretos | `git diff --check`; `git check-ignore` para `.cache`, `dist`, `node_modules`; inspección de cambios y búsqueda de literales sensibles | `diff --check` sin errores; archivos locales privados y artefactos ignorados. Ningún secreto se publicó en esta evidencia | Revisar de nuevo antes de un eventual commit |

Las pruebas HTTP/RLS usan roles separados de migración, autenticación y runtime. El runtime carece de `SUPERUSER` y `BYPASSRLS`; la autorización SQL comprueba sesión vigente, membresía activa, farmacia y capacidad dentro de una transacción. Se probaron denegaciones de actor Alfa sobre Beta, trabajador sin permiso, sesión falsa, falta de contexto y revocación. La actualización manual conserva movimiento y stock en una transacción; confirmación de importación se verificó para éxito, repetición idempotente, rollback y dos conexiones concurrentes. Estas afirmaciones se limitan a los casos de las suites indicadas.

La ejecución Playwright usó la imagen `mcr.microsoft.com/playwright:v1.65.0-noble` (Ubuntu 24.04), el mismo paquete Playwright 1.65.0 del proyecto y un montaje de solo lectura del repositorio. La API y Vite se iniciaron temporalmente en Windows 10; un puente TCP dentro del contenedor conservó `Host` y `Origin` hacia esos servicios locales. El archivo privado de variables se generó desde FIX-01 en `.cache/f02-e2e/vars.local.env`, ignorado por Git. La tercera prueba insertó una fila ficticia comprometida solo en FIX-01 y demostró que el conflicto de la segunda fila revierte la primera y deja la importación `RECHAZADA`. La verificación posterior del fixture confirmó que `farmafind_f01_test` sigue intacta.

Los casos de contrato, API y SQL de T015/T021/T029/T035 están consolidados en `backend/tests/inventory/rls-foundation.test.ts`, junto con las pruebas de dominio y parseo en archivos separados. No se crearon los cuatro nombres de prueba sugeridos en tasks.md porque la misma batería integrada usa una base temporal y un conjunto coherente de fixtures; la cobertura funcional se registra por caso, no por nombre de archivo.

## Estado y pendientes

- **local:** `passed` para los controles automáticos disponibles en Windows 10: análisis, compilación, unitarias, API, PostgreSQL RLS, fixture, interacción React en jsdom y auditoría npm.
- **overall:** `passed` para las comprobaciones técnicas automatizadas de F02: la suite Playwright F02 se ejecutó dentro de Linux Ubuntu 24.04 de la imagen oficial versionada, usando los servicios locales y credenciales ficticias privadas. Windows 10 no se declara compatible con el navegador Playwright; el contenedor aportó el entorno oficialmente admitido.
- **acceptance:** aprobada para el alcance F02 TEST/DEMO documentado. F02-SC-001–006 cuentan con pruebas automatizadas, F02-SC-007 con recorrido automatizado de navegador y el usuario aprobó globalmente el paquete de revisión humana el 2026-11-12 en esta conversación. No equivale a habilitación productiva ni a calificación académica.
- **operación real:** la carga FIX-01 solo sirve para TEST/DEMO. GLO-01 (catálogo/permisos globales) y BOOT-01 (alta inicial privilegiada) siguen bloqueados; no existe ruta operativa para otorgarlos. Tampoco se implementaron F03, Redis, AWS ni IA.

## Revisión humana final — T044 cerrada

| Criterio F02 | Evidencia observable para revisión | Estado de la revisión |
|---|---|---|
| SC-001 catálogo sin ambigüedad | Normalización/dos presentaciones en unitarias y catálogo HTTP/RLS | Pruebas pasaron; incluida en aprobación global |
| SC-002 revisión manual íntegra | Dominio, SQL/API y navegador con movimiento antes/después | Pruebas pasaron; incluida en aprobación global |
| SC-003 archivo completo o cero | CSV/XLSX, API/RLS y navegador con rollback de segunda fila | Pruebas pasaron; incluida en aprobación global |
| SC-004 aislamiento A/B y sin contexto | RLS directo, pool reutilizado, HTTP y navegador A/B | Pruebas pasaron; incluida en aprobación global |
| SC-005 compromisos | Dominio, base y rollback de archivo al intentar bajar de comprometido | Pruebas pasaron; incluida en aprobación global |
| SC-006 fecha veraz | Pruebas de dominio/SQL: consulta no revisa, escritura sí | Pruebas pasaron; incluida en aprobación global |
| SC-007 interfaz en español | Tres recorridos Playwright en Linux y pruebas React jsdom | Pruebas pasaron; incluida en aprobación global del 2026-11-12 |

El usuario confirmó el 2026-11-12 que el paquete presentado era correcto y autorizó continuar con lo restante. Se registra esa aprobación como revisión global del alcance F02 y sus siete criterios; no se atribuyen puntuaciones ni aprobaciones individuales no expresadas. GLO-01/BOOT-01 y toda habilitación productiva siguen fuera del alcance autorizado. T044 queda cerrada; la revisión de secretos y archivos preparados se repite antes de versionar.

La evidencia técnica se reunió antes de versionar; un eventual commit o PR se informa por separado y no acredita despliegue. La prueba de navegador añadió solo una fila de inventario de Farmacia Alfa en la base FIX-01 aislada para forzar el conflicto; la verificación posterior confirmó que la base F01 persistente permaneció intacta.
