# Validación local F02.1

**Estado:** procedimiento reproducible; los resultados reales están en [evidence.md](evidence.md). Usar solo PostgreSQL TEST efímero y datos ficticios. No modificar `farmafind_f01_test`.

1. Confirmar versión de Node/npm, rama, spec/plan aprobados y permisos de la base TEST. No iniciar migraciones hasta aprobación del plan y revisión de SQL.
2. Ejecutar `npm run check` y `npm run build`; correr pruebas focalizadas de parser, detector de hoja/encabezado, sinónimos, errores por campo y conciliación. Deben incluir CSV válido, XLSX mult hoja, encabezado desplazado, columnas ambiguas, duplicados y precio/cantidad vacíos.
3. En TEST efímero, aplicar migración aditiva aprobada y verificar RLS con Alfa/Beta: perfil propio visible, ajeno denegado, vista previa ajena invisible, confirmación cruzada denegada y conexión reutilizada sin contexto residual.
4. Probar HTTP con cookie/CSRF válidos e inválidos; inspección, mapeo corregido, perfil compatible/incompatible, incidencias y confirmación. Verificar compatibilidad de clientes F02 existentes.
5. Probar rollback por fila inválida y por conflicto concurrente; confirmar que stock físico nunca queda bajo compromiso. Repetir confirmación para idempotencia y comprobar movimientos únicos.
6. Probar proyección F03 y Redis: nada cambia en preview; tras confirmar se invalida y se muestra solo oferta publicable. Repetir regresión de F04 reservas/stock.
7. En navegador compatible, revisar manualmente los cuatro recorridos de la especificación con archivos ficticios y registrar evidencia, entorno, resultado esperado/obtenido y omisiones. Playwright en Windows 10 no se dará por oficialmente soportado.

La aceptación requiere los siete F021-SC, casos negativos, revisión humana y evidencia real; la aprobación del plan por sí sola no cierra tareas.

Con un fixture F02 TEST ya preparado y marcado en `.cache/f02-fixture/state.local.json`, iniciar PostgreSQL con `docker compose -f compose.f01-postgres.yaml up -d --no-recreate` y Redis con `docker compose -f compose.f03-search.yaml up -d --no-recreate`; ejecutar `npm run build` y `node scripts/f021/run-browser-linux.mjs`; detener los servicios iniciados con `docker compose -f compose.f03-search.yaml stop redis` y `docker compose -f compose.f01-postgres.yaml stop`. El ejecutor rechaza otro nombre de base y otro marcador, usa Playwright Linux con mounts limitados y detiene su propia API/frontend. No usarlo con datos persistentes ni sustituir la revisión humana.
