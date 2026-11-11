# Evidencias F00

Este índice conserva la trazabilidad del bootstrap y distingue documento, fixture sintético y ejecución real. Los reportes completos de ejecución permanecen en `artifacts/f00/<run-id>/`, ignorado por Git; solo se publica un resumen redactado tras revisión. No copiar rutas personales, perfiles `.env.local`, tokens ni logs crudos a este directorio.

| ID | Contenido exigido | Estado de esta entrega |
|---|---|---|
| E-F00-01 | Revisión, hashes, Windows, Node/npm y paquetes. | Evidencia local en reporte privado; par completo pendiente. |
| E-F00-02 | Configuración válida/inválida con datos ficticios. | Tests locales; evidencia completa A/B pendiente. |
| E-F00-03 | Build, sintaxis, tipos y arquitectura. | Controles locales; revisión final pendiente. |
| E-F00-04 | Contrato HTTP API/Notificaciones. | Tests y HTTP locales; repetición completa pendiente. |
| E-F00-05 | Playwright, UI real y captura técnica. | Pendiente de entorno compatible. |
| E-F00-06 | Procesos, colisión, reinicio y limpieza. | Controles locales; separación con UI pendiente. |
| E-F00-07 | Preparación A limpia con comandos y resultados. | Copia local independiente verificada; preparación completa con navegador pendiente. |
| E-F00-08 | Preparación B limpia y comparación. | Copia local independiente verificada; preparación completa con navegador pendiente. |
| E-F00-09 | Revisión humana y correspondencia histórica/docente. | Pendiente de aprobación final. |

Cada registro debe contener comando, directorio, inicio/fin y código de salida; versiones observadas; resultado esperado y obtenido; errores redactados o `none`; hashes de fuente/lockfile; limpieza de procesos; y controles pendientes con causa. Los fixtures de `tests/fixtures/` son sintéticos y no cuentan como preparación A/B. Un `local=passed` exige mantener `overall=pending` y `acceptance=pending` mientras falte Playwright. La revisión humana final se registra aparte tras las dos ejecuciones completas.
