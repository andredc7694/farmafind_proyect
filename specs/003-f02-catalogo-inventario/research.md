# F02 — Investigación y decisiones de planificación

**Fecha:** 2026-11-12. **Estado:** plan aprobado e implementación local F02 en verificación. Las decisiones propuestas siguientes se aprobaron con el plan; las pruebas observadas se distinguen al final.

## Alcance y fuentes

**Decisión:** usar la secuencia actualizada del capítulo 33 del Documento Maestro v2.0: F02 trata catálogo e inventario interno. F03 se reserva consultas públicas y Redis; F04 reservas. El capítulo 10 mantiene una secuencia histórica distinta. La Constitution v1.1.0 registra que la secuencia del 33 requiere ratificación al planificar; la aprobación humana de la especificación F02 ratificó este alcance limitado.

**Motivo:** evita mezclar CRUD de Farmacias, búsqueda y reservas con el primer incremento de inventario. HU05/RF10 y capítulo 8 respaldan cambios manuales, .xlsx/.csv, conciliación, atomicidad por archivo y movimientos. **Alternativa descartada:** implementar toda la secuencia antigua F02 de Farmacias + catálogo, que ampliaría el alcance recién aprobado.

## Integración con F01 y permisos

**Decisión propuesta:** reutilizar la sesión opaca, CSRF y transacción tenant de F01 mediante puertos públicos. Cada operación privada prueba sesión, actor, membresía activa, farmacia activa, rol de dueño/administrador autorizado y capacidad explícita de inventario antes de fijar el contexto tenant en la misma transacción. El rol `TRABAJADOR` no obtiene capacidades F02 por defecto. Diseñar capacidades acotadas de lectura, edición manual, importación e historial como catálogo F02 pendiente de ratificación con este plan; no incluir un endpoint de concesión. El fixture aislado puede crearlas solo para identidades ficticias de prueba.

**Motivo:** INV-01 exige permiso por acción y evita confundir pertenencia con autorización. La base persistente F01 no tiene dueños/administradores ni debe alterarse. **Alternativa descartada:** usar solo el nombre del rol o un `farmacia_id` del cliente como prueba de permiso. **Límite:** GLO-01 y BOOT-01 continúan cerradas para operación real; la prueba no equivale a un alta privilegiada productiva.

## Persistencia y RLS

**Decisión propuesta:** mantener PostgreSQL oficial y crear tablas F02 distintas de las referencias mínimas F01. `medicamento` es catálogo global de lectura acotada; `inventario`, `movimiento_inventario`, `importacion` y filas de vista previa se vinculan a `farmacia_id`. RLS `ENABLE` y `FORCE` en tablas privadas, políticas por operación con `USING` y `WITH CHECK`, roles runtime no propietarios `NOSUPERUSER NOBYPASSRLS` y grants mínimos. La transacción conserva la sesión y el actor verificados, fija `app.farmacia_id` con ámbito local y se limpia por `COMMIT`/`ROLLBACK` antes de devolver conexión. Reutilizar el patrón de F01 sin ampliar los privilegios de `f01_runtime` a DDL, administración global ni datos de otros tenants.

**Motivo:** coincide con capítulos 27–29 y principio VIII; los filtros de la API no sustituyen RLS. **Alternativa descartada:** tabla pública de inventarios con RLS desactivado para facilitar F03. La publicación filtrada de F03 exigirá contrato propio.

## Importación y conciliación

**Decisión propuesta:** recibir un archivo acotado, validar formato y tamaño, mapear encabezados, normalizar filas a referencias de catálogo y persistir solo vista previa, digest y errores minimizados; no conservar el archivo original tras procesar la solicitud. La vista previa queda ligada a farmacia y actor, con caducidad corta propuesta de 30 minutos. La confirmación revalida permiso, catálogo, estado y compromisos, bloquea las filas afectadas y aplica todas las escrituras y movimientos en una transacción. Una fila inválida o un conflicto provoca rollback completo del inventario; el estado de rechazo puede registrarse después, sin cambios de stock. Un identificador de vista previa no es autorización.

**Motivo:** satisface atomicidad por archivo, evita retener archivos sensibles y limita reintentos. **Alternativas descartadas:** aplicar filas mientras se leen; guardar el archivo indefinidamente; confiar en una vista previa antigua. Los parámetros de tamaño, filas y caducidad son propuestas del plan, no resultados medidos.

## Lectura .csv y .xlsx: dependencia técnica

**Decisión implementada localmente:** se fijaron `csv-parse@7.0.3` y `@excel.js/exceljs@0.15.0` para CSV/XLSX. `busboy@1.6.0` procesa multipart con límites de archivo/partes; `jsdom@31.0.0` y `@testing-library/react@16.3.3` se usan solo en pruebas de interacción. El parser rechaza fórmulas, vínculos/embebidos, ZIP64, múltiples hojas y archivos que exceden 5 MiB/5 000 filas o 50 MiB declarados descomprimidos. Estos controles y pruebas benignas/malformadas no demuestran resistencia a todo archivo adversarial; la revisión de seguridad de archivos sigue siendo necesaria antes de producción. No se usó `npm audit fix --force`.

**Motivo:** el [proyecto CSV Parse](https://csv.js.org/parse/api/) documenta procesamiento en streams. El paquete [@excel.js/exceljs](https://www.npmjs.com/package/@excel.js/exceljs) es una bifurcación candidata. El repositorio de [ExcelJS original](https://github.com/exceljs/exceljs/issues/3055) registra avisos sobre dependencias transitivas y un [fallo de streaming](https://github.com/exceljs/exceljs/issues/3064); esto justifica el control previo. Las fuentes externas por sí solas no prueban compatibilidad local; la comprobación aislada se registra a continuación.

**Verificación local, 2026-11-12:** `node --version` observó `v24.17.0` y `npm --version` `11.13.0`. Consultas `npm view` confirmaron licencia MIT de los parsers y el rango Node `^20.19.0 || >=22.12.0` del fork XLSX. En `.cache/f02-dep-check/`, `npm ci --ignore-scripts`, `npm audit` y parseo CSV/XLSX benigno/malformado terminaron con salida 0. Después se fijaron dependencias en `backend/package.json`, `package.json` y `package-lock.json`; la auditoría final del árbol de 290 paquetes reportó **0 vulnerabilidades**. `busboy` se eligió según sus [límites documentados](https://github.com/mscdex/busboy#exports), evitando asumir compatibilidad de un paquete diferente. Las pruebas DOM son locales a Node; no acreditan Playwright en Windows 10.

## Pruebas y ejecución local

**Decisión propuesta y resultado observado:** probar dominio, contratos HTTP, migraciones, autorización, RLS SQL directo, pool reutilizado, A/B concurrente, rollback por archivo, duplicados y fecha veraz. Se usaron bases efímeras o DEMO aisladas de la base persistente F01, con fixture FIX-01; una prueba sin PostgreSQL real no acredita RLS. Tres recorridos Playwright F02 pasaron en la imagen Linux oficial, sin afirmar soporte oficial de Windows 10. Docker local se usó para PostgreSQL y el navegador de pruebas; no se crearon recursos AWS.

**Alternativa descartada:** declarar aceptación por tests unitarios o demostración manual de Chrome. F01 conserva sus propios pendientes T050/T051/T062/T067.
